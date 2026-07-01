"use client";

import React, { useState } from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Core navigation configurations with standard dashboard icons
  const navigationItems = [
    {
      name: 'Upload Form',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      name: 'Profile Repository',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      name: 'Processing History',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Settings',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside 
      className={`h-screen bg-slate-900 border-r border-slate-800 text-slate-400 flex flex-col justify-between shrink-0 transition-all duration-300 relative
        ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Top Section: App Branding & Collapse Toggle */}
      <div>
        <div className={`h-16 flex items-center border-b border-slate-800 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 font-black text-xl text-white tracking-wider transition-opacity duration-200">
              <span className="text-blue-500">A.X.I.S.</span>
            </div>
          )}
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg 
              className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation Tabs List */}
        <nav className="p-3 space-y-1.5">
          {navigationItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center rounded-xl transition-all duration-150 group relative
                  ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                  ${isActive 
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/10' 
                    : 'hover:bg-slate-800/60 hover:text-slate-200 font-medium'}`}
              >
                {/* Tab Icon */}
                <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400 transition-colors'}`}>
                  {item.icon}
                </span>

                {/* Tab Label Text - Hidden gracefully when collapsed */}
                <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden
                  ${isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100'}`}
                >
                  {item.name}
                </span>

                {/* Modern Hover Tooltip Popover (Only visible when collapsed) */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none translate-x-2.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap shadow-xl border border-slate-800">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Minimal Footer Strip */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-center bg-slate-950/20 text-[10px] uppercase tracking-wider font-bold text-slate-600">
        {isCollapsed ? <span className="text-blue-500 text-xs">⎔</span> : <span>System v1.0</span>}
      </div>
    </aside>
  );
}