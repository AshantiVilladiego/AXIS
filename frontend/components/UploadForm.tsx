"use client";

import React, { useState, useRef, useEffect } from 'react';
import { UploadResponse } from '../types/api'; 
import { useSupabase } from './providers/SupabaseProvider';

interface UploadFormProps {
  apiStatus?: string;
}

interface ExtractedField {
  field_name: string;
  extracted_value: unknown;
  confidence_score?: number;
}

// ---------------------------------------------------------------------------
// Parses Python literal syntax (single-quoted strings, None/True/False,
// nested dicts/lists) into a plain JS value. The backend is serializing
// Python dict reprs directly instead of proper JSON, so JSON.parse can't
// be used here — this is a small hand-rolled recursive-descent parser.
// ---------------------------------------------------------------------------
function parsePythonLiteral(input: string): unknown {
  let i = 0;
  const s = input;

  const skipWs = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };

  const parseString = (): string => {
    const quote = s[i];
    i++;
    let result = '';
    while (i < s.length && s[i] !== quote) {
      if (s[i] === '\\' && i + 1 < s.length) {
        result += s[i + 1];
        i += 2;
      } else {
        result += s[i];
        i++;
      }
    }
    i++; // closing quote
    return result;
  };

  const parseNumber = (): number => {
    const start = i;
    while (i < s.length && /[-\d.eE+]/.test(s[i])) i++;
    return parseFloat(s.slice(start, i));
  };

  const parseDict = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    i++; // skip {
    skipWs();
    if (s[i] === '}') { i++; return obj; }
    while (i < s.length) {
      skipWs();
      const key = parseValue();
      skipWs();
      if (s[i] === ':') i++;
      const value = parseValue();
      obj[String(key)] = value;
      skipWs();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === '}') { i++; break; }
      break;
    }
    return obj;
  };

  const parseList = (): unknown[] => {
    const arr: unknown[] = [];
    i++; // skip [
    skipWs();
    if (s[i] === ']') { i++; return arr; }
    while (i < s.length) {
      skipWs();
      arr.push(parseValue());
      skipWs();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ']') { i++; break; }
      break;
    }
    return arr;
  };

  function parseValue(): unknown {
    skipWs();
    const c = s[i];
    if (c === '{') return parseDict();
    if (c === '[') return parseList();
    if (c === "'" || c === '"') return parseString();
    if (s.startsWith('None', i)) { i += 4; return null; }
    if (s.startsWith('True', i)) { i += 4; return true; }
    if (s.startsWith('False', i)) { i += 5; return false; }
    return parseNumber();
  }

  try {
    return parseValue();
  } catch {
    return input; // fall back to raw string if parsing fails
  }
}

// Normalizes a field's extracted_value: parses it if it's a Python-literal
// string, otherwise passes real objects/primitives through untouched.
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return parsePythonLiteral(trimmed);
    }
    return value;
  }
  return value;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Recursively renders a parsed value as nested label/value blocks.
function FieldValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic">Not extracted</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-slate-800 font-medium">{value ? 'Yes' : 'No'}</span>;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return <span className="text-slate-800 font-medium whitespace-pre-wrap">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400 italic">None</span>;
    }
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, idx) => (
          <div key={idx} className="border border-slate-200 rounded-md p-2 bg-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Item {idx + 1}</p>
            <FieldValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const hasContent = entries.some(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);

    return (
      <div className={`space-y-2 ${depth > 0 ? 'mt-1 pl-3 border-l-2 border-slate-200' : ''}`}>
        {!hasContent && (
          <span className="text-slate-400 italic">No data extracted for this section</span>
        )}
        {entries.map(([key, val]) => {
          const normalized = normalizeValue(val);
          if (normalized === null || normalized === undefined || normalized === '' || normalized === false) {
            return null; // skip empty leaves to reduce noise
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

export default function UploadForm({ apiStatus = "Checking connection..." }: UploadFormProps) {
  const isOffline = apiStatus === 'API Engine Offline' || apiStatus === 'Checking connection...';
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formType, setFormType] = useState('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supabase } = useSupabase();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);
  
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
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null); 
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadResult(null); 
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("form_type", formType); 

    try {
      // Attach the current Supabase session's access token so the backend
      // can verify who's making the request server-side. Never send a
      // user_id field directly — the backend no longer accepts one, since
      // a client-supplied id could be spoofed.
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const headers: HeadersInit = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      // If there's no session (not logged in), the request still goes out
      // without an Authorization header — the backend will 401 unless it's
      // running in development mode with a dev fallback user configured.

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const data: UploadResponse = await response.json();
      console.log("Backend Response:", data);
      
      setUploadResult(data);
      
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Check the console for details.");
    } finally {
      setIsUploading(false); 
    }
  };

  // extracted_data is now an array of { field_name, extracted_value, confidence_score }
  const extractedFields: ExtractedField[] = Array.isArray(uploadResult?.extracted_data)
    ? (uploadResult!.extracted_data as unknown as ExtractedField[])
    : [];

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header & Status */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Ingestion</h2>
          <p className="text-sm text-slate-500 mt-1">Upload government forms for AI-powered extraction and auto-fill.</p>
        </div>
        
        <div className={`px-3 py-1.5 border rounded-full flex items-center gap-2 ${isOffline ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOffline ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isOffline ? 'text-red-700' : 'text-emerald-700'}`}>
            {apiStatus}
          </span>
        </div>
      </div>

      {/* Form Type Selector */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Document Classification</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select the form type, or let the AI engine auto-detect it.</p>
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

      {/* The Drop-zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer py-12 flex flex-col items-center justify-center 
          ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 
            selectedFile ? 'border-indigo-400 bg-indigo-50/30' : 
            'border-slate-300 bg-white hover:bg-slate-50'}`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden" 
          accept=".pdf,.jpg,.jpeg,.png"
        />

        {selectedFile ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <p className="text-lg font-bold text-slate-900 mb-1">{selectedFile.name}</p>
            <p className="text-sm text-slate-500 mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
              disabled={isUploading || isOffline}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
            >
              {isUploading ? 'Extracting via AI...' : 'Process Document'}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            </div>
            <p className="text-lg font-medium text-slate-900 mb-1">Drop your document here</p>
            <p className="text-sm text-slate-500 mb-4">or <span className="text-indigo-600 font-medium hover:underline">browse files</span> from your device</p>
            <div className="flex justify-center gap-2 mb-4">
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">PDF</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">JPG</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">PNG</span>
            </div>
            <p className="text-xs text-slate-400">Supports scanned documents and mobile-captured photos. Max 25MB.</p>
          </div>
        )}
      </div>

      {/* Form Parsing Verification Section */}
      <div className="mt-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-indigo-600">⎔</span> Form Parsing Verification
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Document Preview Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-125">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Preview</span>
              <span className="text-xs font-medium text-slate-400">
                {uploadResult ? uploadResult.form_details.filename : selectedFile ? "Ready" : "Awaiting file..."}
              </span>
            </div>
            <div className="flex-1 bg-slate-100/50 relative">
              {previewUrl ? (
                selectedFile?.type.startsWith('image/') ? (
                  <img src={previewUrl} alt="Document preview" className="w-full h-full object-contain p-2 absolute inset-0" />
                ) : (
                  <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-slate-400">No document uploaded yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Extracted Fields Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-125">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extracted Fields</span>
              <span className={`text-xs font-medium flex items-center gap-1 ${uploadResult?.status === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>
                ⚡ AI Confidence
              </span>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              
              {extractedFields.length > 0 ? (
                extractedFields.map((field) => {
                  const normalized = normalizeValue(field.extracted_value);
                  return (
                    <div key={field.field_name} className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                          {formatLabel(field.field_name)}
                        </label>
                        {typeof field.confidence_score === 'number' && (
                          <span className="text-[10px] font-semibold text-emerald-500">
                            {Math.round(field.confidence_score * 100)}%
                          </span>
                        )}
                      </div>
                      <FieldValue value={normalized} />
                    </div>
                  );
                })
              ) : (
                ['Full Name', 'Taxpayer ID (TIN)', 'Birth Date', 'Address'].map((field) => (
                  <div key={field} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{field}</label>
                    <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                      {isUploading && (
                        <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                      )}
                      {isUploading ? "Extracting via AI..." : "Awaiting extraction..."}
                    </p>
                  </div>
                ))
              )}

            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}