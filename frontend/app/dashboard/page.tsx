"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import UploadForm from '../../components/UploadForm';
import ProfileRepository from '../../components/ProfileRepository';
import ProcessingHistory from '../../components/ProcessingHistory';
import Settings from '../../components/Settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState('Upload Form');
  const [apiStatus, setApiStatus] = useState('Checking connection...');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setApiStatus(data.message); 
      })
      .catch((error) => {
        setApiStatus('API Engine Offline');
        console.error('Connection failed:', error);
      });
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'Upload Form':
        return <UploadForm apiStatus={apiStatus} />;
      case 'Profile Repository':
        return <ProfileRepository />;
      case 'Processing History':
        return <ProcessingHistory />;
      case 'Settings':
        return <Settings />;
      default:
        return null;
    }
  };

  // Helper function to render the correct icon based on the active tab
  const getTabIcon = (tabName: string) => {
    // We use the exact SVG paths from Sidebar.tsx, but colored indigo to match the header!
    switch (tabName) {
      case 'Upload Form':
        return (
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        );
      case 'Profile Repository':
        return (
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'Processing History':
        return (
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'Settings':
        return (
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        
        {/* UPDATED: Header now uses justify-between to push the logo to the right */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
          
          {/* Left Side: Dynamic Icon and Tab Name */}
          <div className="flex items-center gap-3">
            {getTabIcon(activeTab)}
            <h2 className="text-lg font-bold">{activeTab}</h2>
          </div>

          {/* Right Side: Custom Logo */}
          <div className="flex items-center">
            <img 
              src="/logoname_nobg.png" 
              alt="Custom Logo" 
              className="h-18 w-auto object-contain" 
            />
          </div>

        </header>

        <div className="p-8">
           {renderActiveView()}
        </div>
      </main>
    </div>
  );
}