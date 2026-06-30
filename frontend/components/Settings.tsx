import React, { useState } from 'react';

export default function Settings() {
  // Add state to make the toggles interactive
  const [aiFailover, setAiFailover] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your account preferences and AI engine configuration.</p>
      </div>

      <div className="space-y-6">
        
        {/* Card 1: User Profile */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <h3 className="text-sm font-semibold text-slate-800">User Profile</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-1.5 max-w-md">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                defaultValue="juan.delacruz@gov.ph" 
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
              />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  placeholder="Enter new password" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all pr-10" 
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="pt-2">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                Update Credentials
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: AI Engine Configuration */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
            </svg>
            <h3 className="text-sm font-semibold text-slate-800">AI Engine Configuration</h3>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Toggle 1 */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Enable AI Provider Failover</p>
                <p className="text-sm text-slate-500 mt-0.5">Automatically switch to a backup AI provider if the primary becomes unavailable.</p>
              </div>
              <button 
                onClick={() => setAiFailover(!aiFailover)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiFailover ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiFailover ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <hr className="border-slate-100" />

            {/* Toggle 2 */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Email Notifications</p>
                <p className="text-sm text-slate-500 mt-0.5">Send an email summary when a document batch finishes processing.</p>
              </div>
              <button 
                onClick={() => setEmailNotifs(!emailNotifs)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${emailNotifs ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailNotifs ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

          </div>
        </div>

        {/* Card 3: Danger Zone */}
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2 bg-red-50/30">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
          </div>
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Delete Account & All Data</p>
              <p className="text-sm text-slate-500 mt-0.5">This action is permanent and cannot be undone.</p>
            </div>
            <button className="whitespace-nowrap px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Delete Account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}