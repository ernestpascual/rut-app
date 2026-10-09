"use strict";
/**
 * Pricing table in integer micros (1 USD = 1,000,000 micros)
 * Version: 2026-09-01
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_TABLE = exports.PRICING_VERSION = void 0;
exports.calculateCostMicros = calculateCostMicros;
exports.PRICING_VERSION = '2026-09-01';
exports.PRICING_TABLE = {
    'gemini-3.5-flash': {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    },
    'gemini-3.5-flash-preview': {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    },
    'gemini-4.0-flash': {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    },
    'gemini-4.5-flash': {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    },
    'gemini-2.0-flash': {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    },
    'gemini-1.5-flash': {
        inputPer1kTokensMicros: 75, // $0.075 / 1M tokens
        outputPer1kTokensMicros: 300, // $0.30 / 1M tokens
        embeddingPer1kCharsMicros: 0,
    },
    'text-embedding-004': {
        inputPer1kTokensMicros: 0,
        outputPer1kTokensMicros: 0,
        embeddingPer1kCharsMicros: 25, // $0.025 / 1M chars
    },
    'mock-model': {
        inputPer1kTokensMicros: 10,
        outputPer1kTokensMicros: 20,
        embeddingPer1kCharsMicros: 5,
    },
};
/**
 * Calculates estimated cost in integer micros.
 */
function calculateCostMicros(model, inputTokens = 0, outputTokens = 0, chars = 0) {
    const rates = exports.PRICING_TABLE[model] || exports.PRICING_TABLE['gemini-3.5-flash'] || {
        inputPer1kTokensMicros: 75,
        outputPer1kTokensMicros: 300,
        embeddingPer1kCharsMicros: 0,
    };
    const inputCost = Math.round((inputTokens / 1000) * rates.inputPer1kTokensMicros);
    const outputCost = Math.round((outputTokens / 1000) * rates.outputPer1kTokensMicros);
    const embedCost = Math.round((chars / 1000) * rates.embeddingPer1kCharsMicros);
    return inputCost + outputCost + embedCost;
}
//# sourceMappingURL=pricing.js.map