import React from 'react';

// Define our data structure based on the A.X.I.S. architecture
interface HistoryRecord {
  id: string;
  name: string;
  type: string;
  date: string;
  score: number;
  status: 'Success' | 'Error';
}

export default function ProcessingHistory() {
  // Mock data matching your exact Figma design
  const mockData: HistoryRecord[] = [
    { id: '1', name: 'BIR Form 2316.pdf', type: 'BIR', date: 'Jun 24, 2026', score: 98, status: 'Success' },
    { id: '2', name: 'SSS_E1_Application.pdf', type: 'SSS', date: 'Jun 22, 2026', score: 94, status: 'Success' },
    { id: '3', name: 'PhilHealth_MDR.jpg', type: 'PhilHealth', date: 'Jun 20, 2026', score: 91, status: 'Success' },
    { id: '4', name: 'PagIBIG_MDF_Form.png', type: 'Pag-IBIG', date: 'Jun 18, 2026', score: 47, status: 'Error' },
    { id: '5', name: 'BIR_1701A_Annual.pdf', type: 'BIR', date: 'Jun 15, 2026', score: 99, status: 'Success' },
    { id: '6', name: 'SSS_Salary_Loan.pdf', type: 'SSS', date: 'Jun 12, 2026', score: 96, status: 'Success' },
  ];

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
            {mockData.length} records found
          </div>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
            Export CSV
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
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
              {mockData.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                  
                  {/* Document Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{record.name}</span>
                    </div>
                  </td>

                  {/* Form Type Badge */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">
                      {record.type}
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
                      {record.score}%
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
                      <button className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Download
                      </button>
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