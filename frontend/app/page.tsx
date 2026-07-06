"use client";

import React from 'react';
import AuthForm from '../components/AuthForm'; 

export default function LandingPage() {
  // The AuthForm component now contains the full-screen background, 
  // the split-card layout, and all the branding text.
  return (
    <main>
      <AuthForm /> 
    </main>
  );
}