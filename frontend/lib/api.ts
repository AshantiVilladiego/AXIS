import type { 
  ChatRequestPayload, 
  ChatResponsePayload, 
  FixedPromptRequestPayload 
} from './types';

const CHATBOT_ENDPOINT_PATH = '/api/chatbot/message';
const FIXED_PROMPT_ENDPOINT_PATH = '/api/chatbot/fixed'; // Ensure your backend exposes this!

export class ChatbotRequestError extends Error {}

export async function sendChatMessage(
  payload: ChatRequestPayload,
  signal?: AbortSignal
): Promise<ChatResponsePayload> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new ChatbotRequestError(
      'NEXT_PUBLIC_API_URL is not set — cannot reach the AXIS backend.'
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${CHATBOT_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    throw new ChatbotRequestError('Could not reach the assistant service.');
  }

  if (!response.ok) {
    throw new ChatbotRequestError(
      `Assistant service responded with status ${response.status}.`
    );
  }

  const data = (await response.json()) as ChatResponsePayload;

  if (!data || typeof data.reply !== 'string') {
    throw new ChatbotRequestError('Assistant service returned an unexpected shape.');
  }

  return data;
}

export async function sendFixedPromptRequest(
  payload: FixedPromptRequestPayload,
  signal?: AbortSignal
): Promise<ChatResponsePayload> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new ChatbotRequestError(
      'NEXT_PUBLIC_API_URL is not set — cannot reach the AXIS backend.'
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${FIXED_PROMPT_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    throw new ChatbotRequestError('Could not reach the assistant service.');
  }

  if (!response.ok) {
    throw new ChatbotRequestError(
      `Assistant service responded with status ${response.status}.`
    );
  }

  const data = (await response.json()) as ChatResponsePayload;

  if (!data || typeof data.reply !== 'string') {
    throw new ChatbotRequestError('Assistant service returned an unexpected shape.');
  }

  return data;
}