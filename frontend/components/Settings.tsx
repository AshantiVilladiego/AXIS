"use client";

import React, { useState, useEffect } from 'react';
import { useSupabase } from './providers/SupabaseProvider';

export default function Settings() {
  const { supabase } = useSupabase();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

  // Auth States
  const [userEmail, setUserEmail] = useState<string>("Loading...");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState({ text: "", type: "" });

  // AI & Notification States
  const [aiFailover, setAiFailover] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState({ text: "", type: "" });

  // 1. Fetch user session and backend settings on mount
  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        if (isMounted) setUserEmail("No active session detected");
        if (isMounted) setIsLoadingSettings(false);
        return;
      }

      if (isMounted) setUserEmail(session.user.email || "No email found");

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/settings`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setAiFailover(data.ai_failover);
            setEmailNotifs(data.email_notifications);
          }
        }
      } catch (err) {
        console.error("Network error fetching settings", err);
      } finally {
        if (isMounted) setIsLoadingSettings(false);
      }
    };

    fetchUserData();
    return () => { isMounted = false; };
  }, [supabase, API_BASE_URL]);

  // 2. Handle DB Patching for Toggles
  const updateSetting = async (key: 'ai_failover' | 'email_notifications', newValue: boolean) => {
    // Optimistic UI update
    if (key === 'ai_failover') setAiFailover(newValue);
    if (key === 'email_notifications') setEmailNotifs(newValue);
    setSettingsMessage({ text: "Saving...", type: "loading" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(`${API_BASE_URL}/api/users/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ [key]: newValue })
      });

      if (!response.ok) throw new Error("Backend rejected update");

      setSettingsMessage({ text: "Settings saved to database", type: "success" });
      setTimeout(() => setSettingsMessage({ text: "", type: "" }), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSettingsMessage({ text: "Failed to save settings", type: "error" });
      
      // Revert optimistic update on failure
      if (key === 'ai_failover') setAiFailover(!newValue);
      if (key === 'email_notifications') setEmailNotifs(!newValue);
      setTimeout(() => setSettingsMessage({ text: "", type: "" }), 3000);
    }
  };

  // 3. Handle Password Update via Supabase Auth
  const handleUpdateCredentials = async () => {
    if (!newPassword) return;
    setIsUpdatingAuth(true);
    setAuthMessage({ text: "Updating password...", type: "loading" });

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setAuthMessage({ text: error.message, type: "error" });
    } else {
      setAuthMessage({ text: "Password updated successfully!", type: "success" });
      setNewPassword("");
    }
    
    setIsUpdatingAuth(false);
    setTimeout(() => setAuthMessage({ text: "", type: "" }), 4000);
  };

  // 4. Handle Logout securely
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // Hard redirect to force state clearance
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your account preferences and AI engine configuration.</p>
        </div>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors w-max"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          Sign Out
        </button>
      </div>

      <div className="space-y-6">
        
        {/* Card 1: User Profile */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <h3 className="text-sm font-semibold text-slate-800">User Profile</h3>
            </div>
            {authMessage.text && (
              <span className={`text-xs font-semibold ${authMessage.type === 'error' ? 'text-red-500' : authMessage.type === 'success' ? 'text-emerald-500' : 'text-slate-500'}`}>
                {authMessage.text}
              </span>
            )}
          </div>
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-1.5 max-w-md">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                readOnly
                value={userEmail} 
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed focus:outline-none transition-all" 
              />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  placeholder="Enter new password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all pr-10" 
                />
              </div>
            </div>
            <div className="pt-2">
              <button 
                onClick={handleUpdateCredentials}
                disabled={isUpdatingAuth || !newPassword}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors"
              >
                {isUpdatingAuth ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                )}
                Update Credentials
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: AI Engine Configuration */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
              </svg>
              <h3 className="text-sm font-semibold text-slate-800">AI Engine Configuration</h3>
            </div>
            {settingsMessage.text && (
              <span className={`text-xs font-semibold ${settingsMessage.type === 'error' ? 'text-red-500' : settingsMessage.type === 'success' ? 'text-emerald-500' : 'text-slate-500'}`}>
                {settingsMessage.text}
              </span>
            )}
          </div>
          <div className="p-6 space-y-6">
            
            {/* Toggle 1: AI Failover */}
            <div className="flex items-start justify-between gap-4">
              <div className={`${isLoadingSettings ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                <p className="text-sm font-semibold text-slate-900">Enable AI Provider Failover</p>
                <p className="text-sm text-slate-500 mt-0.5">Automatically switch to a backup AI provider if the primary becomes unavailable.</p>
              </div>
              <button 
                onClick={() => updateSetting('ai_failover', !aiFailover)}
                disabled={isLoadingSettings}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${aiFailover ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiFailover ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <hr className="border-slate-100" />

            {/* Toggle 2: Email Notifs */}
            <div className="flex items-start justify-between gap-4">
              <div className={`${isLoadingSettings ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                <p className="text-sm font-semibold text-slate-900">Email Notifications</p>
                <p className="text-sm text-slate-500 mt-0.5">Send an email summary when a document batch finishes processing.</p>
              </div>
              <button 
                onClick={() => updateSetting('email_notifications', !emailNotifs)}
                disabled={isLoadingSettings}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${emailNotifs ? 'bg-indigo-600' : 'bg-slate-200'}`}
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
            <button 
              onClick={() => alert("Account deletion requires an administrative Service Role action. This feature is currently disabled.")}
              className="whitespace-nowrap px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Delete Account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}