import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SupabaseProvider from '../components/providers/SupabaseProvider';
import { AssistantWidget } from '@/components/chatbot/AssistantWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'A.X.I.S. | Document Extraction',
  description: 'Automated eXtraction & Integration System',
  icons: {
    icon: '/logo_nobg.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning here only ignores mismatches on THIS
          element (attributes on <body> itself) — it does not suppress
          hydration warnings for children like SupabaseProvider or the
          rest of the tree. This is the documented escape hatch for
          browser extensions (Grammarly, ColorZilla, LanguageTool, etc.)
          that inject data-* attributes into <body> before React hydrates. */}
      <body className={`${inter.className} bg-slate-50`} suppressHydrationWarning>
        <SupabaseProvider>
          <div className="flex flex-col h-screen">
            {/* Header removed successfully */}
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </SupabaseProvider>
        <AssistantWidget />
      </body>
    </html>
  );
}