"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadResponse } from "../types/api";
import { useSupabase } from "./providers/SupabaseProvider";
import { sendChatMessage, sendFixedPromptRequest } from "@/lib/api";

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
  guide?: string | null;
  options?: string[];
}

const CONFIDENCE_THRESHOLD = 0.90;

function parsePythonLiteral(input: string): unknown {
  try { return JSON.parse(input.replace(/'/g, '"')); } catch { return input; }
}

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const LABEL_OVERRIDES: Record<string, string> = {
  ssnumber: "SSS Number", sssnumber: "SSS Number",
  mobilenumber: "Mobile Number", mobilecellphonenumber: "Mobile / Cellphone Number",
  taxpayerid: "Tax ID (TIN)", tin: "Tax ID (TIN)", taxidentificationnumber: "Tax ID (TIN)",
  zipcode: "ZIP Code", emailaddress: "Email Address", firstname: "First Name",
  lastname: "Last Name", middlename: "Middle Name", suffix: "Suffix",
  civilstatus: "Civil Status", dateofbirth: "Date of Birth",
  citymunicipalityprovince: "City & Province",
  barangaydistrictlocality: "Barangay / District",
  roomfloorunitbuildingname: "Unit / Room / Floor / Bldg",
  professionbusiness: "Profession / Business"
};

const FIELD_VALIDATORS: Record<string, { regex: RegExp; errorMessage: string }> = {
  sssnumber: { regex: /^(\d{2}-\d{7}-\d{1}|\d{10})$/, errorMessage: "Invalid SSS Number (e.g., 01-2345678-9)." },
  taxpayerid: { regex: /^(\d{3}-\d{3}-\d{3}-\d{3}|\d{9}|\d{12})$/, errorMessage: "Invalid TIN." },
  mobilecellphonenumber: { regex: /^(09|\+639)\d{9}$/, errorMessage: "Use PH mobile format (e.g., 09171234567)." },
};

const isEmptyish = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'none' || s === 'n/a' || s === 'na' || s === 'undefined';
};

const isValidText = (text: string) => text.length >= 2 && !/^(.)\1{3,}$/.test(text);

function formatLabel(key: string): string {
  const leaf = key.includes(".") ? key.split(".").pop()! : key;
  const normalized = normalizeKey(leaf);
  if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];
  return leaf.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(flat, flattenObject(val as Record<string, unknown>, newKey));
    } else { flat[newKey] = val; }
  }
  return flat;
}

const FIELD_OPTIONS: Record<string, string[]> = {
  civil_status: ["Single", "Married", "Widowed", "Separated", "Annulled"],
  sex: ["Male", "Female"],
};

function getFieldOptions(fieldName: string | null): string[] | null {
  if (!fieldName) return null;
  const leaf = fieldName.includes(".") ? fieldName.split(".").pop()! : fieldName;
  const matchedKey = Object.keys(FIELD_OPTIONS).find((k) => leaf.toLowerCase().includes(k));
  return matchedKey ? FIELD_OPTIONS[matchedKey] : null;
}

// The chatbot only ever sent the bare leaf ("lastname") when asking about a
// missing field, so "children[1].lastname" and "children[2].lastname" (and
// the registrant's own "name.last_name") all produced the identical question
// "What is your Last Name?" with no way to tell which person it meant. This
// derives a human-readable question that names the group (and, for repeated
// groups like children, the index) instead.
const GROUP_PREFACES: Record<string, { tl: string; en: string }> = {
  children: { tl: "anak", en: "child" },
  child: { tl: "anak", en: "child" },
  spouse_name: { tl: "asawa", en: "spouse" },
  spouse: { tl: "asawa", en: "spouse" },
  father_name: { tl: "ama", en: "father" },
  father: { tl: "ama", en: "father" },
  mother_name: { tl: "ina", en: "mother" },
  mother: { tl: "ina", en: "mother" },
  other_beneficiary: { tl: "beneficiary", en: "beneficiary" },
  beneficiary: { tl: "beneficiary", en: "beneficiary" },
};

function formatContextualLabel(fieldName: string, lang: 'en' | 'tl'): string {
  const parts = fieldName.split('.');
  const leaf = parts.pop() ?? fieldName;
  const label = formatLabel(leaf);
  const groupRaw = parts[0] || '';

  if (!groupRaw) {
    return lang === 'tl' ? `Ano po ang inyong ${label}?` : `What is your ${label}?`;
  }

  const indexMatch = groupRaw.match(/\[(\d+)\]/);
  const groupKey = groupRaw.replace(/\[\d+\]/, '').toLowerCase();
  const preface = GROUP_PREFACES[groupKey] || { tl: groupKey.replace(/_/g, ' '), en: groupKey.replace(/_/g, ' ') };
  const who = indexMatch
    ? `${preface[lang]} #${indexMatch[1]}`
    : preface[lang];

  return lang === 'tl'
    ? `Ano po ang ${label} ng inyong ${who}?`
    : `What is the ${label} of your ${who}?`;
}

export default function UploadForm({ apiStatus = "Checking connection..." }: UploadFormProps) {
  const isOffline = apiStatus === "API Engine Offline" || apiStatus === "Checking connection...";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formType, setFormType] = useState("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [profileData, setProfileData] = useState(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const [language, setLanguage] = useState<"en" | "tl">("tl");
  const [editableData, setEditableData] = useState<Record<string, string>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: 'bot', text: "Mag-upload po ng dokumento para ma-extract ko ang data. Kung may kulang, tatanungin ko po kayo dito!" }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  const [missingFieldsQueue, setMissingFieldsQueue] = useState<string[]>([]);
  const [currentAskingField, setCurrentAskingField] = useState<string | null>(null);
  const [conversationalOverrides, setConversationalOverrides] = useState<Record<string, string>>({});

  const [pendingFixedPrompt, setPendingFixedPrompt] = useState<string | null>(null);
  const [selectedDocKey, setSelectedDocKey] = useState('bir_2316');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supabase } = useSupabase();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (!uploadResult && chatMessages.length <= 1) {
      setChatMessages([{ role: 'bot', text: language === 'tl'
        ? "Mag-upload po ng dokumento para ma-extract ko ang data. Kung may kulang, tatanungin ko po kayo dito! Pwede mo rin akong tanungin bago ka mag upload."
        : "Upload a document, and I'll extract the data. If anything is missing, I'll ask you for it here! You can also ask me general questions before uploading." }]);
    }
  }, [language]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, pendingFixedPrompt, isChatSending]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Ensure clean base URL without trailing slashes
        const baseUrl = (API_BASE_URL || "").replace(/\/$/, "");
        
        // 2. Fetch from the correct /api/v1/ endpoint structure
        // If your profile route is named differently in Swagger (/docs), update "/api/v1/profile" below:
        const response = await fetch(`${API_BASE_URL}/profile`, { 
          headers: { 
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          } 
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data && Object.keys(result.data).length > 0) {
            setProfileData(result.data);
          }
        } else {
          // Gracefully log non-200 responses without crashing the React component
          console.warn(`[Profile Load] Endpoint returned status: ${response.status} (${response.statusText})`);
        }
      } catch (err) { 
        // Prevents unhandled network drops or CORS blocks from triggering "Failed to fetch"
        console.error("[Profile Load] Network communication error:", err); 
      }
    };

    fetchProfile();
  }, [supabase, API_BASE_URL]);

  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return; }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const [currentFieldGuide, setCurrentFieldGuide] = useState<string | null>(null);
  const [currentFieldOptions, setCurrentFieldOptions] = useState<string[] | null>(null);

  const askAboutField = async (fieldName: string) => {
    setCurrentFieldGuide(null);
    setCurrentFieldOptions(null);

    // Only send the leaf node as `field_name` (kept for backend compatibility
    // — long JSON paths aren't useful to whatever prompts the backend's own
    // question-generation), but also pass the full path as `field_path` so
    // the backend has the option to disambiguate "which child/relative" too,
    // and use the contextual label locally for the fallback question so it
    // isn't ambiguous even when the backend call fails.
    const leafName = fieldName.includes('.') ? fieldName.split('.').pop()! : fieldName;

    const useFallback = () => {
      setChatMessages(prev => [...prev, { role: 'bot', text: formatContextualLabel(fieldName, language) }]);
      setCurrentFieldOptions(getFieldOptions(leafName));
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/api/chatbot/field-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ field_name: leafName, field_path: fieldName, language: language, model: 'gemini', form_id: formId || undefined }),
      });

      if (!response.ok) { useFallback(); return; }

      const result = await response.json();
      const question: string = result?.reply?.trim() || formatContextualLabel(fieldName, language);
      setChatMessages(prev => [...prev, { role: 'bot', text: question }]);
      setCurrentFieldGuide(result?.guide || null);
      setCurrentFieldOptions(Array.isArray(result?.options) && result.options.length > 0 ? result.options : getFieldOptions(leafName));
    } catch (err) { useFallback(); }
  };

  useEffect(() => {
    if (uploadResult?.extracted_data) {
      const extracted = uploadResult.extracted_data as any[];

      // An empty array is still truthy, so without this check a failed/blank
      // extraction sails straight through to "0 fields missing" below and
      // gets reported as complete even though nothing was extracted.
      // --- ADD THIS GUARD CLAUSE ---
      if (extracted.length === 0) {
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' 
          ? "⚠️ Walang nakuhang data. Pakisuri ang file o tingnan ang connection." 
          : "⚠️ No data was extracted. Please check your file or connection." }]);
        return; // Stop the function here
      }

      const filledData = prepareMagicFillData(extracted, profileData, (uploadResult as any)?.self_field_groups || []);

      const rawMissing = filledData
        .filter(f => isEmptyish(f.text) && !f.isMagicFilled)
        .map(f => f.field_name);

      const uniqueMissing: string[] = [];
      const seenConcepts = new Set<string>();
      
      // Expanded Junk Keywords list to catch more admin fields
      const JUNK_KEYWORDS = [
        'date', 'signature', 'thumb', 'index', 'msc', 'approved', 'disapproved', 
        'working_spouse', 'payment', 'contribution', 'printed_name', 'receipt', 
        'received', 'certification', 'remarks', 'representative'
      ];

      rawMissing.forEach(field => {
          const leaf = field.includes('.') ? field.split('.').pop()! : field;
          let concept = normalizeKey(leaf);
          
          if (JUNK_KEYWORDS.some(junk => concept.includes(normalizeKey(junk)))) return; 

          if (['gender', 'sex', 'sexcheckbox'].includes(concept)) concept = 'sex';
          if (['civilstatus', 'status', 'maritalstatus'].includes(concept)) concept = 'civilstatus';
          if (['zip', 'zipcode', 'postalcode'].includes(concept)) concept = 'zipcode';
          if (['mobile', 'cellphone', 'contactnumber', 'phonenumber'].includes(concept)) concept = 'mobile';
          if (['tin', 'taxid', 'taxidentificationnumber'].includes(concept)) concept = 'tin';
          if (['email', 'emailaddress'].includes(concept)) concept = 'email';
          
          if (!seenConcepts.has(concept)) {
              seenConcepts.add(concept);
              uniqueMissing.push(field);
          }
      });

      const hasAnyUsableData = filledData.some(f => !isEmptyish(f.text));

      if (uniqueMissing.length > 0) {
        setMissingFieldsQueue(uniqueMissing.slice(1)); 
        setCurrentAskingField(uniqueMissing[0]); 
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? `Na-extract ko na ang dokumento. May konting kulang po para makumpleto.` : `Document extracted. I'm missing a few things to complete the form.` }]);
        askAboutField(uniqueMissing[0]);
      } else if (!hasAnyUsableData) {
        // Nothing is "missing" per the junk/concept filters, but nothing
        // usable came out of extraction either (e.g. every field was junk-
        // filtered or came back empty) — don't report this as complete.
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl'
          ? "⚠️ Walang nakuhang data mula sa dokumento. Pakisuri kung malinaw ang na-upload na file."
          : "⚠️ No usable data could be extracted from this document. Please check that the uploaded file is clear and try again." }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? "Kumpleto na! I-click ang 'Review & Download PDF'." : "All required fields are ready! Click 'Review & Download PDF' below." }]);
      }
    }
  }, [uploadResult, profileData]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;

    const userText = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');

    if (currentAskingField) {
      const cleanInput = userText.trim();
      const normalizedField = normalizeKey(currentAskingField.includes('.') ? currentAskingField.split('.').pop()! : currentAskingField);
      const validator = FIELD_VALIDATORS[normalizedField];
      
      if (validator && !validator.regex.test(cleanInput)) {
        setChatMessages(prev => [...prev, { role: 'bot', text: `⚠️ ${validator.errorMessage}` }]);
        return; 
      }

      if (!validator && !isValidText(cleanInput) && cleanInput.toUpperCase() !== "N/A" && cleanInput.toUpperCase() !== "WALA") {
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? `⚠️ Paki-lagay po ng tamang sagot, o i-type ang 'N/A' kung wala.` : `⚠️ Please provide a valid value, or type 'N/A' if it doesn't apply.` }]);
        return;
      }

      setConversationalOverrides(prev => ({ ...prev, [currentAskingField]: cleanInput }));

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
          setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? `Perfect, kumpleto na po! Ready to review na.` : `Perfect, the form is fully populated. Ready to review!` }]);
        }, 500);
      }
      return;
    }

    setIsChatSending(true);
    try {
      const history = chatMessages.map(m => ({ role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user', text: m.text }));
      // Leaf field names still blank, so free-chat answers can be matched
      // to a real field the same way slot-filling questions already are.
      // NOTE: must stay the FULL field_name (not leaf-stripped) — that's
      // the exact key conversationalOverrides is read by in buildFinalData().
      const missingFields = extractedFields
        .filter(f => isEmptyish(f.text) && !conversationalOverrides[f.field_name])
        .map(f => f.field_name);
      const result = await sendChatMessage({ message: userText, language: language, model: 'gemini', formContext: { formId: formId || undefined }, history: history.slice(-6), missingFields });
      setChatMessages(prev => [...prev, { role: 'bot', text: result.reply, steps: result.steps }]);
      if (result.fieldUpdates && Object.keys(result.fieldUpdates).length > 0) {
        setConversationalOverrides(prev => ({ ...prev, ...result.fieldUpdates }));
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? "Pasensya na, may error sa server." : "Sorry, I had trouble reaching the AI engine." }]);
    } finally { setIsChatSending(false); }
  };

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
        setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? `Perfect, kumpleto na po! Ready to review na.` : `Perfect, the form is fully populated. Ready to review!` }]);
      }, 500);
    }
  };

  const handleFixedSubmit = async (promptType: string, docKey?: string) => {
    setPendingFixedPrompt(null);
    if (isChatSending) return;
    const displayMessage = docKey ? `Requesting ${promptType.replace('_', ' ')} for ${docKey.toUpperCase().replace('_', ' ')}...` : `Asking about ${promptType.replace('_', ' ')}...`;
    setChatMessages(prev => [...prev, { role: 'user', text: displayMessage }]);
    setIsChatSending(true);
    try {
      const result = await sendFixedPromptRequest({ promptType, documentKey: docKey, language: language, model: 'gemini' });
      setChatMessages(prev => [...prev, { role: 'bot', text: result.reply, steps: result.steps }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't fetch that information right now." }]);
    } finally { setIsChatSending(false); }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true); setUploadResult(null); setUploadError(null); setFormId(null);
    setConversationalOverrides({});
    setChatMessages([{ role: 'bot', text: language === 'tl' ? "Ina-analyze ko na po ang inyong dokumento..." : "Analyzing your document..." }]);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("form_type", formType);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found. Please log in again.");

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData,
      });

      if (!response.ok) throw new Error(await response.text() || "Upload failed");
      const data = await response.json();
      setFormId(data.id || data.form_details?.id);
      setUploadResult(data as UploadResponse);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "An unexpected error occurred.");
      setChatMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error while analyzing the document." }]);
    } finally { setIsUploading(false); }
  };

  const prepareMagicFillData = (fields: any[], profile: any, selfFieldGroups: string[]): ExtractedField[] => {
    const PROFILE_FIELD_MAP: Record<string, string> = {
      lastname: 'lastName', firstname: 'firstName', middlename: 'middleName', suffix: 'suffix',
      zipcode: 'zipCode', barangay: 'barangay', province: 'province', city: 'city', street: 'street',
      mobilecellphonenumber: 'contactNumber', taxpayerid: 'tinNumber', ssnumber: 'sssNumber',
      birthdate: 'birthDate', emailaddress: 'email', civilstatus: 'civilStatus', sex: 'sex'
    };

    // Top-level group before the first dot, with any array index stripped
    // (e.g. "children[1].lastname" -> "children", "father_name.lastname" ->
    // "father_name"). A field with no dot at all has no group — it's a bare
    // top-level scalar.
    const getTopLevelGroup = (fieldName: string): string | null => {
      if (!fieldName.includes('.')) return null;
      return fieldName.split('.')[0].replace(/\[\d+\]$/, '');
    };

    const findProfileMatch = (fieldName: string): string | undefined => {
      const leaf = fieldName.includes('.') ? fieldName.split('.').pop()! : fieldName;
      const profileKey = PROFILE_FIELD_MAP[normalizeKey(leaf)];
      if (!profileKey) return undefined;

      // Never let profile data bleed onto a relative's/beneficiary's field —
      // "lastname" inside father_name/mother_maiden_name/spouse_name/children
      // looks identical to the registrant's own "lastname" leaf, so the leaf
      // name alone can't be trusted. Gate on the AI's per-upload tagging of
      // which top-level groups are actually the registrant.
      const topGroup = getTopLevelGroup(fieldName);
      const isSelfGroup = topGroup === null
        ? true // bare top-level field, no group to misattribute to someone else
        : selfFieldGroups.some(g => g.toLowerCase() === topGroup.toLowerCase());
      if (!isSelfGroup) return undefined;

      return profile?.[profileKey];
    };

    const results: ExtractedField[] = [];
    fields.forEach(field => {
      const rawValue = field.extracted_value;
      const isLowConfidence = typeof field.confidence_score === 'number' && field.confidence_score < CONFIDENCE_THRESHOLD;

      const pushLeaf = (flatKey: string, flatVal: unknown) => {
        const extractedIsEmptyish = isEmptyish(flatVal);
        const profileValue = extractedIsEmptyish ? findProfileMatch(flatKey) : undefined;
        if (profileValue && !isEmptyish(profileValue)) {
          results.push({ field_name: flatKey, extracted_value: flatVal, text: String(profileValue), isMagicFilled: true });
          return;
        }
        const safeText = extractedIsEmptyish ? '' : (flatVal && typeof flatVal === 'object' ? JSON.stringify(flatVal) : String(flatVal));
        results.push({ field_name: flatKey, extracted_value: flatVal, confidence_score: field.confidence_score, text: isLowConfidence ? '' : safeText, isMagicFilled: false });
      };

      if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) { results.push({ ...field, text: '', isMagicFilled: false }); return; }
        rawValue.forEach((item, i) => {
          if (item && typeof item === 'object') {
            Object.entries(flattenObject(item as Record<string, unknown>, `${field.field_name}[${i + 1}]`)).forEach(([flatKey, flatVal]) => pushLeaf(flatKey, flatVal));
          } else { pushLeaf(`${field.field_name}[${i + 1}]`, item); }
        });
        return;
      }

      if (rawValue && typeof rawValue === 'object') {
        Object.entries(flattenObject(rawValue as Record<string, unknown>, field.field_name)).forEach(([flatKey, flatVal]) => pushLeaf(flatKey, flatVal));
        return;
      }

      const profileValue = findProfileMatch(field.field_name);
      if (profileValue) { results.push({ ...field, text: profileValue, isMagicFilled: true }); return; }
      results.push({ ...field, text: isLowConfidence ? '' : String(rawValue ?? ''), isMagicFilled: false });
    });
    return results;
  };

  const buildFinalData = () => {
    if (!uploadResult) return [] as ExtractedField[];
    const merged = prepareMagicFillData((uploadResult as any).extracted_data, profileData, (uploadResult as any)?.self_field_groups || []);
    return merged.map(field => conversationalOverrides[field.field_name] ? { ...field, text: conversationalOverrides[field.field_name] } : field);
  };

  const openReviewModal = () => {
    const finalData = buildFinalData().filter(f => !isEmptyish(f.text));
    const initialEdits: Record<string, string> = {};
    finalData.forEach(f => { initialEdits[f.field_name] = f.text || ""; });
    setEditableData(initialEdits);
    setShowReview(true);
  };

  const handleGenerateDocument = async () => {
    const targetId = formId || (uploadResult as any)?.id || uploadResult?.form_details?.id;
    if (!targetId) { alert("⚠️ Error: The Form ID is missing."); return; }

    // The original file was never uploaded to storage during /api/upload —
    // it only ever lived in memory on the backend for that one request. We
    // keep it here in `selectedFile` for the whole review/edit flow, so this
    // is the point where it has to be sent again: /generate needs the actual
    // bytes to stamp onto, and it's also the only step that persists
    // anything (the finished, stamped PDF) to storage.
    if (!selectedFile) { alert("⚠️ Error: The original file is no longer available. Please re-upload."); return; }

    setIsGenerating(true);
    setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? "Dino-download na ang inyong dokumento..." : "Stamping your data onto the document..." }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payloadArray = buildFinalData().map(f => {
        const finalValue = editableData[f.field_name] !== undefined ? editableData[f.field_name] : f.text;
        // Send the full qualified path (e.g. "children[2].lastname"), not just
        // the leaf. Collapsing to the leaf here discarded which group/array
        // index a value belonged to before it ever reached the backend, which
        // is why every "lastname" (registrant's, child 1's, child 2's, ...)
        // looked identical to pdf_generator.py — it had no way to tell them
        // apart. pdf_generator.py derives its own leaf internally for anchor
        // lookup, so sending the full path here is backward compatible.
        return { field_name: f.field_name, text: isEmptyish(finalValue) ? null : finalValue };
      });

      const generateFormData = new FormData();
      generateFormData.append('file', selectedFile);
      generateFormData.append('mapping_data', JSON.stringify(payloadArray));

      const response = await fetch(`${API_BASE_URL}/api/${targetId}/generate`, {
        method: 'POST',
        // No Content-Type header here — the browser sets the correct
        // multipart/form-data boundary automatically for FormData bodies.
        headers: { "Authorization": `Bearer ${session?.access_token || ''}` },
        body: generateFormData
      });

      if (!response.ok) throw new Error(`Backend Error ${response.status}: ${await response.text()}`);

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl; link.download = `AXIS_Filled_Form_${targetId}.pdf`;
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(downloadUrl);
      
      setChatMessages(prev => [...prev, { role: 'bot', text: language === 'tl' ? "Tapos na! Na-download na ang inyong PDF." : "Done! Your filled document has been downloaded." }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'bot', text: `Generation failed: ${err.message}` }]);
    } finally { setIsGenerating(false); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { setSelectedFile(e.dataTransfer.files[0]); setUploadResult(null); setFormId(null); }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { setSelectedFile(e.target.files[0]); setUploadResult(null); setFormId(null); }
  };
  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation(); setSelectedFile(null); setUploadResult(null); setFormId(null); setConversationalOverrides({});
    setCurrentAskingField(null); setMissingFieldsQueue([]); setChatMessages([{ role: 'bot', text: "Upload a document, and I'll extract the data." }]);
  };

  const extractedFields: ExtractedField[] = Array.isArray(uploadResult?.extracted_data) ? (uploadResult!.extracted_data as unknown as ExtractedField[]) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Document Ingestion</h2>
          <p className="text-sm text-slate-500 mt-1">Upload government forms for AI-powered extraction and auto-fill.</p>
        </div>
        <div className={`px-3 py-1.5 border rounded-full flex items-center gap-2 w-max ${isOffline ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOffline ? "bg-red-500" : "bg-emerald-500"}`}></div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isOffline ? "text-red-700" : "text-emerald-700"}`}>{apiStatus}</span>
        </div>
      </div>

      {/* --- ALWAYS SHOW 2 COLUMNS ---
          Desktop: fills the available viewport height (no dead space, no page-level
          scrollbar fighting the panel scroll). Mobile/tablet: no forced height at all —
          each stacked panel sizes to its own content within a comfortable min/max and
          scrolls internally, rather than being stretched or squashed by a shared height. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-230px)] lg:min-h-[550px]">
        
        {/* LEFT COLUMN: Upload Area OR Document Preview */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[420px] max-h-[650px] lg:max-h-none lg:min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {!uploadResult ? "Upload Document" : "Document Preview"}
            </span>
          </div>
          
          {!uploadResult ? (
            <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Document Classification</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select the form type, or let the AI engine auto-detect it.</p>
                </div>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="bg-white border border-slate-200 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block p-2.5 outline-none font-medium text-slate-700 w-full">
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
                className={`border-2 border-dashed rounded-xl transition-all duration-200 flex-1 flex flex-col items-center justify-center min-h-[250px]
                  ${!selectedFile ? "cursor-pointer" : ""}
                  ${isDragging ? "border-indigo-500 bg-indigo-50 scale-[1.02]" : selectedFile ? "border-indigo-400 bg-indigo-50/30" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                {selectedFile ? (
                  <div className="text-center w-full px-4">
                    <p className="text-lg font-bold text-slate-900 mb-1 truncate max-w-sm mx-auto">{selectedFile.name}</p>
                    <div className="flex flex-col xl:flex-row items-center justify-center gap-3 mt-4">
                      <button onClick={clearSelection} disabled={isUploading} className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-semibold rounded-lg shadow-sm">Change File</button>
                      <button onClick={(e) => { e.stopPropagation(); handleUpload(); }} disabled={isUploading || isOffline} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg shadow-sm">
                        {isUploading ? "Extracting..." : "Process Document"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-base font-medium text-slate-900 mb-1">Drop your document here</p>
                    <p className="text-sm text-slate-500 mb-4">Supports PDF, JPG, PNG up to 25MB.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-slate-100/50 relative">
              {previewUrl ? (
                selectedFile?.type.startsWith("image/") 
                  ? <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2 absolute inset-0" />
                  : <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><p className="text-sm text-slate-400">No document uploaded</p></div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: A.X.I.S Assistant (Always Visible) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[420px] max-h-[650px] lg:max-h-none lg:min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> A.X.I.S. Assistant
            </span>
            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg">
              <button onClick={() => setLanguage("en")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}>EN</button>
              <button onClick={() => setLanguage("tl")} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${language === "tl" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}>PH</button>
            </div>
          </div>

          {extractedFields.length > 0 && (
            <div className="p-3 bg-emerald-50/30 border-b border-emerald-100 shrink-0 shadow-inner">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                Verified Profile Data applied
              </p>
              <div className="flex overflow-x-auto gap-1.5 pb-1 custom-scrollbar">
                {buildFinalData().map((field, idx) => {
                  const displayValue = field.text;
                  if (isEmptyish(displayValue)) return null;
                  return (
                    <div key={idx} className="bg-white border border-emerald-200 rounded px-2 py-1 flex gap-1.5 items-center shadow-sm shrink-0 whitespace-nowrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{formatLabel(field.field_name)}:</span>
                      <span className="text-[10px] text-slate-800 font-semibold">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          <div className="bg-white border-t border-slate-100 p-3 shrink-0 flex flex-col gap-2">
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

            {currentAskingField && currentFieldGuide && (
              <div className="px-2 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-700 italic animate-in slide-in-from-bottom-1 fade-in duration-300">
                💡 {currentFieldGuide}
              </div>
            )}

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
              <button onClick={openReviewModal} disabled={isGenerating || currentAskingField !== null} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                {isGenerating ? 'Generating...' : (currentAskingField ? 'Please answer above to continue' : 'Review & Download PDF')}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* --- Editable Review Modal --- */}
      {showReview && (() => {
        const reviewFields = buildFinalData().filter((f) => !isEmptyish(f.text));
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
              <h3 className="text-xl font-bold mb-1 text-slate-900">Review & Edit Details</h3>
              <p className="text-sm text-slate-500 mb-6">Make any necessary corrections before stamping onto the final PDF.</p>

              {reviewFields.length === 0 ? (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                  No data is ready to fill in yet. Go back and answer the assistant's questions first.
                </div>
              ) : (
                <div className="space-y-3 mb-6 overflow-y-auto pr-2 custom-scrollbar bg-slate-50 p-4 rounded-xl border border-slate-100 flex-1">
                  {reviewFields.map((field) => (
                    <div key={field.field_name} className="flex flex-col gap-1 text-sm border-b border-slate-200/60 pb-3 last:border-0 last:pb-0">
                      <label className="text-slate-500 font-medium uppercase text-[10px] tracking-wider shrink-0 mt-0.5">{formatLabel(field.field_name)}</label>
                      <input 
                        type="text" 
                        value={editableData[field.field_name] !== undefined ? editableData[field.field_name] : (field.text || '')} 
                        onChange={(e) => setEditableData(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2 shrink-0">
                <button onClick={() => setShowReview(false)} className="w-1/3 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl shadow-sm transition-colors">Back</button>
                <button
                  onClick={() => { setShowReview(false); handleGenerateDocument(); }}
                  disabled={isGenerating || reviewFields.length === 0}
                  className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
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