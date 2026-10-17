import {
  AIProvider,
  EmbeddingResult,
  ChatRequest,
  ChatResult,
  InspirationInput,
  SummaryResult,
  ProjectLinkRequest,
  ProjectLinkResult
} from '../../src/ai/provider';
import { calculateCostMicros } from '../../src/cost/pricing';

export class MockAIProvider implements AIProvider {
  private readonly modelName = 'mock-model';

  /**
   * Generates a deterministic pseudo-embedding based on string hash.
   */
  async generateEmbedding(input: string): Promise<EmbeddingResult> {
    const chars = input.length;
    const embedding: number[] = new Array(64).fill(0);
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      embedding[i % 64] = ((embedding[i % 64] + code) % 1000) / 1000;
    }
    // Normalize vector
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    const normalized = embedding.map((v) => v / norm);

    return {
      embedding: normalized,
      model: this.modelName,
      charCount: chars,
    };
  }

  /**
   * Summarizes an inspiration item with deterministic tags and concepts.
   */
  async summarizeInspiration(input: InspirationInput): Promise<SummaryResult> {
    const text = [input.title, input.userNote, input.sharedText, input.previewDescription]
      .filter(Boolean)
      .join(' ');

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const uniqueWords = Array.from(new Set(words));
    const aiTags = uniqueWords.slice(0, 4);
    const concepts = uniqueWords.slice(4, 7);

    const aiSummary = `Summary of "${input.title}": ${
      input.userNote ? `Sparks idea: ${input.userNote}. ` : ''
    }Key themes include ${aiTags.join(', ') || 'ideas, inspiration'}.`;

    const embedResult = await this.generateEmbedding(text);

    const inputTokens = Math.max(10, Math.round(text.length / 4));
    const outputTokens = Math.round(aiSummary.length / 4);
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens, text.length);

    return {
      aiSummary,
      aiTags: aiTags.length > 0 ? aiTags : ['inspiration'],
      concepts: concepts.length > 0 ? concepts : ['concept'],
      embedding: embedResult.embedding,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }

  /**
   * Generates dynamic, context-aware agent response across ungrounded, dump-grounded, and search modes.
   */
  async generateChatResponse(input: ChatRequest): Promise<ChatResult> {
    const allContext = [...input.pinnedInspirations, ...input.retrievedInspirations];
    const seen = new Set<string>();
    const contextItems = allContext.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    const STOP_WORDS = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
      'will', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'all', 'any', 'can',
      'could', 'should', 'would', 'about', 'into', 'some', 'than', 'them', 'then', 'there',
      'these', 'they', 'you', 'your', 'our', 'just', 'more', 'also', 'like', 'think',
      'make', 'know', 'want', 'give', 'tell', 'tells', 'help', 'much', 'many', 'good', 'well',
      'come', 'look', 'find', 'talk', 'need', 'such', 'very', 'even', 'most', 'only',
      'hello', 'hey', 'okay', 'sure', 'please', 'thanks', 'thank',
      'something', 'anything', 'everything', 'nothing', 'things', 'thing',
      'create', 'uses', 'used', 'using', 'device', 'devices', 'bank', 'dump', 'save', 'saves'
    ]);

    const history = input.chatHistory || [];
    const isOngoing = history.length > 0;
    const msg = input.message.toLowerCase();

    // Anti-fatigue: detect inspirations that were already discussed in recent history (unless re-evaluating)
    const alreadyCited = new Set<string>();
    if (!input.isReevaluate) {
      for (const turn of history.slice(-6)) {
        for (const item of contextItems) {
          if (
            turn.content.toLowerCase().includes(item.title.toLowerCase()) ||
            turn.content.includes(item.id)
          ) {
            alreadyCited.add(item.id);
          }
        }
      }
    }

    const isDumpAsk =
      /\b(dump|bank|saves?|saved|inspirations?|references?|bookmarks?|vault)\b/i.test(msg) ||
      /\b(check|pull|look up|show me|find|from my)\b/i.test(msg);

    // Extract genuine topical keywords from user query
    const queryKeywords = msg
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    // Only consider items fresh and genuinely matching query keywords
    const availableFresh = input.isReevaluate ? contextItems : contextItems.filter((item) => !alreadyCited.has(item.id));
    const genuinelyMatching = availableFresh.filter((item) => {
      const text = `${item.title} ${item.summary || ''} ${item.userNote || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')}`.toLowerCase();
      return queryKeywords.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`, 'i').test(text);
      });
    });

    const isCombine = /\b(combine|blend|fuse|pair|merge|connect)\b/i.test(msg);
    const citedIds: string[] = [];
    const webSources: Array<{ title: string; uri: string }> = [];

    // Detect domain
    const isCorrection = /\b(doesn'?t answer|not what i asked|wrong|missed the point|refocus|irrelevant|off track)\b/i.test(msg);
    const isIoT = /\b(iot|wifi|wi-fi|signal|signals|rf|mapping|radar|sensor|sensors|esp32|microcontroller|antenna|arduino|hardware)\b/i.test(msg);
    const isSoftware = /\b(app|api|database|backend|frontend|react|node|cloud|server|auth|typescript|code|architecture)\b/i.test(msg);
    const isTypography = /\b(font|type|typography|serif|sans|headline|kerning)\b/i.test(msg);
    const isColor = /\b(color|palette|shade|monochrome|contrast|tone)\b/i.test(msg);
    const isMaterial = /\b(material|texture|concrete|wood|glass|metal|paper|surface)\b/i.test(msg);
    const isLayout = /\b(layout|grid|space|margin|composition|hierarchy|structure)\b/i.test(msg);

    let response = '';

    // Grounding Mode C: Live web search
    if (input.webAccess) {
      if (isIoT) {
        webSources.push(
          { title: 'ESP32 CSI Sensing Toolkit', uri: 'https://github.com/espressif/esp-csi' },
          { title: 'IEEE WiFi Signal Tomography Research', uri: 'https://ieeexplore.ieee.org' }
        );
      } else {
        webSources.push(
          { title: 'Contemporary Editorial & Identity Index', uri: 'https://koto.studio' },
          { title: 'Type Design & Spatial Systems', uri: 'https://abcdinamo.com' }
        );
      }
    }

    // 1. User is correcting the assistant / asking to refocus
    if (isCorrection) {
      response = `Got it, my mistake—let's refocus directly on what you need without the fluff. What specific part or technical challenge should we address first?`;
    }
    // 2. Multi-item combination (e.g. unit tests or explicit pairing prompts)
    else if (isCombine && contextItems.length >= 2) {
      const itemA = contextItems[0];
      const itemB = contextItems[1];
      citedIds.push(itemA.id, itemB.id);
      response = `Combining the structural language of **${itemA.title}** with the functional form of **${itemB.title}** creates a compelling contrast. We can use the monolithic weight of ${itemA.title} as the anchor, balanced by the lighter details from ${itemB.title}.`;
    }
    // 3. User specifically asked to check / pull from bank
    else if (isDumpAsk) {
      if (genuinelyMatching.length > 0) {
        const match = genuinelyMatching[0];
        citedIds.push(match.id);
        const snippet = match.userNote || match.summary || '';
        response = `Pulled this from your bank: **${match.title}**${snippet ? ` (${snippet.slice(0, 90)})` : ''}.\n\nThis directly connects to what you're exploring. How do you want to build on it?`;
      } else {
        // Honest bank grounding: tell user nothing matches, then answer intelligently
        let substantiveAnswer = '';
        if (isIoT) {
          substantiveAnswer = `To map spaces or detect movement using WiFi signals, here are the three primary engineering methods:
1. **WiFi CSI (Channel State Information):** Uses OFDM subcarrier phase and amplitude shifts on chips like the ESP32-S3 or Intel 5300 NIC to detect multi-path reflections from walls, obstacles, and human motion.
2. **Radio Tomographic Imaging (RTI):** Places multiple cheap transceiver nodes around a room's perimeter to measure signal attenuation across RF links, generating a 2D occupancy heatmap.
3. **Synthetic Aperture Radar (SAR):** Moves a single WiFi receiver along a linear track to construct spatial reflectivity maps.

Which implementation fits your hardware setup best?`;
        } else if (isSoftware) {
          substantiveAnswer = `For building this architecture, establish a modular service layer with typed interfaces and decoupled persistence. Where is the main bottleneck you anticipate?`;
        } else {
          substantiveAnswer = `Let's break down the core requirement. What's the single critical constraint or goal you need to solve first?`;
        }

        response = `I checked your bank, and you don't have any saved notes or references on this topic yet.\n\n${substantiveAnswer}`;
      }
    }
    // 4. Domain-specific responses
    else if (isIoT) {
      response = `For WiFi-based mapping and spatial sensing, the standard approach is WiFi CSI (Channel State Information) using an ESP32-S3 or dedicated SDR. By analyzing multi-path phase shifts across subcarriers, you can detect movement and estimate indoor geometry without optical cameras.\n\nAre you looking to build single-device radar or an array of mesh nodes?`;
    } else if (isSoftware) {
      response = `For this system, focus on low-latency state synchronization and a clean domain boundary. Start with the data schema and API contracts before building UI.\n\nWhat is your preferred stack for this?`;
    } else if (contextItems.length > 0 && (isMaterial || isColor || isTypography || isLayout)) {
      const activeItem = genuinelyMatching[0] || contextItems[0];
      citedIds.push(activeItem.id);
      if (isTypography) {
        response = `Pairing a sharp monospace with an architectural grotesque would create good friction here—similar to the hierarchy in your save on **${activeItem.title}**.\n\nKeep the body text restrained and let the headline carry the visual weight.`;
      } else if (isColor) {
        response = `A stark, high-contrast palette—deep obsidian, optical white, and an unbleached neutral—would keep this grounded, echoing the tone in **${activeItem.title}**.\n\nDo you want to lean dark or keep it primarily light?`;
      } else if (isMaterial) {
        response = `Borrowing from the raw tactile quality in **${activeItem.title}**, contrasting textured surfaces against refined, clinical details will give this concept immediate presence.\n\nShould we emphasize the raw or the polished side first?`;
      } else {
        response = `Anchoring the composition around a strong asymmetric grid will give this the structure it needs, drawing from the spatial tension in **${activeItem.title}**.\n\nHow tight do you want the pacing between elements?`;
      }
    } else if (isTypography) {
      response = `For this, a heavy, tightly tracked display face balanced against a clinical, utilitarian grotesque will give it personality without feeling fussy. Keep the tracking tight and line height measured.`;
    } else if (isColor) {
      response = `Try limiting the palette to two strict values: a deep carbon black and pure optical white, with a single muted raw tone to soften transitions.`;
    } else if (isMaterial) {
      response = `The key is textural contrast: pair raw, porous materials against razor-sharp, reflective elements. That friction makes minimal work feel deliberate rather than empty.`;
    } else if (isLayout) {
      response = `Give the primary element overwhelming weight and push everything else into strict, quiet margins. Expansive negative space makes the core idea hit harder.`;
    } else if (isOngoing) {
      response = `That direction makes sense. What's the biggest technical or design decision in front of you right now?`;
    } else {
      response = `Sharp premise. What's the single non-negotiable anchor you want to prioritize first?`;
    }

    if (input.webAccess && webSources.length > 0) {
      if (isIoT) {
        response += `\n\nReferenced live precedents: ESP32 CSI toolkits on GitHub and IEEE wireless sensing publications.`;
      } else {
        response += `\n\nLooking at contemporary precedents, studios like Koto and Dinamo are exploring similar physical-digital friction with oversized editorial type and tactile spatial framing.`;
      }
    }

    const inputTokens = Math.max(20, Math.round(input.message.length / 4) + contextItems.length * 30);
    const outputTokens = Math.round(response.length / 4);
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens);

    return {
      response,
      sourceInspirationIds: citedIds,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
      webSources: webSources.length > 0 ? webSources : undefined,
    };
  }

  /**
   * Suggests project links with realistic confidence scores and rationale.
   */
  async suggestProjectLinks(input: ProjectLinkRequest): Promise<ProjectLinkResult> {
    const suggestions = input.inspirations.slice(0, 4).map((item, idx) => {
      const confidence = Number((0.72 + idx * 0.08).toFixed(2));
      return {
        inspirationId: item.id,
        reason: `Relevance to "${input.projectTitle}": matches project themes and conceptual keywords.`,
        confidence: Math.min(0.95, confidence),
      };
    });

    const inputTokens = Math.max(30, Math.round((input.projectTitle.length + (input.projectNotes || '').length) / 4));
    const outputTokens = suggestions.length * 30;
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens);

    return {
      suggestions,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }
}
