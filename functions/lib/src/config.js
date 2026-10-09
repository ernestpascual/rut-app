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
exports.db = void 0;
exports.isAiKillSwitchActive = isAiKillSwitchActive;
exports.getGeminiApiKey = getGeminiApiKey;
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
 * Strictly ensures only Flash models version 3.5 and above are allowed.
 * Blocks non-flash models (e.g. pro, ultra) and models below version 3.5 (e.g. 1.5, 2.0, 2.5, 3.0).
 */
function validateFlashModel(model) {
    const clean = (model || '').trim().toLowerCase();
    if (!clean.includes('flash')) {
        throw new Error(`Invalid model '${model}'. Only Gemini Flash models (must contain 'flash') are permitted.`);
    }
    const versionMatch = clean.match(/(\d+(?:\.\d+)?)/);
    if (!versionMatch) {
        throw new Error(`Invalid model '${model}'. Could not detect model version. Only Flash models version 3.5 and above are permitted.`);
    }
    const version = parseFloat(versionMatch[1]);
    if (isNaN(version) || version < 3.5) {
        throw new Error(`Invalid model '${model}'. Version ${versionMatch[1]} is not supported. Only Flash models version 3.5 and above (e.g. gemini-3.5-flash, gemini-4.0-flash) are permitted.`);
    }
    return clean;
}
/**
 * Returns configured Gemini Flash model (defaults to gemini-3.5-flash).
 */
function getGeminiModel() {
    const envModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    return validateFlashModel(envModel);
}
//# sourceMappingURL=config.js.map