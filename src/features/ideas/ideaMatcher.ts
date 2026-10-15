import { InspirationItem } from '../../types';

export interface IdeaMatchInput {
  title: string;
  brief?: string | null;
  notes?: string;
  tags?: string[];
}

export interface IdeaMatchResult {
  inspirationId: string;
  inspiration: InspirationItem;
  confidence: number; // 0.0 to 1.0
  reason: string;
  matchedKeywords: string[];
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'need', 'want', 'like', 'get', 'use', 'using',
]);

const SEMANTIC_CLUSTERS: Record<string, string[]> = {
  ceramics: ['ceramic', 'ceramics', 'pottery', 'clay', 'stoneware', 'tableware', 'vessel', 'glaze', 'earth-tones', 'craft'],
  brutalism: ['brutalist', 'brutalism', 'concrete', 'monolithic', 'raw', 'cantilever', 'monochrome', 'architecture'],
  typography: ['typography', 'type', 'font', 'grotesk', 'helvetica', 'swiss', 'grid', 'poster', 'editorial', 'mono', 'print'],
  motion: ['motion', 'kinetic', 'animation', 'spring', 'physics', 'gesture', 'transition', 'interactive', 'microinteraction'],
  minimalism: ['minimal', 'minimalist', 'minimalism', 'clean', 'simple', 'scandi', 'scandinavian', 'japanese', 'wabi-sabi', 'washi'],
  lighting: ['lighting', 'light', 'cinematic', 'tungsten', 'amber', '35mm', 'kodak', 'film', 'photography', 'shadow', 'atmosphere'],
  packaging: ['packaging', 'unboxing', 'paper', 'washi', 'box', 'seal', 'sustainable', 'label', 'craft'],
  systems: ['tokens', 'system', 'design-system', 'scale', 'fluid', 'modular', 'css', 'code', 'layout'],
};

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Matches an idea with items from the inspiration dump.
 * Ranks items by relevance confidence score and generates an editorial reasoning explanation.
 */
export function matchIdeaWithDump(
  idea: IdeaMatchInput,
  dumpItems: InspirationItem[],
  attachedIds: Set<string> = new Set(),
  limit: number = 5
): IdeaMatchResult[] {
  const ideaTokens = new Set<string>([
    ...tokenize(idea.title),
    ...tokenize(idea.brief || ''),
    ...tokenize(idea.notes || ''),
    ...(idea.tags || []).map((t) => t.toLowerCase().trim()),
  ]);

  if (dumpItems.length === 0) return [];

  // Determine active semantic clusters for the idea
  const activeClusters = new Set<string>();
  ideaTokens.forEach((token) => {
    for (const [clusterName, words] of Object.entries(SEMANTIC_CLUSTERS)) {
      if (words.some((w) => token.includes(w) || w.includes(token))) {
        activeClusters.add(clusterName);
      }
    }
  });

  const results: IdeaMatchResult[] = [];

  for (const item of dumpItems) {
    // Only match active items from the dump folder
    if (item.archived) continue;
    if (item.folder && item.folder !== 'dump') continue;

    if (attachedIds.has(item.id)) {
      // Already attached as reference, skip
      continue;
    }

    let score = 0;
    const matchedWords = new Set<string>();

    const itemConcepts = (item.concepts || []).flatMap((c) => tokenize(c));
    const itemAiTags = (item.aiTags || []).map((t) => t.toLowerCase());
    const itemTags = (item.tags || []).map((t) => t.toLowerCase());
    const itemTitleTokens = tokenize(item.title);
    const itemSummaryTokens = tokenize(item.aiSummary || '');
    const itemNoteTokens = tokenize(item.userNote || '');

    // 1. Direct concept and tag matches (highest priority)
    for (const ideaToken of ideaTokens) {
      if (itemConcepts.some((c) => c === ideaToken || c.includes(ideaToken) || ideaToken.includes(c))) {
        score += 30;
        matchedWords.add(ideaToken);
      }
      if (itemAiTags.some((t) => t === ideaToken || t.includes(ideaToken) || ideaToken.includes(t))) {
        score += 25;
        matchedWords.add(ideaToken);
      }
      if (itemTags.some((t) => t === ideaToken || t.includes(ideaToken) || ideaToken.includes(t))) {
        score += 25;
        matchedWords.add(ideaToken);
      }
      if (itemTitleTokens.some((t) => t === ideaToken || t.includes(ideaToken) || ideaToken.includes(t))) {
        score += 20;
        matchedWords.add(ideaToken);
      }
      if (itemSummaryTokens.some((s) => s === ideaToken || s.includes(ideaToken))) {
        score += 15;
        matchedWords.add(ideaToken);
      }
      if (itemNoteTokens.some((n) => n === ideaToken || n.includes(ideaToken))) {
        score += 10;
        matchedWords.add(ideaToken);
      }
    }

    // 2. Cluster alignment
    for (const cluster of activeClusters) {
      const clusterWords = SEMANTIC_CLUSTERS[cluster];
      const hasClusterWordInItem = [
        ...itemConcepts,
        ...itemAiTags,
        ...itemTags,
        ...itemTitleTokens,
      ].some((w) => clusterWords.includes(w));

      if (hasClusterWordInItem) {
        score += 20;
        matchedWords.add(cluster);
      }
    }

    // Baseline minimum if broad interest aligns
    if (score === 0 && ideaTokens.size === 0) {
      // If user provided very minimal idea title, give slight baseline
      score = 30;
    }

    // Normalize confidence between 0.35 and 0.98
    let confidence = 0.35;
    if (score > 0) {
      confidence = Math.min(0.98, Math.max(0.40, Number((score / (score + 35)).toFixed(2))));
    } else {
      confidence = 0.30;
    }

    const matchedList = Array.from(matchedWords);
    let reason = 'Relevant material from your inspiration dump.';
    if (matchedList.length > 0) {
      reason = `Matches ${matchedList.slice(0, 3).map((w) => `"${w}"`).join(', ')} in dump tags and concepts.`;
    } else if (item.sourcePlatform) {
      reason = `Visual reference from ${item.sourcePlatform.toUpperCase()} archive.`;
    }

    results.push({
      inspirationId: item.id,
      inspiration: item,
      confidence,
      reason,
      matchedKeywords: matchedList,
    });
  }

  // Sort descending by confidence score
  results.sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, limit);
}
