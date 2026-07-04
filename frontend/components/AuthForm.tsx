"use client";

import React, { useState } from 'react';
import { useSupabase } from './providers/SupabaseProvider';

export default function AuthForm() {
  // Local state for form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Access the Supabase client from our Provider
  const { supabase } = useSupabase();

  // Unified handler for both Sign In and Sign Up
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Sign Up flow
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      } else {
        // Sign In flow
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Centered container with basic padding and max-width for a clean UI/UX
    <div className="flex justify-center items-center min-h-[400px] p-4">
      <div className="w-full max-w-sm p-8 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-6 text-center">
          {isRegistering ? "Create an Account" : "Sign In to AXIS"}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              required 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              required 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {isLoading ? "Processing..." : isRegistering ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <button 
          type="button" 
          onClick={() => setIsRegistering(!isRegistering)}
          className="w-full mt-4 text-sm text-blue-600 hover:underline text-center"
        >
          {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  );
}