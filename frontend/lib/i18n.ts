import type { ChatLanguage } from './types';

/**
 * Small, self-contained copy dictionary for the chatbot widget only.
 * Kept local (rather than pulled into a project-wide i18n system) since
 * this is the only bilingual surface in the app today. If AXIS grows a
 * broader localization need later, this shape can be lifted as-is into
 * a shared i18n provider.
 */
export interface ChatbotCopy {
  launcherLabel: string;
  panelTitle: string;
  panelSubtitle: string;
  languageToggleLabel: string;
  modelSwitchLabel: string;
  inputPlaceholder: string;
  send: string;
  sending: string;
  welcomeMessage: string;
  errorMessage: string;
  emptyInputHint: string;
  stepsHeading: string;
  closeLabel: string;
  minimizeLabel: string;
  newChat: string;
}

export const chatbotCopy: Record<ChatLanguage, ChatbotCopy> = {
  en: {
    launcherLabel: 'Ask AXIS',
    panelTitle: 'AXIS Assistant',
    panelSubtitle: 'Step-by-step help with this form',
    languageToggleLabel: 'Language',
    modelSwitchLabel: 'Model',
    inputPlaceholder: 'Ask about a field on this form…',
    send: 'Send',
    sending: 'Sending…',
    welcomeMessage:
      "Hi! I'm here to help you fill this form out correctly. Tell me which field you're on, or paste what it's asking for, and I'll walk you through it step by step.",
    errorMessage:
      "Something went wrong reaching the assistant. Please try again in a moment.",
    emptyInputHint: 'Type a question before sending.',
    stepsHeading: 'Here\u2019s how to fill it in:',
    closeLabel: 'Close assistant',
    minimizeLabel: 'Minimize',
    newChat: 'Start over',
  },
  tl: {
    launcherLabel: 'Magtanong sa AXIS',
    panelTitle: 'Katulong ng AXIS',
    panelSubtitle: 'Sunud-sunod na tulong sa form na ito',
    languageToggleLabel: 'Wika',
    modelSwitchLabel: 'Modelo',
    inputPlaceholder: 'Magtanong tungkol sa isang bahagi ng form…',
    send: 'Ipadala',
    sending: 'Ipinapadala…',
    welcomeMessage:
      'Kumusta! Nandito ako para tulungan kang sagutan nang tama ang form na ito. Sabihin mo lang kung anong field ang kinakausap mo, at gagabayan kita nang paisa-isa.',
    errorMessage:
      'May problema sa pagkonekta sa katulong. Pakisubukang muli sandali.',
    emptyInputHint: 'Mag-type ng tanong bago magpadala.',
    stepsHeading: 'Narito ang paraan para sagutan ito:',
    closeLabel: 'Isara ang katulong',
    minimizeLabel: 'I-minimize',
    newChat: 'Magsimula ulit',
  },
};

export function getChatbotCopy(language: ChatLanguage): ChatbotCopy {
  return chatbotCopy[language];
}