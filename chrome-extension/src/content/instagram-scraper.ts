import { CollectionInfo, ScrapedReelMetadata } from '../types/insight';

let isScrapingActive = false;
let shouldStopScraping = false;
const harvestedReels = new Map<string, ScrapedReelMetadata>();

/**
 * Validates if current page is an Instagram Saved Collection
 */
function getCollectionDetails(): CollectionInfo {
  const path = window.location.pathname;

  // Pattern 1: /{username}/saved/{slug}/{id}/
  const collectionMatch = path.match(/^\/([^/]+)\/saved\/([^/]+)\/([^/]+)\/?/);
  if (collectionMatch) {
    const slug = collectionMatch[2];
    const id = collectionMatch[3];
    // Find header element for title
    const headerTitle =
      document.querySelector('main header h1')?.textContent?.trim() ||
      document.querySelector('header h1')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      slug.replace(/-/g, ' ');

    return {
      detected: true,
      slug,
      id,
      title: headerTitle,
      url: window.location.href,
    };
  }

  // Pattern 2: /{username}/saved/all-posts/ or /{username}/saved/
  const allSavedMatch = path.match(/^\/([^/]+)\/saved(?:\/all-posts)?\/?/);
  if (allSavedMatch) {
    const headerTitle =
      document.querySelector('main header h1')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      'All Saved Posts';

    return {
      detected: true,
      slug: 'all-posts',
      id: 'all',
      title: headerTitle,
      url: window.location.href,
    };
  }

  return { detected: false };
}

/**
 * Scans the current DOM nodes and collects reel metadata before nodes unmount
 */
function harvestVisibleReels(collection: CollectionInfo): number {
  if (!collection.detected) return 0;

  // Query all link nodes targeting reels or posts in the grid
  const links = document.querySelectorAll<HTMLAnchorElement>(
    'main a[href*="/reel/"], main a[href*="/p/"], a[href*="/reel/"], a[href*="/p/"]'
  );

  links.forEach((link) => {
    const href = link.getAttribute('href') || link.href;
    const match = href.match(/\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
    if (!match) return;

    const shortcode = match[1];
    if (harvestedReels.has(shortcode)) return; // Already collected

    // Extract child image data
    const img = link.querySelector<HTMLImageElement>('img');
    const rawCaption = img?.getAttribute('alt') || null;
    const thumbnailUrl = img?.getAttribute('src') || null;

    // View count text if rendered in hover overlay
    const overlaySpan = link.querySelector<HTMLSpanElement>('span');
    const viewCountText = overlaySpan?.textContent?.trim() || null;

    // First line of caption for readable title
    const firstLine = rawCaption ? rawCaption.split('\n')[0]?.trim() : '';
    const title =
      firstLine && firstLine.length > 5
        ? firstLine.slice(0, 100)
        : `Instagram Reel (${shortcode})`;

    const reelData: ScrapedReelMetadata = {
      shortcode,
      url: `https://www.instagram.com/reel/${shortcode}/`,
      type: 'url',
      title,
      caption: rawCaption,
      thumbnailUrl,
      viewCountText,
      collection: {
        id: collection.id || 'all',
        slug: collection.slug || 'saved',
        name: collection.title || 'Saved Collection',
      },
      source: 'instagram_collection',
      scrapedAt: new Date().toISOString(),
    };

    harvestedReels.set(shortcode, reelData);
  });

  return harvestedReels.size;
}

/**
 * Smoothly auto-scrolls through the virtualized grid with jitter to avoid rate limits
 */
async function startAutoScrapeLoop(collection: CollectionInfo): Promise<ScrapedReelMetadata[]> {
  isScrapingActive = true;
  shouldStopScraping = false;
  harvestedReels.clear();

  // Initial harvest on current view
  harvestVisibleReels(collection);

  let lastHeight = document.documentElement.scrollHeight;
  let stagnantCount = 0;

  while (isScrapingActive && !shouldStopScraping) {
    // 1. Harvest visible elements before scroll
    const currentCount = harvestVisibleReels(collection);

    // 2. Broadcast real-time progress to popup
    try {
      chrome.runtime.sendMessage({
        type: 'SCRAPE_PROGRESS',
        count: currentCount,
        collectionName: collection.title || 'Collection',
      });
    } catch {}

    // 3. Incrementally scroll down
    window.scrollBy(0, window.innerHeight * 0.85);

    // 4. Wait with randomized jitter (1200ms - 1600ms) for DOM hydration
    const jitterMs = 1200 + Math.floor(Math.random() * 400);
    await new Promise((res) => setTimeout(res, jitterMs));

    // 5. Check if page height grew
    const newHeight = document.documentElement.scrollHeight;
    if (newHeight === lastHeight) {
      stagnantCount++;
      // Wait extra 1500ms on stagnant check to allow slow network requests
      await new Promise((res) => setTimeout(res, 1500));
      harvestVisibleReels(collection);
      if (document.documentElement.scrollHeight === lastHeight && stagnantCount >= 3) {
        console.log('[rut-extension] Reached bottom of collection.');
        break;
      }
    } else {
      stagnantCount = 0;
      lastHeight = newHeight;
    }
  }

  isScrapingActive = false;
  const finalItems = Array.from(harvestedReels.values());

  try {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_COMPLETE',
      items: finalItems,
    });
  } catch {}

  return finalItems;
}

// Listen for commands from the Popup UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_COLLECTION_STATUS') {
    const details = getCollectionDetails();
    sendResponse({
      ...details,
      harvestedCount: harvestedReels.size,
      isScraping: isScrapingActive,
    });
    return true;
  }

  if (message.type === 'START_SCRAPING') {
    const collection = getCollectionDetails();
    if (!collection.detected) {
      sendResponse({ success: false, error: 'Not on an Instagram Saved Collection page.' });
      return true;
    }

    startAutoScrapeLoop(collection).then((items) => {
      sendResponse({ success: true, count: items.length });
    });
    return true;
  }

  if (message.type === 'STOP_SCRAPING') {
    shouldStopScraping = true;
    isScrapingActive = false;
    sendResponse({ success: true, count: harvestedReels.size });
    return true;
  }
});
