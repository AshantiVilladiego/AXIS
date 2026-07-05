"use client";

import { createBrowserClient } from '@supabase/ssr';
import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';

// Initialize Supabase Client
// We use NEXT_PUBLIC variables as these are safe to expose to the browser
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define the shape of our context for TypeScript support
// This allows any component to access the client, user, and session
const SupabaseContext = createContext<{
  supabase: typeof supabase;
  user: User | null;
  session: Session | null;
}>({
  supabase,
  user: null,
  session: null,
});

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Get initial session on component mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes (login, logout, token refresh)
    // This ensures our UI is always in sync with the actual auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Clean up the subscription when the provider unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase, user, session }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook for easy access to auth state across the application
export const useSupabase = () => useContext(SupabaseContext);