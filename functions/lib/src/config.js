"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL = exports.ALLOWED_MODELS = exports.db = void 0;
exports.isAiKillSwitchActive = isAiKillSwitchActive;
exports.getGeminiApiKey = getGeminiApiKey;
exports.normalizeModelName = normalizeModelName;
exports.validateFlashModel = validateFlashModel;
exports.getGeminiModel = getGeminiModel;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin once
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
/**
 * Checks if the global AI kill switch is engaged in _systemConfig/global.
 */
async function isAiKillSwitchActive() {
    try {
        const snap = await exports.db.collection('_systemConfig').doc('global').get();
        if (snap.exists && snap.data()?.killSwitchEnabled === true) {
            return true;
        }
    }
    catch {
        // Default open if collection is empty
    }
    return false;
}
/**
 * Resolves Gemini API key from environment or Secret Manager.
 * Never accesses .env.local!
 */
function getGeminiApiKey() {
    return process.env.GEMINI_API_KEY || null;
}
/**
 * Allowed AI models:
 * - Gemini 4 (gemini-4)
 * - Gemini 3.8 Flash (gemini-3.8-flash)
 * - Gemini 3.6 Flash (gemini-3.6-flash) - DEFAULT
 */
exports.ALLOWED_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-4',
];
exports.DEFAULT_MODEL = 'gemini-3.6-flash';
/**
 * Normalizes input string to canonical model identifier.
 */
function normalizeModelName(model) {
    const clean = (model || '').trim().toLowerCase();
    if (clean === 'gemini-4' ||
        clean === 'gemini 4' ||
        clean === 'gemini-4.0' ||
        clean === 'gemini 4.0' ||
        clean === 'gemini-4-flash' ||
        clean === 'gemini-4.0-flash') {
        return 'gemini-4';
    }
    if (clean === 'gemini-3.8-flash' ||
        clean === 'gemini-3.8' ||
        clean === 'gemini 3.8' ||
        clean === 'gemini 3.8 flash') {
        return 'gemini-3.8-flash';
    }
    if (clean === 'gemini-3.6-flash' ||
        clean === 'gemini-3.6' ||
        clean === 'gemini 3.6' ||
        clean === 'gemini 3.6 flash') {
        return 'gemini-3.6-flash';
    }
    return clean;
}
/**
 * Strictly ensures only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are allowed.
 */
function validateFlashModel(model) {
    const normalized = normalizeModelName(model);
    if (normalized === 'gemini-4' ||
        normalized === 'gemini-3.8-flash' ||
        normalized === 'gemini-3.6-flash') {
        return normalized;
    }
    throw new Error(`Invalid model '${model}'. Only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are permitted.`);
}
/**
 * Returns configured Gemini model (defaults to gemini-3.6-flash).
 */
function getGeminiModel() {
    const envModel = process.env.GEMINI_MODEL || exports.DEFAULT_MODEL;
    return validateFlashModel(envModel);
}
//# sourceMappingURL=config.js.map