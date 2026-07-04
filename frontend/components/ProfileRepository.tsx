"use client";

import React, { useState } from 'react';

// Define the shape of our profile data
interface UserProfile {
  fullName: string;
  birthDate: string;
  address: string;
  contactNumber: string;
  tinNumber: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
}

export default function ProfileRepository() {
  // 1. Set up the local state to hold all form values
  const [profileData, setProfileData] = useState<UserProfile>({
    fullName: '',
    birthDate: '',
    address: '',
    contactNumber: '',
    tinNumber: '',
    sssNumber: '',
    philhealthNumber: '',
    pagibigNumber: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // 2. Handle input changes dynamically
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 3. The Save Flow Stub
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // TODO: Phase 3 Integration
    // Replace this setTimeout stub with a real fetch POST to /api/profile
    // once the backend data persistence schema is finalized.
    setTimeout(() => {
      console.log("Mock Save Successful. Data ready for backend:", profileData);
      alert("Profile data temporarily saved to local state! Check the browser console to view the JSON payload.");
      setIsSaving(false);
    }, 800);
  };

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
        <form onSubmit={handleSave} className="flex flex-col h-full">
          <div className="p-6 md:p-8 space-y-8 flex-1">
            
            {/* Section 1: Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-indigo-600">1.</span> Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleChange}
                    placeholder="e.g., Juan dela Cruz" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Birth Date</label>
                  <input 
                    type="date" 
                    name="birthDate"
                    value={profileData.birthDate}
                    onChange={handleChange}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-slate-700" 
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Address</label>
                  <input 
                    type="text" 
                    name="address"
                    value={profileData.address}
                    onChange={handleChange}
                    placeholder="House No., Street, City, Province" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Contact Number</label>
                  <input 
                    type="tel" 
                    name="contactNumber"
                    value={profileData.contactNumber}
                    onChange={handleChange}
                    placeholder="+63 900 000 0000" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
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
                  <input 
                    type="text" 
                    name="tinNumber"
                    value={profileData.tinNumber}
                    onChange={handleChange}
                    placeholder="000-000-000-000" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">SSS Number</label>
                  <input 
                    type="text" 
                    name="sssNumber"
                    value={profileData.sssNumber}
                    onChange={handleChange}
                    placeholder="00-0000000-0" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">PhilHealth Number</label>
                  <input 
                    type="text" 
                    name="philhealthNumber"
                    value={profileData.philhealthNumber}
                    onChange={handleChange}
                    placeholder="00-000000000-0" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Pag-IBIG Number</label>
                  <input 
                    type="text" 
                    name="pagibigNumber"
                    value={profileData.pagibigNumber}
                    onChange={handleChange}
                    placeholder="0000-0000-0000" 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end mt-auto">
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save Profile Data'}
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}