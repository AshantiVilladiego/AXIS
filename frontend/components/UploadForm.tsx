"use client";

import React, { useState, useRef, useEffect } from 'react';
import { UploadResponse } from '../types/api'; 

interface UploadFormProps {
  apiStatus?: string;
}

export default function UploadForm({ apiStatus = "Checking connection..." }: UploadFormProps) {
  const isOffline = apiStatus === 'API Engine Offline' || apiStatus === 'Checking connection...';
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formType, setFormType] = useState('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  
  // NEW: State to hold the temporary local URL for the PDF/Image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refactored to use environment variable
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // NEW: Automatically generate a preview URL whenever a file is selected
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    
    // Create a local memory link to the file
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    // Free memory when the component unmounts or the file changes
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
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
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
          
          {/* UPDATED: Document Preview Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-125">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Preview</span>
              <span className="text-xs font-medium text-slate-400">
                {uploadResult ? uploadResult.form_type : selectedFile ? "Ready" : "Awaiting file..."}
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
              
              {uploadResult?.extracted_data ? (
                Object.entries(
                  uploadResult.extracted_data.data || uploadResult.extracted_data
                ).map(([key, value]) => (
                  <div key={key} className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 transition-all">
                    <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">
                      {typeof value === 'object' && value !== null 
                        ? JSON.stringify(value, null, 2).replace(/["{}]/g, '') 
                        : String(value)}
                    </p>
                  </div>
                ))
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