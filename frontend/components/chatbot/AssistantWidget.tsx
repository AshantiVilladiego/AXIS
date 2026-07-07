'use client';

import { useEffect, useRef, useState } from 'react';
import { sendFixedPromptRequest, ChatbotRequestError } from '@/lib/api';
import { getChatbotCopy } from '@/lib/i18n';
import type {
  ChatMessage,
  ChatModelProvider,
  FormContext,
} from '@/lib/types';
import { ModelSwitch } from './ModelSwitch';

interface AssistantWidgetProps {
  formContext?: FormContext;
}

const PREFS_KEY = 'axis-assistant-prefs';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadPrefs(): { model: ChatModelProvider } {
  if (typeof window === 'undefined') {
    return { model: 'gemini' };
  }
  try {
    const raw = window.sessionStorage.getItem(PREFS_KEY);
    if (!raw) return { model: 'gemini' };
    const parsed = JSON.parse(raw);
    return {
      model: ['gemini', 'groq', 'huggingface'].includes(parsed.model)
        ? parsed.model
        : 'gemini',
    };
  } catch {
    return { model: 'gemini' };
  }
}

export function AssistantWidget({ formContext }: AssistantWidgetProps) {
  const initialPrefs = useRef(loadPrefs());
  const [isOpen, setIsOpen] = useState(false);
  const [model, setModel] = useState<ChatModelProvider>(initialPrefs.current.model);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fixed Prompts State
  const [pendingFixedPrompt, setPendingFixedPrompt] = useState<string | null>(null);
  const [selectedDocKey, setSelectedDocKey] = useState<string>('bir_2316');

  const scrollRef = useRef<HTMLDivElement>(null);
  const copy = getChatbotCopy('en');

  useEffect(() => {
    try {
      window.sessionStorage.setItem(PREFS_KEY, JSON.stringify({ model }));
    } catch {
      // Non-fatal
    }
  }, [model]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: makeId(),
          role: 'assistant',
          text: copy.welcomeMessage,
          createdAt: Date.now(),
        },
      ];
    });
  }, [copy.welcomeMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending, pendingFixedPrompt]);

  async function handleFixedSubmit(promptType: string, docKey?: string) {
    setPendingFixedPrompt(null);
    if (isSending) return;

    const displayMessage = docKey 
        ? `Requesting ${promptType.replace('_', ' ')} for ${docKey.toUpperCase().replace('_', ' ')}...`
        : `Asking about ${promptType.replace('_', ' ')}...`;

    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: displayMessage,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setError(null);

    try {
      const result = await sendFixedPromptRequest({
        promptType,
        documentKey: docKey,
        language: 'en',
        model,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: result.reply,
          steps: result.steps,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      const message =
        err instanceof ChatbotRequestError ? err.message : copy.errorMessage;
      setError(copy.errorMessage);
      console.error('[AXIS Assistant]', message);
    } finally {
      setIsSending(false);
    }
  }

  function handleNewChat() {
    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        text: copy.welcomeMessage,
        createdAt: Date.now(),
      },
    ]);
    setError(null);
    setPendingFixedPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label={isOpen ? copy.closeLabel : copy.launcherLabel}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={copy.panelTitle}
          className="fixed bottom-24 right-6 z-50 flex h-[36rem] w-[24rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold leading-tight">{copy.panelTitle}</p>
                <p className="text-xs leading-tight text-white/60">{copy.panelSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={handleNewChat}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {copy.newChat}
              </button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <ModelSwitch value={model} onChange={setModel} label={copy.modelSwitchLabel} />
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} stepsHeading={copy.stepsHeading} />
            ))}
            {isSending && <TypingIndicator />}
          </div>

          {error && (
            <div className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 p-3">
            {pendingFixedPrompt ? (
              <div className="animate-in slide-in-from-bottom-2 fade-in duration-200">
                <p className="text-sm font-semibold mb-2 text-slate-900">Select Document Type:</p>
                <select 
                  value={selectedDocKey}
                  onChange={(e) => setSelectedDocKey(e.target.value)}
                  className="w-full p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white mb-3"
                >
                  <option value="bir_2316">BIR Form 2316</option>
                  <option value="bir_1701">BIR Form 1701/1701A</option>
                  <option value="sss_e1">SSS Form E-1</option>
                  <option value="philhealth_pmrf">PhilHealth PMRF</option>
                  <option value="pagibig_mdf">Pag-IBIG MDF</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setPendingFixedPrompt(null)} 
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleFixedSubmit(pendingFixedPrompt, selectedDocKey)} 
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 mb-1 px-1">How can I help you?</p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setPendingFixedPrompt('walkthrough')} 
                    disabled={isSending}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    How to fill out...
                  </button>
                  <button 
                    onClick={() => setPendingFixedPrompt('supporting_docs')} 
                    disabled={isSending}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Required Docs
                  </button>
                  <button 
                    onClick={() => handleFixedSubmit('sss_profession_business')} 
                    disabled={isSending}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    SSS Profession vs Business
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({
  message,
  stepsHeading,
}: {
  message: ChatMessage;
  stepsHeading: string;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-200 bg-white text-slate-900',
        ].join(' ')}
      >
        {!isUser && (
          <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            AXIS
          </span>
        )}
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.steps && message.steps.length > 0 && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <p className="mb-1 text-xs font-semibold text-slate-900/70">{stepsHeading}</p>
            <ol className="space-y-1.5">
              {message.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600" />
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 4.5C4 3.67157 4.67157 3 5.5 3H18.5C19.3284 3 20 3.67157 20 4.5V15.5C20 16.3284 19.3284 17 18.5 17H8L4.5 20.5C4.22386 20.7761 3.79289 20.6716 3.5 20.4V4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}