"use client";

import React, { useState, useEffect } from 'react';
import { useSupabase } from './providers/SupabaseProvider';

// Define our data structure matching the backend's HistoryRecord response
interface HistoryRecord {
  id: string;
  name: string;
  type: string;
  date: string;
  score: number;
  status: 'Success' | 'Error';
  file_url: string;
}

export default function ProcessingHistory() {
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { supabase } = useSupabase();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          throw new Error("Authentication required to view history.");
        }

        const response = await fetch(`${API_BASE_URL}/api/history`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch processing history from the server.");
        }

        const data = await response.json();
        
        // Format the ISO date strings into clean "Jun 24, 2026" layout
        const formattedData = data.map((record: any) => {
          const dateObj = new Date(record.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return {
            ...record,
            date: formattedDate
          };
        });

        if (isMounted) {
          setHistoryData(formattedData);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [supabase, API_BASE_URL]);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Processing History</h2>
        <p className="text-sm text-slate-500 mt-1">Audit log of all documents processed through the A.X.I.S. engine.</p>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        
        {/* Top Action Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {isLoading ? "Loading records..." : `${historyData.length} records found`}
          </div>
          <button 
            disabled={historyData.length === 0}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 flex items-center gap-1 transition-colors"
          >
            Export CSV
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[300px] relative">
          
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
               <span className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></span>
               <p className="text-sm font-medium text-slate-500">Fetching audit logs...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 px-6 text-center">
               <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
               <p className="text-sm font-semibold text-slate-900">Failed to load history</p>
               <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
          )}

          {!isLoading && !error && historyData.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                 <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
               </div>
               <p className="text-sm font-semibold text-slate-900">No documents processed yet</p>
               <p className="text-sm text-slate-500 mt-1">Your uploaded and extracted documents will appear here.</p>
            </div>
          )}

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Document Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Form Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Upload Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">AI Score</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyData.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                  
                  {/* Document Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]" title={record.name}>{record.name}</span>
                    </div>
                  </td>

                  {/* Form Type Badge */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wider font-bold rounded-md">
                      {record.type === 'auto' ? 'Auto-Detected' : record.type.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-500 font-mono">{record.date}</span>
                  </td>

                  {/* Conditional AI Score */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      record.status === 'Success' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {Math.round(record.score)}%
                    </span>
                  </td>

                  {/* Conditional Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.status === 'Success' ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 w-max">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Success</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-600 px-2.5 py-1 rounded-full border border-red-200 bg-red-50 w-max">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Error</span>
                      </div>
                    )}
                  </td>

                  {/* Conditional Action */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.status === 'Success' ? (
                      <a 
                        href={record.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors w-max"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Download
                      </a>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}