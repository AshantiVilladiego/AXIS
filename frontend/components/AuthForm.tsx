"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from './providers/SupabaseProvider';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  
  const { supabase } = useSupabase();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // Custom Success Modal
        setModalConfig({
          isOpen: true,
          title: 'Check your inbox',
          message: 'We sent a secure confirmation link to your email. Please click it to verify your account before signing in.',
          type: 'success'
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh(); 
      }
    } catch (error: any) {
      // Custom Error Modal
      setModalConfig({
        isOpen: true,
        title: 'Authentication Error',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50">
      
      {/* Main Split Card Container */}
      <div className="flex w-full max-w-5xl bg-white rounded-2xl shadow-2xl shadow-indigo-300 border border-indigo-50 overflow-hidden min-h-150">
        
        {/* LEFT PANEL: Branding & Info (Hidden on small screens) */}
        <div className="hidden md:flex flex-col justify-center p-12 w-1/2 bg-slate-900 text-white relative">
          
          {/* Faint background decoration */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-start h-full justify-center">
            {/* Logo */}
            
              <img 
                src="/logo_nobg_inv2.png" 
                alt="AXIS Logo" 
                className="w-30 h-30 object-contain" 
              />

            {/* Titles */}
            <h1 className="text-4xl font-black tracking-wider mb-2">A.X.I.S.</h1>
            <h2 className="text-xs font-semibold text-indigo-400 tracking-widest uppercase mb-8">
              Automated eXtraction & Integration System
            </h2>

            {/* Description */}
            <div className="space-y-4 text-slate-300 text-sm leading-relaxed mb-10">
              <p>
                Say goodbye to manual data entry and tedious repetitive paperwork. A.X.I.S. is designed to instantly read, extract, and securely map your personal data directly onto official forms.
              </p>
              <p>
                Whether you are managing tax documents or setting up healthcare records, our AI engine ensures accuracy and speeds up your workflow in seconds.
              </p>
            </div>

            {/* Small Motto */}
            <div className="border-l-2 border-indigo-500 pl-3">
              <p className="text-slate-400 text-xs tracking-wide italic">
                "Automate your government paperwork."
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: The Form */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white relative">
          
          {/* Custom Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl mb-10">
            <button 
              onClick={() => setIsRegistering(false)} 
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${!isRegistering ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsRegistering(true)} 
              type="button"
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${isRegistering ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">
              {isRegistering ? "Secure Access" : "Welcome Back"}
            </h3>
            <h2 className="text-3xl font-black text-slate-900">
              {isRegistering ? "Create your account" : "Sign in to your dashboard"}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {isRegistering ? "Register with your email to begin processing documents." : "Enter your credentials to continue managing your records."}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email *</label>
              <input 
                type="email" 
                required 
                placeholder="you@email.com"
                value={email}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all text-slate-900 placeholder:text-slate-400"
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password *</label>
              <input 
                type="password" 
                required 
                placeholder="Minimum 8 characters"
                value={password}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all text-slate-900 placeholder:text-slate-400"
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-4 mt-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:pointer-events-none disabled:shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                isRegistering ? "Create Account" : "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* --- CUSTOM DIALOGUE MODAL --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all border border-slate-100">
            
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${modalConfig.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {modalConfig.type === 'success' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">{modalConfig.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{modalConfig.message}</p>
            
            <button 
              onClick={closeModal}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
            >
              Okay, got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}