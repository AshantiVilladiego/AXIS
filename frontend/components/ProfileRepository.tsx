"use client";

import React, { useState, useEffect } from 'react';
import { useSupabase } from './providers/SupabaseProvider'; 

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Define the shape of our profile data.
// NOTE: name and address are stored ATOMICALLY (separate fields) rather
// than as single "fullName"/"address" strings. This is what lets the
// upload wizard confidently auto-fill a form's individual "Last Name" or
// "Barangay" box from the profile without guessing how to split a single
// string — which was previously causing the same full name to get stamped
// into First/Middle/Last simultaneously.
interface UserProfile {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  contactNumber: string;
  tinNumber: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
}

const EMPTY_PROFILE: UserProfile = {
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  birthDate: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  contactNumber: '',
  tinNumber: '',
  sssNumber: '',
  philhealthNumber: '',
  pagibigNumber: '',
};

// Lightweight format validation. Only fires on fields the user has
// actually typed something into, so a half-filled form doesn't light up
// red everywhere — but it stops obviously malformed data (a TIN missing
// digits, a mobile number that isn't a PH mobile number) from ever being
// saved and later silently breaking PDF generation.
const VALIDATORS: Partial<Record<keyof UserProfile, { pattern: RegExp; message: string }>> = {
  contactNumber: { pattern: /^(09\d{9}|\+639\d{9})$/, message: 'Use format 09XXXXXXXXX or +639XXXXXXXXX' },
  tinNumber: { pattern: /^\d{3}-?\d{3}-?\d{3}(-?\d{3})?$/, message: 'TIN should be 9-12 digits, e.g. 000-000-000' },
  sssNumber: { pattern: /^\d{2}-?\d{7}-?\d{1}$/, message: 'SSS number should look like 00-0000000-0' },
  philhealthNumber: { pattern: /^\d{2}-?\d{9}-?\d{1}$/, message: 'PhilHealth number should look like 00-000000000-0' },
  pagibigNumber: { pattern: /^\d{4}-?\d{4}-?\d{4}$/, message: 'Pag-IBIG number should look like 0000-0000-0000' },
  zipCode: { pattern: /^\d{4}$/, message: 'ZIP code should be 4 digits' },
};

// The backend returns `null` (not `undefined`) for text columns that were
// never set, since that's how Postgres represents "no value" for a
// nullable text field. Left as-is, that null flows straight into
// profileData and blows up the first .trim() call anyone makes on it
// (validateProfile, form inputs, the upload wizard's profile matching,
// etc). Coercing to '' here means every other consumer of profileData can
// safely assume its fields are always strings.
function sanitizeProfile(raw: Partial<UserProfile>): Partial<UserProfile> {
  const clean: Partial<UserProfile> = {};
  (Object.keys(EMPTY_PROFILE) as (keyof UserProfile)[]).forEach((key) => {
    if (key in raw) {
      clean[key] = raw[key] ?? '';
    }
  });
  return clean;
}

function validateProfile(data: UserProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  (Object.keys(VALIDATORS) as (keyof UserProfile)[]).forEach((key) => {
    const value = (data[key] || '').trim();
    if (!value) return; // don't nag about empty optional fields
    const rule = VALIDATORS[key]!;
    if (!rule.pattern.test(value)) {
      errors[key] = rule.message;
    }
  });
  if (!(data.firstName || '').trim()) errors.firstName = 'First name is required';
  if (!(data.lastName || '').trim()) errors.lastName = 'Last name is required';
  return errors;
}

export default function ProfileRepository() {
  // 1. Initialize the Supabase client from your provider
  const { supabase } = useSupabase(); 

  const [profileData, setProfileData] = useState<UserProfile>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // 2. Fetch data when the component mounts
  const fetchProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsLoading(false); return; }

      const response = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} while loading your profile.`);
      }

      const result = await response.json();
      if (result.data && Object.keys(result.data).length > 0) {
        setProfileData((prev) => ({ ...prev, ...sanitizeProfile(result.data) }));
      } else if (session.user?.email) {
        // First-time user: pre-fill email from the auth session so the
        // initial save doesn't hit the NOT NULL constraint on email.
        setProfileData((prev) => ({ ...prev, email: session.user.email! }));
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      // Surface this instead of silently leaving a blank form — the user
      // needs to know their saved data may not have loaded, rather than
      // assuming an empty form means "nothing saved yet."
      setLoadError(error instanceof Error ? error.message : "Couldn't load your saved profile. Please refresh to try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // 3. Handle input changes dynamically, with live validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...profileData, [name]: value };
    setProfileData(updated);
    // Re-validate just this field so errors clear the moment they're fixed,
    // instead of only re-checking on submit.
    setErrors((prev) => {
      const next = { ...prev };
      const fieldErrors = validateProfile(updated);
      if (fieldErrors[name]) next[name] = fieldErrors[name];
      else delete next[name];
      return next;
    });
  };

  // 4. Save the data to the backend API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    const validationErrors = validateProfile(profileData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatusMessage({ type: 'error', text: 'Please fix the highlighted fields before saving.' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in.");

      const response = await fetch(`${API_BASE_URL}/profile/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ data: profileData })
      });

      if (!response.ok) {
        // This attempts to read FastAPI's detailed error message
        const errorDetails = await response.text(); 
        console.error(`Backend rejected with status ${response.status}:`, errorDetails);
        
        // Try to parse it as JSON to show a clean message, otherwise show generic
        try {
          const parsed = JSON.parse(errorDetails);
          throw new Error(parsed.detail || `Server Error: ${response.status}`);
        } catch {
          throw new Error(`Server Error: ${response.status}`);
        }
      }

      setStatusMessage({ type: 'success', text: 'Profile successfully saved to your encrypted vault.' });
      
      setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);

    } catch (error: any) {
      console.error("Save error:", error);
      setStatusMessage({ type: 'error', text: error.message || "An error occurred while saving." });
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass = (name: keyof UserProfile) =>
    `px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all ${
      errors[name] ? 'border-red-400 bg-red-50' : 'border-slate-200'
    }`;

  if (isLoading) {
    return <div className="animate-pulse text-slate-500">Decrypting your vault...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profile Repository</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your Personally Identifiable Information (PII) for automated form filling.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-100 px-3 py-1.5 rounded-md">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          <span className="font-medium">End-to-End Encrypted</span>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-red-800">Couldn't load your profile</h3>
            <p className="text-sm text-red-700 mt-0.5">{loadError}</p>
          </div>
          <button onClick={fetchProfile} className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
            Retry
          </button>
        </div>
      )}

      {/* Form Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden relative">
        <form onSubmit={handleSave} className="flex flex-col h-full">
          <div className="p-6 md:p-8 space-y-8 flex-1">
            
            {/* Section 1: Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-indigo-600">1.</span> Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    name="email"
                    value={profileData.email ?? ''}
                    onChange={handleChange}
                    placeholder="juan.delacruz@email.com" 
                    className={fieldClass('email')}
                  />
                </div>

                {/* Atomic name fields — each maps to exactly one PDF box, so
                    it can be auto-filled with confidence instead of guessing
                    how to split a single "Full Name" string. */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">First Name</label>
                  <input 
                    type="text" name="firstName" value={profileData.firstName ?? ''} onChange={handleChange}
                    placeholder="Juan" className={fieldClass('firstName')}
                  />
                  {errors.firstName && <span className="text-xs text-red-600">{errors.firstName}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Middle Name</label>
                  <input 
                    type="text" name="middleName" value={profileData.middleName ?? ''} onChange={handleChange}
                    placeholder="Santos (optional)" className={fieldClass('middleName')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Last Name</label>
                  <input 
                    type="text" name="lastName" value={profileData.lastName ?? ''} onChange={handleChange}
                    placeholder="dela Cruz" className={fieldClass('lastName')}
                  />
                  {errors.lastName && <span className="text-xs text-red-600">{errors.lastName}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Suffix</label>
                  <input 
                    type="text" name="suffix" value={profileData.suffix ?? ''} onChange={handleChange}
                    placeholder="Jr., Sr., III (optional)" className={fieldClass('suffix')}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Birth Date</label>
                  <input 
                    type="date" 
                    name="birthDate"
                    value={profileData.birthDate ?? ''}
                    onChange={handleChange}
                    className={`${fieldClass('birthDate')} text-slate-700`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Contact Number</label>
                  <input 
                    type="tel" 
                    name="contactNumber"
                    value={profileData.contactNumber ?? ''}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX" 
                    className={fieldClass('contactNumber')}
                  />
                  {errors.contactNumber && <span className="text-xs text-red-600">{errors.contactNumber}</span>}
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Section 2: Address (atomic, matches how PH government forms are boxed) */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-indigo-600">2.</span> Home Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">House No. / Street</label>
                  <input 
                    type="text" name="street" value={profileData.street ?? ''} onChange={handleChange}
                    placeholder="123 Sampaguita St." className={fieldClass('street')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Barangay</label>
                  <input 
                    type="text" name="barangay" value={profileData.barangay ?? ''} onChange={handleChange}
                    placeholder="Brgy. West Kamias" className={fieldClass('barangay')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">City / Municipality</label>
                  <input 
                    type="text" name="city" value={profileData.city ?? ''} onChange={handleChange}
                    placeholder="Quezon City" className={fieldClass('city')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Province</label>
                  <input 
                    type="text" name="province" value={profileData.province ?? ''} onChange={handleChange}
                    placeholder="Metro Manila" className={fieldClass('province')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">ZIP Code</label>
                  <input 
                    type="text" name="zipCode" value={profileData.zipCode ?? ''} onChange={handleChange}
                    placeholder="1100" className={fieldClass('zipCode')}
                  />
                  {errors.zipCode && <span className="text-xs text-red-600">{errors.zipCode}</span>}
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Section 3: Government IDs */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-indigo-600">3.</span> Government Identification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Taxpayer ID (TIN)</label>
                  <input 
                    type="text" 
                    name="tinNumber"
                    value={profileData.tinNumber ?? ''}
                    onChange={handleChange}
                    placeholder="000-000-000-000" 
                    className={`${fieldClass('tinNumber')} font-mono text-sm`}
                  />
                  {errors.tinNumber && <span className="text-xs text-red-600">{errors.tinNumber}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">SSS Number</label>
                  <input 
                    type="text" 
                    name="sssNumber"
                    value={profileData.sssNumber ?? ''}
                    onChange={handleChange}
                    placeholder="00-0000000-0" 
                    className={`${fieldClass('sssNumber')} font-mono text-sm`}
                  />
                  {errors.sssNumber && <span className="text-xs text-red-600">{errors.sssNumber}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">PhilHealth Number</label>
                  <input 
                    type="text" 
                    name="philhealthNumber"
                    value={profileData.philhealthNumber ?? ''}
                    onChange={handleChange}
                    placeholder="00-000000000-0" 
                    className={`${fieldClass('philhealthNumber')} font-mono text-sm`}
                  />
                  {errors.philhealthNumber && <span className="text-xs text-red-600">{errors.philhealthNumber}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Pag-IBIG Number</label>
                  <input 
                    type="text" 
                    name="pagibigNumber"
                    value={profileData.pagibigNumber ?? ''}
                    onChange={handleChange}
                    placeholder="0000-0000-0000" 
                    className={`${fieldClass('pagibigNumber')} font-mono text-sm`}
                  />
                  {errors.pagibigNumber && <span className="text-xs text-red-600">{errors.pagibigNumber}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action & Status Message */}
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center mt-auto">
            <div className="flex-1">
              {statusMessage.text && (
                <span className={`text-sm font-medium ${statusMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {statusMessage.text}
                </span>
              )}
            </div>
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2 min-w-[160px] justify-center"
            >
              {isSaving ? 'Saving...' : 'Save Profile Data'}
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}