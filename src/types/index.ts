export type InspirationKind = 'link' | 'note' | 'quote';

export type SourcePlatform =
  | 'instagram'
  | 'pinterest'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'youtube'
  | 'web'
  | 'other';

export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface InspirationItem {
  id: string;
  ownerUid: string;
  kind: InspirationKind;
  folder?: string; // Default: 'dump' (Everything starts in the dump folder)
  title: string;
  url: string | null;
  normalizedUrl: string | null;
  sharedText: string | null;
  userNote: string | null;
  sourcePlatform: SourcePlatform | null;
  sourceDomain: string | null;
  sourceApp: string | null;
  previewDescription: string | null;
  remotePreviewImageUrl: string | null;
  tags: string[];
  aiTags: string[];
  concepts: string[];
  aiSummary: string | null;
  processingStatus: ProcessingStatus;
  processingErrorCode: string | null;
  duplicateOf: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  capturedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system-summary';
  content: string;
  sourceInspirationIds: string[];
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostMicros: number | null;
  status: 'pending' | 'complete' | 'failed';
  createdAt: number;
}

export interface ChatSession {
  id: string;
  ownerUid: string;
  title: string;
  pinnedInspirationIds: string[];
  summary: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectInspirationLink {
  id: string;
  inspirationId: string;
  linkedBy: 'user' | 'ai';
  reason: string | null;
  confidence: number | null;
  createdAt: number;
}

export interface Project {
  id: string;
  ownerUid: string;
  title: string;
  brief: string | null;
  notes: string;
  status: 'active' | 'archived' | 'completed';
  tags: string[];
  autoLinkEnabled: boolean;
  autoLinkConfidenceThreshold: number;
  createdAt: number;
  updatedAt: number;
}

export interface UsageEvent {
  id: string;
  ownerUid: string;
  operation: 'indexing' | 'chat' | 'search' | 'project_link';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  timestamp: number;
}

export interface UsageSummary {
  period: string; // "today" | "2026-09"
  totalCostMicros: number;
  totalIndexed: number;
  totalChatRequests: number;
  totalEmbeddings: number;
  lastUpdated: number;
}

export interface IncomingSharePayload {
  title?: string | null;
  text?: string | null;
  url?: string | null;
  hasBinaryAttachment?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  role: 'user' | string;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
}

