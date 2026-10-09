"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProvider = getAIProvider;
const mock_provider_1 = require("./mock-provider");
const gemini_provider_1 = require("./gemini-provider");
const config_1 = require("../config");
function getAIProvider(modelName) {
    const apiKey = (0, config_1.getGeminiApiKey)();
    if (apiKey) {
        return new gemini_provider_1.GeminiAIProvider(apiKey, modelName);
    }
    else {
        console.log('[AI Factory] GEMINI_API_KEY not configured. Falling back to MockAIProvider.');
        return new mock_provider_1.MockAIProvider();
    }
}
//# sourceMappingURL=factory.js.map