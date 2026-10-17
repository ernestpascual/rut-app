export type InspirationKind = 'link' | 'note' | 'quote';

export type SourcePlatform =
  | 'instagram'
  | 'pinterest'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'youtube'
  | 'behance'
  | 'dribbble'
  | 'arena'
  | 'github'
  | 'vimeo'
  | 'medium'
  | 'substack'
  | 'web'
  | 'other';

export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

/**
 * Exact schema for an item stored in users/{userId}/inspirations/{id}
 */
export interface InspirationItem {
  id: string;
  ownerUid: string;
  kind: InspirationKind;
  folder?: string; // 'dump'
  title: string;
  url: string | null;
  normalizedUrl: string | null;
  sharedText: string | null;
  userNote: string | null;
  sourcePlatform: SourcePlatform | null;
  sourceDomain: string | null;
  sourceApp: string | null;
  siteName?: string | null;
  author?: string | null;
  caption?: string | null;
  previewDescription: string | null;
  remotePreviewImageUrl: string | null;
  editorialContext?: string | null;
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

/**
 * Scraped metadata per Instagram Reel in virtualized DOM
 */
export interface ScrapedReelMetadata {
  shortcode: string;           // e.g. "C1a2b3c4d5e" from /reel/{shortcode}/
  url: string;                 // Canonical URL: "https://www.instagram.com/reel/{shortcode}/"
  type: 'url';
  title?: string;              // First line of caption or derived title
  caption: string | null;      // Extracted from child <img> alt attribute
  thumbnailUrl: string | null; // Extracted from child <img> src
  viewCountText: string | null;// Extracted from overlay span text if present
  collection: {
    id: string;
    slug: string;
    name: string;
  };
  source: 'instagram_collection' | 'facebook_collection' | 'pinterest_collection' | string;
  scrapedAt: string;           // ISO timestamp
}

export interface CollectionInfo {
  detected: boolean;
  slug?: string;
  id?: string;
  title?: string;
  url?: string;
}

export interface UserSnapshot {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Runtime messages
export type ExtensionMessage =
  | { type: 'AUTH_LOGIN_GOOGLE' }
  | { type: 'AUTH_LOGIN_EMAIL'; email: string; pass: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_GET_STATE' }
  | { type: 'CHECK_COLLECTION_STATUS' }
  | { type: 'START_SCRAPING' }
  | { type: 'STOP_SCRAPING' }
  | { type: 'SCRAPE_PROGRESS'; count: number; collectionName: string }
  | { type: 'SCRAPE_COMPLETE'; items: ScrapedReelMetadata[] }
  | {
      type: 'SYNC_ITEMS';
      items: ScrapedReelMetadata[];
      customTags?: string[];
      collectionOrigin?: string;
      platform?: 'instagram' | 'facebook' | 'pinterest';
    }
  | {
      type: 'DUMP_URL_ITEM';
      payload: {
        platform?: SourcePlatform;
        url: string;
        title?: string;
        tags: string[];
        collectionOrigin?: string;
        userNote?: string;
      };
    };
