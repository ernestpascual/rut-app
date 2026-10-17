"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProvider = getAIProvider;
const gemini_provider_1 = require("./gemini-provider");
const config_1 = require("../config");
function getAIProvider(modelName) {
    const apiKey = (0, config_1.getGeminiApiKey)();
    if (apiKey) {
        return new gemini_provider_1.GeminiAIProvider(apiKey, modelName);
    }
    throw new Error('GEMINI_API_KEY is not configured on the server. AI operations require a valid Gemini API key.');
}
//# sourceMappingURL=factory.js.map