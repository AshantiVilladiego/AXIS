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
      className={`h-screen bg-slate-900 border-r border-slate-800 text-slate-400 flex flex-col justify-between shrink-0 transition-all duration-300 relative z-20
        ${isCollapsed ? 'w-20' : 'w-72'}`}
    >
      {/* NEW: Floating Toggle Button moved outside to hang on the border perfectly */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-10 -right-3.5 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-all z-50 shadow-md"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <svg 
          className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        
        {/* Top Section: App Branding */}
        <div className="p-5 border-b border-slate-800/80 relative min-h-24 flex flex-col justify-center">
          <div className={`flex items-center gap-4 ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
            
            {/* RESTORED: The Logo Box Placeholder */}
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img 
                src="/logo_nobg.png" 
                alt="AXIS Logo" 
                className="w-8 h-8 object-contain" 
              />
            </div>

            {/* Titles (Hidden when collapsed) */}
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <span className="font-black text-2xl text-white tracking-wide">A.X.I.S.</span>
                <span className="text-[11px] text-slate-400 font-medium truncate mt-0.5">Automated eXtraction & Integration</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Area */}
        <div className="p-4">
          
          {/* Faint NAVIGATION title */}
          {!isCollapsed && (
            <div className="px-3 pb-3 pt-1 text-[10px] font-bold text-slate-500 tracking-widest uppercase transition-opacity duration-200">
              Navigation
            </div>
          )}
          {isCollapsed && <div className="h-6"></div>}

          {/* Navigation Tabs List */}
          <nav className="space-y-1.5">
            {navigationItems.map((item) => {
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center rounded-xl transition-all duration-150 group relative
                    ${isCollapsed ? 'justify-center p-3' : 'px-4 py-3'}
                    ${isActive 
                      ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20' 
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 font-medium'}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    {/* Tab Icon */}
                    <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400 transition-colors'}`}>
                      {item.icon}
                    </span>

                    {/* Tab Label Text */}
                    <span className={`text-[15px] whitespace-nowrap transition-all duration-300 overflow-hidden text-left flex-1
                      ${isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100'}`}
                    >
                      {item.name}
                    </span>

                    {/* Chevron Arrow on Active Tab */}
                    {!isCollapsed && isActive && (
                      <svg className="w-4 h-4 text-indigo-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>

                  {/* Tooltip */}
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
      </div>

      {/* Bottom Minimal Footer Strip */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-center bg-slate-950/20 text-[10px] uppercase tracking-wider font-bold text-slate-600">
        {isCollapsed ? <span className="text-indigo-500 text-xs">⎔</span> : <span>System v1.0</span>}
      </div>
    </aside>
  );
}
