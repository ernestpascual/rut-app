"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureMetadata = void 0;
const https_1 = require("firebase-functions/v2/https");
const fetcher_1 = require("../metadata/fetcher");
/**
 * Callable Cloud Function that extracts rich metadata from URLs (including Instagram,
 * Pinterest, Threads, YouTube, and generic web links) without client-side CORS issues.
 */
exports.captureMetadata = (0, https_1.onCall)({
    invoker: 'public',
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
}, async (request) => {
    const url = request.data?.url;
    if (!url || typeof url !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'A valid URL string is required.');
    }
    try {
        const result = await (0, fetcher_1.captureMetadataAction)(url);
        return result;
    }
    catch (err) {
        console.warn(`[captureMetadata] Error fetching ${url}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Metadata extraction failed.');
    }
});
//# sourceMappingURL=captureMetadata.js.map