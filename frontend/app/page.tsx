"use client"; // This is required to use React State in Next.js App Router

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import UploadForm from '../components/UploadForm';
import ProfileRepository from '../components/ProfileRepository';
import ProcessingHistory from '../components/ProcessingHistory';
import Settings from '../components/Settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState('Upload Form');
  const [apiStatus, setApiStatus] = useState('Checking connection...');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setApiStatus(data.message); // Should say "A.X.I.S. API Engine is operational"
      })
      .catch((error) => {
        setApiStatus('API Engine Offline');
        console.error('Connection failed:', error);
      });
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'Upload Form':
        // --- PROP PASSED HERE ---
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

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 shrink-0">
          <h2 className="text-lg font-bold">{activeTab}</h2>
        </header>
        <div className="p-8">
           {renderActiveView()}
        </div>
      </main>
    </div>);
}
