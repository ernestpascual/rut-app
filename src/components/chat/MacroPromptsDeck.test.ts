import {
  MACRO_PROMPTS,
  FRIEND_PERSONAS,
} from './MacroPromptsDeck';

describe('MacroPromptsDeck Configurations', () => {
  test('defines the 4 required macro prompts with correct properties', () => {
    expect(MACRO_PROMPTS).toHaveLength(4);
    const ids = MACRO_PROMPTS.map((m) => m.id);
    expect(ids).toEqual(['occams_razor', 'pareto', 'cost_estimate', 'similar_ideas']);

    // Occam's Razor
    const occam = MACRO_PROMPTS.find((m) => m.id === 'occams_razor')!;
    expect(occam.name).toBe("Occam's Razor");
    expect(occam.prompt.toLowerCase()).toContain("occam's razor");
    expect(occam.prompt.toLowerCase()).toContain('simplest');

    // Pareto (80/20)
    const pareto = MACRO_PROMPTS.find((m) => m.id === 'pareto')!;
    expect(pareto.name).toContain('Pareto');
    expect(pareto.prompt).toContain('80/20');
    expect(pareto.prompt).toContain('80%');

    // Cost Estimate
    const cost = MACRO_PROMPTS.find((m) => m.id === 'cost_estimate')!;
    expect(cost.name).toBe('Cost Estimate');
    expect(cost.prompt.toLowerCase()).toContain('cost');

    // Similar Ideas
    const similar = MACRO_PROMPTS.find((m) => m.id === 'similar_ideas')!;
    expect(similar.name).toBe('Similar Ideas');
    expect(similar.subtitle).toBe('FIND SIMILAR IDEAS');
    expect(similar.webAccess).toBe(true);
    expect(similar.prompt.toLowerCase()).toContain('similar implementations');
  });

  test('defines all 6 friend personas with their exact persona instructions', () => {
    expect(FRIEND_PERSONAS).toHaveLength(6);
    const names = FRIEND_PERSONAS.map((p) => p.name);
    expect(names).toEqual(['Kenji', 'Tala', 'Ingrid', 'Tariq', 'Priya', 'Mateo']);

    // Kenji: Verifiable data, neutral facts
    const kenji = FRIEND_PERSONAS.find((p) => p.name === 'Kenji')!;
    expect(kenji.instruction).toContain('verifiable data, neutral facts, and missing information');
    expect(kenji.instruction).toContain('Never express feelings or make value judgments');

    // Tala: Genuine warmth, gut instinct (kutob)
    const tala = FRIEND_PERSONAS.find((p) => p.name === 'Tala')!;
    expect(tala.instruction).toContain('genuine warmth, gut instinct, and raw emotional honesty');
    expect(tala.instruction).toContain('kutob (hunches)');

    // Ingrid: Realist, flaws, legal hazards, downsides
    const ingrid = FRIEND_PERSONAS.find((p) => p.name === 'Ingrid')!;
    expect(ingrid.instruction).toContain('realist who spots flaws, legal hazards, and potential downsides');

    // Tariq: Grounded optimism, value creation, upside
    const tariq = FRIEND_PERSONAS.find((p) => p.name === 'Tariq')!;
    expect(tariq.instruction).toContain('grounded optimism, value creation, and best-case potential');

    // Priya: Lateral, unexpected ideas, provocative what-ifs
    const priya = FRIEND_PERSONAS.find((p) => p.name === 'Priya')!;
    expect(priya.instruction).toContain('lateral, unexpected ideas, disruptive alternatives, and provocative "what-ifs."');

    // Mateo: Structure, summarize viewpoints, keep on track
    const mateo = FRIEND_PERSONAS.find((p) => p.name === 'Mateo')!;
    expect(mateo.instruction).toContain('manage the structure, summarize viewpoints, and keep conversations on track');
  });
});
