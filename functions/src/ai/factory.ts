import { AIProvider } from './provider';
import { GeminiAIProvider } from './gemini-provider';
import { getGeminiApiKey } from '../config';

export function getAIProvider(modelName?: string): AIProvider {
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    return new GeminiAIProvider(apiKey, modelName);
  }
  throw new Error('GEMINI_API_KEY is not configured on the server. AI operations require a valid Gemini API key.');
}
