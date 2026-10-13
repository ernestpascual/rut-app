import * as admin from 'firebase-admin';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

/**
 * Checks if the global AI kill switch is engaged in _systemConfig/global.
 */
export async function isAiKillSwitchActive(): Promise<boolean> {
  try {
    const snap = await db.collection('_systemConfig').doc('global').get();
    if (snap.exists && snap.data()?.killSwitchEnabled === true) {
      return true;
    }
  } catch {
    // Default open if collection is empty
  }
  return false;
}

/**
 * Resolves Gemini API key from environment or Secret Manager.
 * Never accesses .env.local!
 */
export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Allowed AI models:
 * - Gemini 4 (gemini-4)
 * - Gemini 3.8 Flash (gemini-3.8-flash)
 * - Gemini 3.6 Flash (gemini-3.6-flash) - DEFAULT
 */
export const ALLOWED_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-4',
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];
export const DEFAULT_MODEL: AllowedModel = 'gemini-3.6-flash';

/**
 * Normalizes input string to canonical model identifier.
 */
export function normalizeModelName(model: string): string {
  const clean = (model || '').trim().toLowerCase();
  if (
    clean === 'gemini-4' ||
    clean === 'gemini 4' ||
    clean === 'gemini-4.0' ||
    clean === 'gemini 4.0' ||
    clean === 'gemini-4-flash' ||
    clean === 'gemini-4.0-flash'
  ) {
    return 'gemini-4';
  }
  if (
    clean === 'gemini-3.8-flash' ||
    clean === 'gemini-3.8' ||
    clean === 'gemini 3.8' ||
    clean === 'gemini 3.8 flash'
  ) {
    return 'gemini-3.8-flash';
  }
  if (
    clean === 'gemini-3.6-flash' ||
    clean === 'gemini-3.6' ||
    clean === 'gemini 3.6' ||
    clean === 'gemini 3.6 flash'
  ) {
    return 'gemini-3.6-flash';
  }
  return clean;
}

/**
 * Strictly ensures only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are allowed.
 */
export function validateFlashModel(model: string): string {
  const normalized = normalizeModelName(model);
  if (
    normalized === 'gemini-4' ||
    normalized === 'gemini-3.8-flash' ||
    normalized === 'gemini-3.6-flash'
  ) {
    return normalized;
  }

  throw new Error(
    `Invalid model '${model}'. Only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are permitted.`
  );
}

/**
 * Returns configured Gemini model (defaults to gemini-3.6-flash).
 */
export function getGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  return validateFlashModel(envModel);
}
