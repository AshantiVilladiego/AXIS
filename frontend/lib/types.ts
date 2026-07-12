export type ChatLanguage = 'en' | 'tl';
export type ChatModelProvider = 'gemini' | 'groq' | 'huggingface';

export const CHAT_MODEL_PROVIDERS: ChatModelProvider[] = ['gemini', 'groq', 'huggingface'];

export const CHAT_MODEL_LABELS: Record<ChatModelProvider, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  huggingface: 'Hugging Face',
};

// Adjust fields here based on whatever form data you are tracking
export interface FormContext {
  formId?: string;
  currentField?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  steps?: string[];
  createdAt: number;
}

export interface ChatRequestPayload {
  message: string;
  language: ChatLanguage;
  model: ChatModelProvider;
  formContext?: FormContext;
  history: { role: 'user' | 'assistant'; text: string }[];
  // Leaf field names still blank on the form (e.g. "citymunicipality").
  // Lets the backend tell "Quezon City" apart from ordinary small talk.
  missingFields?: string[];
}

export interface FixedPromptRequestPayload {
  promptType: string;
  documentKey?: string;
  language: ChatLanguage;
  model: ChatModelProvider;
}

export interface ChatResponsePayload {
  reply: string;
  steps?: string[];
  // {field_name: value} the model captured from free-chat, if any — merge
  // into conversationalOverrides the same way slot-filling answers are.
  fieldUpdates?: Record<string, string> | null;
}