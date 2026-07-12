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
    // Dynamically get the base URL
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
    
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
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

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="p-8">
           {renderActiveView()}
        </div>
      </main>
    </div>
  );
}