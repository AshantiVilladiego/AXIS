"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadResponse } from "../types/api";
import { useSupabase } from "./providers/SupabaseProvider";

interface UploadFormProps {
  apiStatus?: string;
}

interface ExtractedField {
  field_name: string;
  extracted_value: unknown;
  confidence_score?: number;
  text?: string;
  isMagicFilled?: boolean;
}

function parsePythonLiteral(input: string): unknown {
  let i = 0;
  const s = input;

  const skipWs = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };

  const parseString = (): string => {
    const quote = s[i];
    i++;
    let result = "";
    while (i < s.length && s[i] !== quote) {
      if (s[i] === "\\" && i + 1 < s.length) {
        result += s[i + 1];
        i += 2;
      } else {
        result += s[i];
        i++;
      }
    }
    i++;
    return result;
  };

  const parseNumber = (): number => {
    const start = i;
    while (i < s.length && /[-\d.eE+]/.test(s[i])) i++;
    return parseFloat(s.slice(start, i));
  };

  const parseDict = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    i++;
    skipWs();
    if (s[i] === "}") {
      i++;
      return obj;
    }
    while (i < s.length) {
      skipWs();
      const key = parseValue();
      skipWs();
      if (s[i] === ":") i++;
      const value = parseValue();
      obj[String(key)] = value;
      skipWs();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === "}") {
        i++;
        break;
      }
      break;
    }
    return obj;
  };

  const parseList = (): unknown[] => {
    const arr: unknown[] = [];
    i++;
    skipWs();
    if (s[i] === "]") {
      i++;
      return arr;
    }
    while (i < s.length) {
      skipWs();
      arr.push(parseValue());
      skipWs();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === "]") {
        i++;
        break;
      }
      break;
    }
    return arr;
  };

  function parseValue(): unknown {
    skipWs();
    const c = s[i];
    if (c === "{") return parseDict();
    if (c === "[") return parseList();
    if (c === "'" || c === '"') return parseString();
    if (s.startsWith("None", i)) {
      i += 4;
      return null;
    }
    if (s.startsWith("True", i)) {
      i += 4;
      return true;
    }
    if (s.startsWith("False", i)) {
      i += 5;
      return false;
    }
    return parseNumber();
  }

  try {
    return parseValue();
  } catch {
    return input;
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return parsePythonLiteral(trimmed);
    }
    return value;
  }
  return value;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400 italic">Not extracted</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-slate-800 font-medium">{value ? "Yes" : "No"}</span>
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    return (
      <span className="text-slate-800 font-medium whitespace-pre-wrap">
        {String(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400 italic">None</span>;
    }
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, idx) => (
          <div
            key={idx}
            className="border border-slate-200 rounded-md p-2 bg-white"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
              Item {idx + 1}
            </p>
            <FieldValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const hasContent = entries.some(
      ([, v]) => v !== null && v !== undefined && v !== "" && v !== false,
    );

    return (
      <div
        className={`space-y-2 ${depth > 0 ? "mt-1 pl-3 border-l-2 border-slate-200" : ""}`}
      >
        {!hasContent && (
          <span className="text-slate-400 italic">
            No data extracted for this section
          </span>
        )}
        {entries.map(([key, val]) => {
          const normalized = normalizeValue(val);
          if (
            normalized === null ||
            normalized === undefined ||
            normalized === "" ||
            normalized === false
          ) {
            return null;
          }
          return (
            <div key={key}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                {formatLabel(key)}
              </label>
              <FieldValue value={normalized} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-slate-800">{String(value)}</span>;
}

export default function UploadForm({
  apiStatus = "Checking connection...",
}: UploadFormProps) {
  const isOffline =
    apiStatus === "API Engine Offline" ||
    apiStatus === "Checking connection...";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formType, setFormType] = useState("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<any>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supabase } = useSupabase();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const response = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.data && Object.keys(result.data).length > 0) {
            setProfileData(result.data);
          }
        }
      } catch (err) {
        console.error("Could not load profile data:", err);
      }
    };
    fetchProfile();
  }, [supabase, API_BASE_URL]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const validateFile = (file: File): boolean => {
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(
        "Invalid file type. Only PDF, JPG, and PNG documents are supported.",
      );
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max allowed size is 25MB.`,
      );
      return false;
    }
    return true;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setUploadResult(null);
        setFormId(null);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setUploadResult(null);
        setFormId(null);
      } else {
        e.target.value = "";
      }
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setUploadResult(null);
    setFormId(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);
    setUploadError(null);
    setFormId(null); // Reset ID

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("form_type", formType);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session found. Please log in again.");
      }

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Upload failed");
      }

      const data = await response.json();
      console.log("Backend Response:", data);

      // Extract ID reliably from the root 'id' field provided by the backend
      const capturedId = data.id;

      if (capturedId) {
        setFormId(capturedId);
        console.log("Successfully captured Form ID:", capturedId);
      } else {
        console.error("Backend did not return an ID:", data);
      }

      setUploadResult(data as UploadResponse);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const prepareMagicFillData = (fields: ExtractedField[], profile: any) => {
    if (!profile) return fields;

    const profileMap: Record<string, string> = {
      tin: profile.tinNumber,
      "taxpayer id": profile.tinNumber,
      sss: profile.sssNumber,
      philhealth: profile.philhealthNumber,
      "pag-ibig": profile.pagibigNumber,
      name: profile.fullName,
      "full name": profile.fullName,
      address: profile.address,
      contact: profile.contactNumber,
      birth: profile.birthDate,
    };

    return fields.map((field) => {
      const normalizedLabel = (field.field_name || "").toLowerCase();
      const matchedKey = Object.keys(profileMap).find((key) =>
        normalizedLabel.includes(key),
      );

      if (matchedKey && profileMap[matchedKey]) {
        return {
          ...field,
          text: profileMap[matchedKey],
          isMagicFilled: true,
        };
      }
      return { ...field, text: String(field.extracted_value || "") };
    });
  };

  const handleGenerateDocument = async () => {
    const targetId =
      formId || (uploadResult as any)?.id || uploadResult?.form_details?.id;

    console.log("DEBUG: Target ID resolved as:", targetId);
    console.log("DEBUG: Full UploadResult:", uploadResult);

    if (!targetId) {
      alert(
        "⚠️ Error: The Form ID is missing! Open Developer Tools (F12) -> Console to see the backend response.",
      );
      console.error("UploadResult object:", uploadResult);
      return;
    }

    if (!extractedFields || extractedFields.length === 0) {
      alert("⚠️ No extracted fields available to fill.");
      return;
    }

    setIsGenerating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const filledData = prepareMagicFillData(extractedFields, profileData);

      const response = await fetch(`${API_BASE_URL}/api/${targetId}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(filledData),
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(`Backend Error ${response.status}: ${errorMsg}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `AXIS_Filled_Form_${targetId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error("Generation error:", err);
      alert(`Failed to generate document: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const extractedFields: ExtractedField[] = Array.isArray(
    uploadResult?.extracted_data,
  )
    ? (uploadResult!.extracted_data as unknown as ExtractedField[])
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Document Ingestion
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload government forms for AI-powered extraction and auto-fill.
          </p>
        </div>

        <div
          className={`px-3 py-1.5 border rounded-full flex items-center gap-2 ${isOffline ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${isOffline ? "bg-red-500" : "bg-emerald-500"}`}
          ></div>
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${isOffline ? "text-red-700" : "text-emerald-700"}`}
          >
            {apiStatus}
          </span>
        </div>
      </div>

      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Document Classification
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the form type, or let the AI engine auto-detect it.
          </p>
        </div>
        <select
          value={formType}
          onChange={(e) => setFormType(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block p-2.5 outline-none font-medium text-slate-700 w-full md:w-64"
        >
          <option value="auto">✨ Auto-Detect (AI Model)</option>
          <option disabled>──────────</option>
          <option value="bir_2316">BIR Form 2316</option>
          <option value="bir_1701">BIR Form 1701/1701A</option>
          <option value="sss_e1">SSS E-1 (Personal Record)</option>
          <option value="philhealth_pmrf">PhilHealth PMRF</option>
          <option value="pagibig_mdf">Pag-IBIG MDF</option>
          <option disabled>──────────</option>
          <option value="other">Other / Unspecified Form</option>
        </select>
      </div>

      {uploadError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          <div>
            <h3 className="text-sm font-bold text-red-800">Upload Failed</h3>
            <p className="text-sm text-red-700 mt-0.5">{uploadError}</p>
          </div>
        </div>
      )}

      <div
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl transition-all duration-200 py-12 flex flex-col items-center justify-center 
          ${!selectedFile ? "cursor-pointer" : ""}
          ${
            isDragging
              ? "border-indigo-500 bg-indigo-50 scale-[1.02]"
              : selectedFile
                ? "border-indigo-400 bg-indigo-50/30"
                : "border-slate-300 bg-white hover:bg-slate-50"
          }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
        />

        {selectedFile ? (
          <div className="text-center w-full px-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-900 mb-1 truncate max-w-md mx-auto">
              {selectedFile.name}
            </p>
            <p className="text-sm text-slate-500 mb-6">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={clearSelection}
                disabled={isUploading}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                Change File
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={isUploading || isOffline}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm min-w-[160px] flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Extracting...
                  </>
                ) : (
                  "Process Document"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg
                className="w-6 h-6 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                ></path>
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-900 mb-1">
              Drop your document here
            </p>
            <p className="text-sm text-slate-500 mb-4">
              or{" "}
              <span className="text-indigo-600 font-medium hover:underline">
                browse files
              </span>{" "}
              from your device
            </p>
            <div className="flex justify-center gap-2 mb-4">
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                PDF
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                JPG
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                PNG
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Supports scanned documents and mobile-captured photos. Max 25MB.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-indigo-600">⎔</span> Form Parsing Verification
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[500px]">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Document Preview
              </span>
              <span
                className="text-xs font-medium text-slate-400 truncate max-w-[200px]"
                title={
                  uploadResult
                    ? uploadResult.form_details?.filename
                    : selectedFile
                      ? selectedFile.name
                      : ""
                }
              >
                {uploadResult
                  ? uploadResult.form_details?.filename
                  : selectedFile
                    ? selectedFile.name
                    : "Awaiting file..."}
              </span>
            </div>
            <div className="flex-1 bg-slate-100/50 relative">
              {previewUrl ? (
                selectedFile?.type.startsWith("image/") ? (
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="w-full h-full object-contain p-2 absolute inset-0"
                  />
                ) : (
                  <iframe
                    src={`${previewUrl}#toolbar=0`}
                    className="w-full h-full border-0 absolute inset-0"
                    title="PDF Preview"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-slate-400">
                    No document uploaded yet
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[500px]">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Extracted Fields
              </span>
              <span
                className={`text-xs font-medium flex items-center gap-1 ${uploadResult?.status === "success" ? "text-emerald-500" : "text-slate-400"}`}
              >
                ⚡ AI Confidence
              </span>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              {extractedFields.length > 0
                ? extractedFields.map((field) => {
                    const normalized = normalizeValue(field.extracted_value);
                    return (
                      <div
                        key={field.field_name}
                        className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                            {formatLabel(field.field_name)}
                          </label>
                          {typeof field.confidence_score === "number" && (
                            <span className="text-[10px] font-semibold text-emerald-500">
                              {Math.round(field.confidence_score * 100)}%
                            </span>
                          )}
                        </div>
                        <FieldValue value={normalized} />
                      </div>
                    );
                  })
                : [
                    "Full Name",
                    "Taxpayer ID (TIN)",
                    "Birth Date",
                    "Address",
                  ].map((field) => (
                    <div
                      key={field}
                      className="bg-slate-50 rounded-lg p-3 border border-slate-100"
                    >
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {field}
                      </label>
                      <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                        {isUploading && (
                          <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                        )}
                        {isUploading
                          ? "Extracting via AI..."
                          : "Awaiting extraction..."}
                      </p>
                    </div>
                  ))}
            </div>

            {extractedFields.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                <button
                  onClick={handleGenerateDocument}
                  disabled={isGenerating || !profileData}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Generating Document...
                    </>
                  ) : (
                    "✨ Auto-Fill & Generate Document"
                  )}
                </button>
                {!profileData && (
                  <p className="text-xs text-amber-600 mt-2 text-center font-medium bg-amber-50 p-2 rounded border border-amber-200">
                    ⚠️ Set up your Profile Repository to enable Auto-Fill.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
