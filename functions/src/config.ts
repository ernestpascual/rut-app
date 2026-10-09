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
 * Strictly ensures only Flash models version 3.5 and above are allowed.
 * Blocks non-flash models (e.g. pro, ultra) and models below version 3.5 (e.g. 1.5, 2.0, 2.5, 3.0).
 */
export function validateFlashModel(model: string): string {
  const clean = (model || '').trim().toLowerCase();
  if (!clean.includes('flash')) {
    throw new Error(
      `Invalid model '${model}'. Only Gemini Flash models (must contain 'flash') are permitted.`
    );
  }

  const versionMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (!versionMatch) {
    throw new Error(
      `Invalid model '${model}'. Could not detect model version. Only Flash models version 3.5 and above are permitted.`
    );
  }

  const version = parseFloat(versionMatch[1]);
  if (isNaN(version) || version < 3.5) {
    throw new Error(
      `Invalid model '${model}'. Version ${versionMatch[1]} is not supported. Only Flash models version 3.5 and above (e.g. gemini-3.5-flash, gemini-4.0-flash) are permitted.`
    );
  }

  return clean;
}

/**
 * Returns configured Gemini Flash model (defaults to gemini-3.5-flash).
 */
export function getGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  return validateFlashModel(envModel);
}
