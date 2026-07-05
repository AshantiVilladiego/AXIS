"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from './providers/SupabaseProvider';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { supabase } = useSupabase();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh(); 
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Title */}
      <h2 className="text-2xl font-bold text-center text-slate-900">
        {isRegistering ? "Create your Account" : "Sign In to A.X.I.S."}
      </h2>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input 
            type="email" 
            required 
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-600 outline-none"
            onChange={(e) => setEmail(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input 
            type="password" 
            required 
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-600 outline-none"
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
        >
          {isLoading ? "Processing..." : isRegistering ? "Register" : "Sign In"}
        </button>
      </form>

      <button 
        type="button" 
        onClick={() => setIsRegistering(!isRegistering)}
        className="w-full text-sm text-indigo-600 hover:underline text-center"
      >
        {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register"}
      </button>
    </div>
  );
}