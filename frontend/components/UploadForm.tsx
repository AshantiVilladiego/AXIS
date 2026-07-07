"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadResponse } from "../types/api";
import { useSupabase } from "./providers/SupabaseProvider";
import { sendChatMessage, sendFixedPromptRequest } from "@/lib/api"; // Ensure this path matches your project!

interface UploadFormProps {
  apiStatus?: string;
}

interface ExtractedField {
  field_name: string;
  extracted_value: unknown;
  confidence_score?: number;
  text?: string;
  isMagicFilled?: boolean;
}

interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
  steps?: string[];
  // Populated when this message is an AI-generated field question via the
  // [GUIDE]/[OPTIONS] tagged protocol (see chatbot_service.get_field_question).
  guide?: string | null;
  options?: string[];
}

// --- HELPER FUNCTIONS ---
function parsePythonLiteral(input: string): unknown {
  try {
    return JSON.parse(input.replace(/'/g, '"'));
  } catch {
    return input;
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return parsePythonLiteral(trimmed);
    }
    return value;
  }
  return value;
}

// Strips everything but letters/digits and lowercases, so "sss_number",
// "SSNUMBER", and "SsNumber" all normalize to the same lookup key. This is
// necessary because different form types/extractors return field names in
// different conventions (snake_case, dotted-nested, or flat concatenated
// caps copied straight off the printed form).
const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

// Mirrors app/utils/label_humanizer.py's overrides so the client-side
// fallback (used if /api/chatbot/field-question is unreachable) produces
// the same labels as the backend, instead of diverging. Keys here are
// already normalized via normalizeKey.
const LABEL_OVERRIDES: Record<string, string> = {
  ssnumber: "SSS Number",
  sssnumber: "SSS Number",
  mobilenumber: "Mobile Number",
  mobilecellphonenumber: "Mobile / Cellphone Number",
  cellphonenumber: "Mobile / Cellphone Number",
  telephonenumber: "Telephone Number",
  taxidentificationnumber: "Tax ID (TIN)",
  taxpayerid: "Tax ID (TIN)",
  tin: "Tax ID (TIN)",
  zipcode: "ZIP Code",
  emailaddress: "Email Address",
  firstname: "First Name",
  lastname: "Last Name",
  middlename: "Middle Name",
  suffix: "Suffix",
  civilstatus: "Civil Status",
  dateofbirth: "Date of Birth",
  placeofbirth: "Place of Birth",
  barangaydistrictlocality: "Barangay / District / Locality",
  citymunicipality: "City / Municipality",
  houselotblkno: "House/Lot/Blk No.",
  children: "Children",
  otherbeneficiaries: "Other Beneficiaries",
  yearprofbusinessstarted: "Year Profession/Business Started",
  agreetospousemembershipwithsss: "Agree to Spouse Membership with SSS",
};

function formatLabel(key: string): string {
  // Extracted field names may be dotted for nesting (see
  // document_service._flatten, e.g. "part_i.name.last_name"), or may carry
  // an array index like "children[1].lastname". Strip the index and take
  // only the leaf segment — title-casing the whole path produces noise
  // like "Part I Registrant Data Personal Data Name Last Name" instead of
  // just "Last Name".
  const withoutIndex = key.replace(/\[\d+\]/g, "");
  const leaf = withoutIndex.includes(".") ? withoutIndex.split(".").pop()! : withoutIndex;

  const normalized = normalizeKey(leaf);
  if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];

  return leaf.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Flattens a nested object like { part_ii: { ss_number: "123" } } into
// { part_ii.ss_number: "123" } so downstream consumers (the PDF generator,
// the review table, formatLabel's leaf extraction) always deal with simple
// string keys instead of "[object Object]". Uses "." as the nesting
// separator (matching document_service._flatten) rather than "_", since
// leaf field names can themselves contain underscores ("ss_number") and
// mixing the two would make it impossible to tell nesting boundaries from
// word separators.
function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(flat, flattenObject(val as Record<string, unknown>, newKey));
    } else {
      flat[newKey] = val;
    }
  }
  return flat;
}

// Below this confidence, we treat the AI's extraction as a guess and leave
// the field blank rather than risk auto-filling the wrong value — the chat
// wizard will ask the user for it instead.
const CONFIDENCE_THRESHOLD = 0.9;

// Fields with a limited set of standardized answers get clickable chips in
// the chat instead of a free-text box, so the user taps instead of types.
const FIELD_OPTIONS: Record<string, string[]> = {
  civil_status: ["Single", "Married", "Widowed", "Separated", "Annulled"],
  sex: ["Male", "Female"],
  gender: ["Male", "Female"],
  nationality: ["Filipino", "Other"],
  citizenship: ["Filipino", "Other"],
  employment_status: ["Employed", "Self-Employed", "Unemployed", "OFW"],
  employer_type: ["Government", "Private"],
};

function getFieldOptions(fieldName: string | null): string[] | null {
  if (!fieldName) return null;
  const key = fieldName.toLowerCase();
  const matchedKey = Object.keys(FIELD_OPTIONS).find((k) => key.includes(k));
  return matchedKey ? FIELD_OPTIONS[matchedKey] : null;
}

export default function UploadForm({
  apiStatus = "Checking connection...",
}: UploadFormProps) {
  const isOffline = apiStatus === "API Engine Offline" || apiStatus === "Checking connection...";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formType, setFormType] = useState("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<any>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // --- DUAL-BRAIN CHAT STATE ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: "Upload a document, and I'll extract the data. If anything is missing, I'll ask you for it here!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  
  // Slot Filling State
  const [missingFieldsQueue, setMissingFieldsQueue] = useState<string[]>([]);
  const [currentAskingField, setCurrentAskingField] = useState<string | null>(null);
  const [conversationalOverrides, setConversationalOverrides] = useState<Record<string, string>>({});
  
  // Fixed Prompt State
  const [pendingFixedPrompt, setPendingFixedPrompt] = useState<string | null>(null);
  const [selectedDocKey, setSelectedDocKey] = useState<string>('bir_2316');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supabase } = useSupabase();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, pendingFixedPrompt, isChatSending]);

  // Fetch Profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const response = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.data && Object.keys(result.data).length > 0) {
            setProfileData(result.data);
          }
        }
      } catch (err) {
        console.error("Could not load profile data:", err);
      }
    };
    fetchProfile();
  }, [supabase, API_BASE_URL]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  // Guide/options for whichever field is currently being asked about, as
  // returned by the AI's [GUIDE]/[OPTIONS]/[QUESTION] tagged reply. Kept
  // separate from chatMessages so the quick-select chips always reflect
  // the *current* field, not whatever field they were generated for.
  const [currentFieldGuide, setCurrentFieldGuide] = useState<string | null>(null);
  const [currentFieldOptions, setCurrentFieldOptions] = useState<string[] | null>(null);

  // Asks the backend AI to phrase the question for a missing field using
  // the tagged protocol (see chatbot_service.get_field_question) instead
  // of a hardcoded "What is your X?" string built from the raw db key.
  // This is what stops the assistant from asking things like "What is
  // Part I Registrant Data Personal Data Nationality?" — the AI is told
  // the field name once and asked to phrase it in plain language, with an
  // optional short guide and quick-select options if the field has a
  // fixed set of valid answers.
  //
  // Falls back to the plain hardcoded question (and the local
  // FIELD_OPTIONS map, if any) whenever the backend call fails, so a
  // network hiccup or an API outage never leaves the user stuck with no
  // question at all.
  const askAboutField = async (fieldName: string) => {
    setCurrentFieldGuide(null);
    setCurrentFieldOptions(null);

    const useFallback = () => {
      setChatMessages(prev => [...prev, { role: 'bot', text: `What is your ${formatLabel(fieldName)}?` }]);
      setCurrentFieldOptions(getFieldOptions(fieldName));
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/api/chatbot/field-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ field_name: fieldName, language: 'en', model: 'gemini', form_id: formId || undefined }),
      });

      if (!response.ok) { useFallback(); return; }

      const result = await response.json();
      const question: string = result?.reply?.trim() || `What is your ${formatLabel(fieldName)}?`;
      setChatMessages(prev => [...prev, { role: 'bot', text: question }]);
      setCurrentFieldGuide(result?.guide || null);
      setCurrentFieldOptions(Array.isArray(result?.options) && result.options.length > 0 ? result.options : getFieldOptions(fieldName));
    } catch (err) {
      console.error("Field-question request failed, falling back to default phrasing:", err);
      useFallback();
    }
  };

  // --- SLOT FILLING INITIALIZATION ---
  useEffect(() => {
    if (uploadResult?.extracted_data) {
      const extracted = uploadResult.extracted_data as any[];
      const filledData = prepareMagicFillData(extracted, profileData);
      
      const missing = filledData
        .filter(f => {
          const isMissing = !f.text || f.text.toLowerCase() === 'null' || f.text.trim() === '';
          const isNotMagicFilled = !f.isMagicFilled; // Only ask if the Profile Repository didn't have it
          return isMissing && isNotMagicFilled;
        })
        .map(f => f.field_name);

      if (missing.length > 0) {
        setMissingFieldsQueue(missing.slice(1)); 
        setCurrentAskingField(missing[0]); 
        
        setChatMessages(prev => [
          ...prev, 
          { role: 'bot', text: `Document extracted. I'm missing a few things to complete the form.` },
        ]);
        askAboutField(missing[0]);
      } else {
        setChatMessages(prev => [
          ...prev, 
          { role: 'bot', text: "All required fields are ready! Click 'Confirm & Download' below to generate your PDF." }
        ]);
      }
    }
  }, [uploadResult, profileData]);

  // --- THE MASTER CHAT HANDLER ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;
    
    const userText = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');

    // MODE A: SLOT FILLING
    if (currentAskingField) {
      setConversationalOverrides(prev => ({
        ...prev,
        [currentAskingField]: userText
      }));

      if (missingFieldsQueue.length > 0) {
        const nextField = missingFieldsQueue[0];
        setMissingFieldsQueue(prev => prev.slice(1));
        setCurrentAskingField(nextField);
        setTimeout(() => { askAboutField(nextField); }, 500);
      } else {
        setCurrentAskingField(null);
        setCurrentFieldGuide(null);
        setCurrentFieldOptions(null);
        setTimeout(() => {
          setChatMessages(prev => [...prev, { role: 'bot', text: `Perfect, the form is fully populated. Ready to generate the final document!` }]);
        }, 500);
      }
      return;
    }

    // MODE B: AI HELP DESK (Free Chat)
    setIsChatSending(true);
    try {
      const history = chatMessages.map(m => ({
        role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
        text: m.text
      }));

      const result = await sendChatMessage({
        message: userText,
        language: 'en',
        model: 'gemini',
        formContext: { formId: formId || undefined },
        history: history.slice(-6) // Only send the last few messages to save tokens
      });

      setChatMessages(prev => [...prev, { role: 'bot', text: result.reply, steps: result.steps }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble reaching the AI engine. Please try again." }]);
    } finally {
      setIsChatSending(false);
    }
  };

  // --- QUICK-SELECT HANDLER (chip click == typing the same answer + Enter) ---
  const handleOptionSelect = (option: string) => {
    if (!currentAskingField) return;

    setChatMessages(prev => [...prev, { role: 'user', text: option }]);
    setConversationalOverrides(prev => ({ ...prev, [currentAskingField]: option }));

    if (missingFieldsQueue.length > 0) {
      const nextField = missingFieldsQueue[0];
      setMissingFieldsQueue(prev => prev.slice(1));
      setCurrentAskingField(nextField);
      setTimeout(() => { askAboutField(nextField); }, 500);
    } else {
      setCurrentAskingField(null);
      setCurrentFieldGuide(null);
      setCurrentFieldOptions(null);
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'bot', text: `Perfect, the form is fully populated. Ready to generate the final document!` }]);
      }, 500);
    }
  };

  // --- FIXED PROMPT HANDLER ---
  const handleFixedSubmit = async (promptType: string, docKey?: string) => {
    setPendingFixedPrompt(null);
    if (isChatSending) return;

    const displayMessage = docKey 
        ? `Requesting ${promptType.replace('_', ' ')} for ${docKey.toUpperCase().replace('_', ' ')}...`
        : `Asking about ${promptType.replace('_', ' ')}...`;

    setChatMessages(prev => [...prev, { role: 'user', text: displayMessage }]);
    setIsChatSending(true);

    try {
      const result = await sendFixedPromptRequest({
        promptType,
        documentKey: docKey,
        language: 'en',
        model: 'gemini',
      });
      setChatMessages(prev => [...prev, { role: 'bot', text: result.reply, steps: result.steps }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't fetch that information right now." }]);
    } finally {
      setIsChatSending(false);
    }
  };

  const validateFile = (file: File): boolean => {
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Invalid file type. Only PDF, JPG, and PNG documents are supported.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File is too large. Max allowed size is 25MB.`);
      return false;
    }
    return true;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file); setUploadResult(null); setFormId(null);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file); setUploadResult(null); setFormId(null);
      } else { e.target.value = ""; }
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null); setUploadResult(null); setFormId(null);
    setUploadError(null); setConversationalOverrides({});
    setCurrentAskingField(null); setMissingFieldsQueue([]);
    setCurrentFieldGuide(null); setCurrentFieldOptions(null);
    setChatMessages([{ role: 'bot', text: "Upload a document, and I'll extract the data. If anything is missing, I'll ask you for it here!" }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true); setUploadResult(null); setUploadError(null); setFormId(null);
    setConversationalOverrides({});
    setChatMessages([{ role: 'bot', text: "Analyzing your document..." }]);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("form_type", formType);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found. Please log in again.");

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text() || "Upload failed");

      const data = await response.json();
      setFormId(data.id || data.form_details?.id);
      setUploadResult(data as UploadResponse);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "An unexpected error occurred.");
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error while analyzing the document." }]);
    } finally {
      setIsUploading(false);
    }
  };

  const prepareMagicFillData = (fields: any[], profile: any): ExtractedField[] => {
    // Strict, exact field -> profile-key mapping. Lookup keys are normalized
    // (lowercased, alphanumerics only) and matching is exact dictionary
    // lookup — never a substring/.includes() check. Substring matching was
    // the root cause of unrelated boolean/date/checkbox fields silently
    // picking up someone else's data: e.g. "AGREETOSPOUSEMEMBERSHIPWITHSSS"
    // and "YEARPROFBUSINESSSTARTED" both contain the substring "sss"
    // (business + started = "...ss" + "s..."), so the old
    // key.includes('sss') check stamped the SSS number into both of them.
    const PROFILE_FIELD_MAP: Record<string, string> = {
      middlename: 'middleName', mname: 'middleName',
      lastname: 'lastName', surname: 'lastName', familyname: 'lastName', lname: 'lastName',
      firstname: 'firstName', givenname: 'firstName', fname: 'firstName',
      suffix: 'suffix', namesuffix: 'suffix',
      zipcode: 'zipCode', postalcode: 'zipCode',
      barangay: 'barangay', brgy: 'barangay', barangaydistrictlocality: 'barangay',
      province: 'province',
      city: 'city', municipality: 'city', citymunicipality: 'city',
      street: 'street', houselotblkno: 'street', houseno: 'street', housenumber: 'street',
      mobilecellphonenumber: 'contactNumber', mobilenumber: 'contactNumber',
      cellphonenumber: 'contactNumber', cellphone: 'contactNumber', contactnumber: 'contactNumber',
      telephonenumber: 'contactNumber', phonenumber: 'contactNumber', mobile: 'contactNumber',
      taxpayerid: 'tinNumber', taxid: 'tinNumber', tin: 'tinNumber', taxidentificationnumber: 'tinNumber',
      ssnumber: 'sssNumber', sssnumber: 'sssNumber',
      philhealth: 'philhealthNumber', philhealthnumber: 'philhealthNumber',
      pagibig: 'pagibigNumber', hdmf: 'pagibigNumber', pagibignumber: 'pagibigNumber',
      birthdate: 'birthDate', dateofbirth: 'birthDate',
      emailaddress: 'email', email: 'email',
    };

    const findProfileMatch = (fieldName: string): string | undefined => {
      const withoutIndex = (fieldName || '').replace(/\[\d+\]/g, '');
      const leaf = withoutIndex.includes('.') ? withoutIndex.split('.').pop()! : withoutIndex;
      const profileKey = PROFILE_FIELD_MAP[normalizeKey(leaf)];
      if (!profileKey) return undefined;
      const value = profile?.[profileKey];
      return value || undefined;
    };

    const results: ExtractedField[] = [];

    fields.forEach(field => {
      const rawValue = field.extracted_value;
      const isLowConfidence = typeof field.confidence_score === 'number' && field.confidence_score < CONFIDENCE_THRESHOLD;

      const pushLeaf = (flatKey: string, flatVal: unknown) => {
        const profileValue = findProfileMatch(flatKey);
        if (profileValue) {
          results.push({ field_name: flatKey, extracted_value: flatVal, text: profileValue, isMagicFilled: true });
          return;
        }
        // Guard against any residual nested object/array reaching String()
        // and rendering as "[object Object]".
        const safeText = flatVal && typeof flatVal === 'object'
          ? JSON.stringify(flatVal)
          : String(flatVal ?? '');
        results.push({
          field_name: flatKey,
          extracted_value: flatVal,
          confidence_score: field.confidence_score,
          text: isLowConfidence ? '' : safeText,
          isMagicFilled: false,
        });
      };

      // Repeatable sections (e.g. CHILDREN, OTHERBENEFICIARIES) come back as
      // an array. Flatten each entry into its own indexed leaf fields
      // instead of letting the array fall through to String() and render as
      // "[object Object],[object Object]".
      if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) {
          results.push({ ...field, text: '', isMagicFilled: false });
          return;
        }
        rawValue.forEach((item, i) => {
          if (item && typeof item === 'object') {
            const flat = flattenObject(item as Record<string, unknown>, `${field.field_name}[${i + 1}]`);
            Object.entries(flat).forEach(([flatKey, flatVal]) => pushLeaf(flatKey, flatVal));
          } else {
            pushLeaf(`${field.field_name}[${i + 1}]`, item);
          }
        });
        return;
      }

      // Nested object (e.g. { part_ii: { ss_number: "..." } }) -> split into
      // its own flat fields instead of letting it render as "[object Object]"
      // or get sent to the PDF generator as an unusable nested blob.
      if (rawValue && typeof rawValue === 'object') {
        const flat = flattenObject(rawValue as Record<string, unknown>, field.field_name);
        Object.entries(flat).forEach(([flatKey, flatVal]) => pushLeaf(flatKey, flatVal));
        return;
      }

      // PROFILE-FIRST PRIORITY: if the Profile Repository has this value,
      // it is the source of truth and the AI extraction is ignored
      // entirely for this field — this is what stops the AI's guess from
      // ever overriding data the user already verified and saved.
      const profileValue = findProfileMatch(field.field_name);
      if (profileValue) {
        results.push({ ...field, text: profileValue, isMagicFilled: true });
        return;
      }

      // Low-confidence guess: leave blank so it lands in the missing-fields
      // queue and gets asked in chat instead of silently auto-filled.
      results.push({ ...field, text: isLowConfidence ? '' : String(rawValue ?? ''), isMagicFilled: false });
    });

    return results;
  };

  const buildFinalData = () => {
    if (!uploadResult) return [] as ExtractedField[];
    const merged = prepareMagicFillData((uploadResult as any).extracted_data, profileData);
    return merged.map(field =>
      conversationalOverrides[field.field_name]
        ? { ...field, text: conversationalOverrides[field.field_name] }
        : field
    );
  };

  const handleGenerateDocument = async () => {
    const targetId = formId || (uploadResult as any)?.id || uploadResult?.form_details?.id;
    if (!targetId) { alert("⚠️ Error: The Form ID is missing."); return; }

    setIsGenerating(true);
    setChatMessages(prev => [...prev, { role: 'bot', text: "Stamping your data onto the document..." }]);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const finalData = buildFinalData();

      // DEBUG: check this in the browser console if the downloaded PDF comes back empty —
      // it shows exactly what keys/values are being sent to the /generate endpoint.
      console.log("PAYLOAD SENT TO BACKEND:", JSON.stringify(finalData, null, 2));

      // PROFILE ENRICHMENT
      if (Object.keys(conversationalOverrides).length > 0) {
        fetch(`${API_BASE_URL}/profile/update`, {
          method: 'POST', // Use POST since your backend doesn't support PATCH
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify(conversationalOverrides)
        })
        .then(res => {
          if (res.ok) console.log("Profile successfully enriched!");
        })
        .catch(err => console.error("Profile enrichment failed:", err));
      }

      const response = await fetch(`${API_BASE_URL}/api/${targetId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(finalData) 
      });

      if (!response.ok) throw new Error(`Backend Error ${response.status}: ${await response.text()}`);

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AXIS_Filled_Form_${targetId}.pdf`;
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(downloadUrl);
      
      setChatMessages(prev => [...prev, { role: 'bot', text: "Done! Your filled document has been downloaded, and I've securely saved any new answers to your Profile." }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'bot', text: `Generation failed: ${err.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Wraps handleGenerateDocument so the review modal closes once the user
  // confirms, regardless of whether generation succeeds or fails (the
  // success/error message still shows up in the chat either way).
  const handleConfirmAndDownload = async () => {
    setShowReview(false);
    await handleGenerateDocument();
  };

  const extractedFields: ExtractedField[] = Array.isArray(uploadResult?.extracted_data) 
    ? (uploadResult!.extracted_data as unknown as ExtractedField[]) : [];

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header & Upload Controls (Unchanged) */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Ingestion</h2>
          <p className="text-sm text-slate-500 mt-1">Upload government forms for AI-powered extraction and auto-fill.</p>
        </div>
        <div className={`px-3 py-1.5 border rounded-full flex items-center gap-2 ${isOffline ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOffline ? "bg-red-500" : "bg-emerald-500"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isOffline ? "text-red-700" : "text-emerald-700"}`}>{apiStatus}</span>
        </div>
      </div>

      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Document Classification</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select the form type, or let the AI engine auto-detect it.</p>
        </div>
        <select value={formType} onChange={(e) => setFormType(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block p-2.5 outline-none font-medium text-slate-700 w-full md:w-64">
          <option value="auto">✨ Auto-Detect (AI Model)</option>
          <option disabled>──────────</option>
          <option value="bir_2316">BIR Form 2316</option>
          <option value="bir_1701">BIR Form 1701/1701A</option>
          <option value="sss_e1">SSS E-1 (Personal Record)</option>
          <option value="philhealth_pmrf">PhilHealth PMRF</option>
          <option value="pagibig_mdf">Pag-IBIG MDF</option>
        </select>
      </div>

      {uploadError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
          <div><h3 className="text-sm font-bold text-red-800">Upload Failed</h3><p className="text-sm text-red-700 mt-0.5">{uploadError}</p></div>
        </div>
      )}

      <div 
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl transition-all duration-200 py-12 flex flex-col items-center justify-center 
          ${!selectedFile ? "cursor-pointer" : ""}
          ${isDragging ? "border-indigo-500 bg-indigo-50 scale-[1.02]" : selectedFile ? "border-indigo-400 bg-indigo-50/30" : "border-slate-300 bg-white hover:bg-slate-50"}`}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
        {selectedFile ? (
          <div className="text-center w-full px-4">
            <p className="text-lg font-bold text-slate-900 mb-1 truncate max-w-md mx-auto">{selectedFile.name}</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={clearSelection} disabled={isUploading} className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-semibold rounded-lg shadow-sm">Change File</button>
              <button onClick={(e) => { e.stopPropagation(); handleUpload(); }} disabled={isUploading || isOffline} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg shadow-sm">
                {isUploading ? "Extracting..." : "Process Document"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-medium text-slate-900 mb-1">Drop your document here</p>
            <p className="text-sm text-slate-500 mb-4">Supports PDF, JPG, PNG up to 25MB.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        
        {/* Left: Document Preview */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[650px]">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Preview</span>
          </div>
          <div className="flex-1 bg-slate-100/50 relative">
            {previewUrl ? (
              selectedFile?.type.startsWith("image/") 
                ? <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2 absolute inset-0" />
                : <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><p className="text-sm text-slate-400">No document uploaded</p></div>
            )}
          </div>
        </div>

        {/* Right: Omniscient Assistant */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[650px]">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> A.X.I.S. Assistant
            </span>
          </div>

          {/* Compact Verified Data Summary */}
          {extractedFields.length > 0 && (
            <div className="p-3 bg-emerald-50/30 border-b border-emerald-100 max-h-[120px] overflow-y-auto shrink-0 shadow-inner">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                Verified Profile Data applied
              </p>
              <div className="flex flex-wrap gap-1.5">
                {buildFinalData().map((field, idx) => {
                  const displayValue = field.text;
                  if (!displayValue || displayValue === 'null') return null;
                  return (
                    <div key={idx} className="bg-white border border-emerald-200 rounded px-2 py-1 flex gap-1.5 items-center shadow-sm">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{formatLabel(field.field_name)}:</span>
                      <span className="text-[10px] text-slate-800 font-semibold truncate max-w-[120px]">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-5 bg-white">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mr-2 shrink-0">
                    <span className="text-[10px] text-indigo-700 font-bold">AI</span>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] shadow-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-slate-800 text-white rounded-br-sm' : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  
                  {/* Render Steps if they exist */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-900/70">Here's how to fill it in:</p>
                      <ol className="space-y-2">
                        {msg.steps.map((step, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">{idx + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isChatSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 ml-9">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-slate-100 p-3 shrink-0 flex flex-col gap-2">
            
            {/* Fixed Prompt Injection Area */}
            {!currentAskingField && !isChatSending && (
              <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                {pendingFixedPrompt ? (
                  <div className="animate-in slide-in-from-bottom-2 fade-in duration-200 px-1">
                    <p className="text-xs font-semibold mb-1.5 text-slate-700">Select Document Type:</p>
                    <select value={selectedDocKey} onChange={(e) => setSelectedDocKey(e.target.value)} className="w-full p-2 text-xs border rounded-lg focus:ring-1 focus:ring-indigo-600 bg-white mb-2">
                      <option value="bir_2316">BIR Form 2316</option>
                      <option value="bir_1701_1701a">BIR Form 1701/1701A</option>
                      <option value="sss_e1">SSS Form E-1</option>
                      <option value="philhealth_pmrf">PhilHealth PMRF</option>
                      <option value="pagibig_mdf">Pag-IBIG MDF</option>
                    </select>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setPendingFixedPrompt(null)} className="px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                      <button onClick={() => handleFixedSubmit(pendingFixedPrompt, selectedDocKey)} className="px-3 py-1.5 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">Continue</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Or ask me anything...</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setPendingFixedPrompt('walkthrough')} className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm whitespace-nowrap">Walk me through...</button>
                      <button onClick={() => setPendingFixedPrompt('supporting_docs')} className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm whitespace-nowrap">Required Docs</button>
                      <button onClick={() => handleFixedSubmit('sss_profession_business')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm whitespace-nowrap">SSS Profession vs Business</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI Guide Hint: short plain-language explainer for the field being asked about */}
            {currentAskingField && currentFieldGuide && (
              <div className="px-2 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-700 italic animate-in slide-in-from-bottom-1 fade-in duration-300">
                💡 {currentFieldGuide}
              </div>
            )}

            {/* Quick-Select Options: only shown for fields with a fixed set of valid answers.
                Sourced from the AI's per-field response when available, falling back to the
                local FIELD_OPTIONS map if the backend call failed. */}
            {currentAskingField && currentFieldOptions && currentFieldOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1 pb-1 animate-in slide-in-from-bottom-1 fade-in duration-300">
                {currentFieldOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleOptionSelect(option)}
                    disabled={isGenerating || isChatSending}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Main Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                placeholder={
                  currentAskingField 
                    ? `Type your ${formatLabel(currentAskingField)}...` 
                    : "Select an option below to begin..."
                }
                disabled={isGenerating || isUploading || isChatSending || (!currentAskingField && !pendingFixedPrompt)}
                className={`flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm transition-all
                  ${(!currentAskingField && !pendingFixedPrompt) 
                    ? 'bg-slate-100 cursor-not-allowed opacity-50' 
                    : 'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  }`}
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isGenerating || isChatSending || (!currentAskingField && !pendingFixedPrompt)} 
                className="bg-slate-800 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-900 disabled:opacity-30 transition-colors"
              >
                ↑
              </button>
            </form>

            {uploadResult && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Review Data for PDF</h3>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {buildFinalData().map((field, idx) => (
                    <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{formatLabel(field.field_name)}</p>
                      <p className="text-xs text-slate-900 font-medium truncate" title={field.text}>
                        {field.text || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult && (
              <button onClick={() => setShowReview(true)} disabled={isGenerating || currentAskingField !== null} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                {isGenerating ? 'Generating...' : (currentAskingField ? 'Please answer above to continue' : 'Confirm & Download PDF')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Final Review Modal — shows exactly what buildFinalData() will send
          to the /generate endpoint, so the user sees real data (not just
          the saved Profile) before anything downloads. Catches the "empty
          PDF" case by warning explicitly instead of letting an empty
          payload through silently. */}
      {showReview && (() => {
        const reviewFields = buildFinalData().filter(
          (f) => f.text && f.text.toLowerCase() !== 'null' && f.text.trim() !== ''
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
              <h3 className="text-xl font-bold mb-4">Confirm Your Details</h3>

              {reviewFields.length === 0 ? (
                <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  No data is ready to fill in yet. Downloading now will likely produce a blank document — go back and finish answering the assistant's questions first.
                </div>
              ) : (
                <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1">
                  {reviewFields.map((field) => (
                    <div key={field.field_name} className="flex justify-between gap-3 text-sm border-b border-slate-100 pb-1.5 last:border-b-0">
                      <span className="text-slate-500 shrink-0">{formatLabel(field.field_name)}:</span>
                      <span className="text-slate-900 font-medium text-right break-words">{field.text}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowReview(false)} className="w-full py-2 border rounded-lg">Back</button>
                <button
                  onClick={handleConfirmAndDownload}
                  disabled={isGenerating || reviewFields.length === 0}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-300"
                >
                  Confirm & Download
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}