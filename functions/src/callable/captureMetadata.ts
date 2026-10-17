import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { captureMetadataAction } from '../metadata/fetcher';

/**
 * Callable Cloud Function that extracts rich metadata from URLs (including Instagram,
 * Pinterest, Threads, YouTube, and generic web links) without client-side CORS issues.
 */
export const captureMetadata = onCall(
  {
    invoker: 'public',
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const url = request.data?.url;
    if (!url || typeof url !== 'string') {
      throw new HttpsError('invalid-argument', 'A valid URL string is required.');
    }

    try {
      const result = await captureMetadataAction(url);
      return result;
    } catch (err: any) {
      console.warn(`[captureMetadata] Error fetching ${url}:`, err);
      throw new HttpsError('internal', err.message || 'Metadata extraction failed.');
    }
  }
);
