/**
 * Pricing table in integer micros (1 USD = 1,000,000 micros)
 * Version: 2026-09-01
 */

export const PRICING_VERSION = '2026-09-01';

export interface ModelPricing {
  inputPer1kTokensMicros: number;
  outputPer1kTokensMicros: number;
  embeddingPer1kCharsMicros: number;
}

export const PRICING_TABLE: Record<string, ModelPricing> = {
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
export function calculateCostMicros(
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  chars: number = 0
): number {
  const rates = PRICING_TABLE[model] || PRICING_TABLE['gemini-3.5-flash'] || {
    inputPer1kTokensMicros: 75,
    outputPer1kTokensMicros: 300,
    embeddingPer1kCharsMicros: 0,
  };
  const inputCost = Math.round((inputTokens / 1000) * rates.inputPer1kTokensMicros);
  const outputCost = Math.round((outputTokens / 1000) * rates.outputPer1kTokensMicros);
  const embedCost = Math.round((chars / 1000) * rates.embeddingPer1kCharsMicros);

  return inputCost + outputCost + embedCost;
}
