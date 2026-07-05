"use client";
import React from 'react';
import AuthForm from '../components/AuthForm'; 

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <div className="max-w-3xl text-center space-y-6 mb-12">
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
          Automate Your Government Paperwork
        </h1>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <AuthForm /> 
      </div>
    </div>
  );
}