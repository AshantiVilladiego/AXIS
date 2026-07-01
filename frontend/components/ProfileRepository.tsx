import React from 'react';

export default function ProfileRepository() {
  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profile Repository</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your Personally Identifiable Information (PII) for automated form filling.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-100 px-3 py-1.5 rounded-md">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <span className="font-medium">End-to-End Encrypted</span>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <form className="p-6 md:p-8 space-y-8">
          
          {/* Section 1: Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-indigo-600">1.</span> Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" placeholder="e.g., Juan dela Cruz" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Birth Date</label>
                <input type="date" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-slate-700" />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Address</label>
                <input type="text" placeholder="House No., Street, City, Province" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Contact Number</label>
                <input type="tel" placeholder="+63 900 000 0000" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Government IDs */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-indigo-600">2.</span> Government Identification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Taxpayer ID (TIN)</label>
                <input type="text" placeholder="000-000-000-000" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">SSS Number</label>
                <input type="text" placeholder="00-0000000-0" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">PhilHealth Number</label>
                <input type="text" placeholder="00-000000000-0" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Pag-IBIG Number</label>
                <input type="text" placeholder="0000-0000-0000" className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" />
              </div>
            </div>
          </div>

        </form>

        {/* Footer Action */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end">
          <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm">
            Save Profile Data
          </button>
        </div>
      </div>
      
    </div>
  );
}