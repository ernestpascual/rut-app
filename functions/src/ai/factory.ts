import { AIProvider } from './provider';
import { MockAIProvider } from './mock-provider';
import { GeminiAIProvider } from './gemini-provider';
import { getGeminiApiKey } from '../config';

export function getAIProvider(modelName?: string): AIProvider {
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    return new GeminiAIProvider(apiKey, modelName);
  } else {
    console.log('[AI Factory] GEMINI_API_KEY not configured. Falling back to MockAIProvider.');
    return new MockAIProvider();
  }
}
