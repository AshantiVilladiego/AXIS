import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SupabaseProvider from '../components/providers/SupabaseProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'A.X.I.S. | Document Extraction',
  description: 'Automated eXtraction & Integration System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50`}>
        <SupabaseProvider>
          <div className="flex flex-col h-screen">
            {/* Header removed successfully */}
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}