import React, { useState, useEffect } from 'react';
import { CollectionInfo, ScrapedReelMetadata, UserSnapshot } from '../types/insight';
import { RUT_WEB_APP_URL } from '../config/firebase';

export const EXTENSION_VERSION =
  (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '1.0.3';

export function Popup() {
  const [user, setUser] = useState<UserSnapshot | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Email/Pass Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Active Tab & Collection State
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [checkingTab, setCheckingTab] = useState(true);

  // Mode: 'quick_dump' | 'collection_sync'
  const [activeMode, setActiveMode] = useState<'quick_dump' | 'collection_sync'>('quick_dump');

  // Quick Dump State
  const [dumpUrl, setDumpUrl] = useState('');
  const [dumpTitle, setDumpTitle] = useState('');
  const [dumpTags, setDumpTags] = useState('');
  const [dumpNote, setDumpNote] = useState('');
  const [dumping, setDumping] = useState(false);
  const [dumpSuccessItem, setDumpSuccessItem] = useState<{
    title: string;
    id: string;
    alreadyExists?: boolean;
  } | null>(null);
  const [dumpError, setDumpError] = useState<string | null>(null);

  // Collection Sync State
  const [syncPlatform, setSyncPlatform] = useState<'instagram' | 'facebook' | 'pinterest'>('instagram');
  const [collectionCustomTags, setCollectionCustomTags] = useState('');
  const [collectionOriginTag, setCollectionOriginTag] = useState('');

  // Scraping & Sync State
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 1. Check Auth State on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'AUTH_GET_STATE' }, (res) => {
      if (res?.user) {
        setUser(res.user);
      } else {
        chrome.storage.local.get('authUser', (data) => {
          if (data.authUser) setUser(data.authUser);
        });
      }
      setAuthLoading(false);
    });
  }, []);

  // 2. Inspect Active Tab & Detect Context
  const inspectActiveTab = () => {
    setCheckingTab(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const current = tabs[0];
      setActiveTab(current || null);

      if (current?.url) {
        if (current.url.includes('pinterest.com')) {
          setSyncPlatform('pinterest');
          setDumpUrl(current.url);
          if (current.title) {
            const cleanTitle = current.title.replace(/\s*\|.*Pinterest/i, '').trim();
            setDumpTitle(cleanTitle);
            setCollectionOriginTag(cleanTitle);
          }
        } else if (current.url.includes('facebook.com')) {
          setSyncPlatform('facebook');
          setDumpUrl(current.url);
          if (current.title) {
            const cleanTitle = current.title.replace(/\s*\|.*Facebook/i, '').trim();
            setDumpTitle(cleanTitle);
            setCollectionOriginTag(cleanTitle);
          }
        } else if (current.url.includes('instagram.com')) {
          setSyncPlatform('instagram');
          setDumpUrl(current.url);
          if (current.title) {
            const cleanTitle = current.title.replace(/\s*•\s*Instagram.*$/i, '').trim();
            setDumpTitle(cleanTitle);
          }
        } else {
          setDumpUrl(current.url);
          if (current.title) setDumpTitle(current.title.trim());
        }
      }

      if (current?.id && current.url?.includes('instagram.com')) {
        chrome.tabs.sendMessage(current.id, { type: 'CHECK_COLLECTION_STATUS' }, (res) => {
          if (chrome.runtime.lastError || !res) {
            setCollection({ detected: false });
          } else {
            setCollection(res);
            if (res.title) {
              setCollectionOriginTag(res.title);
            }
            if (res.isScraping) {
              setIsScraping(true);
              setScrapedCount(res.harvestedCount || 0);
              setActiveMode('collection_sync');
            }
          }
          setCheckingTab(false);
        });
      } else {
        setCollection({ detected: false });
        setCheckingTab(false);
      }
    });
  };

  useEffect(() => {
    if (user) {
      inspectActiveTab();
    }
  }, [user]);

  // 3. Listen for Scraping Messages from Content Script
  useEffect(() => {
    const messageListener = (msg: any) => {
      if (msg.type === 'SCRAPE_PROGRESS') {
        setIsScraping(true);
        setScrapedCount(msg.count);
      } else if (msg.type === 'SCRAPE_COMPLETE') {
        setIsScraping(false);
        setScrapedCount(msg.items.length);
        handleSyncToFirestore(msg.items, 'instagram');
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [collectionCustomTags, collectionOriginTag, collection]);

  // Auth Handlers
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAuthError(null);
    setSubmittingAuth(true);
    chrome.runtime.sendMessage({ type: 'AUTH_LOGIN_EMAIL', email: email.trim(), pass: password }, (res) => {
      setSubmittingAuth(false);
      if (res?.success) {
        setUser(res.user);
      } else {
        setAuthError(res?.error || 'Invalid credentials.');
      }
    });
  };

  const handleSignOut = () => {
    chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' }, () => {
      setUser(null);
      setCollection(null);
      setSyncedCount(null);
      setDumpSuccessItem(null);
    });
  };

  // Quick Dump Handler
  const handleDumpItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dumpUrl.trim()) {
      setDumpError('Please enter a URL to dump.');
      return;
    }

    setDumping(true);
    setDumpError(null);
    setDumpSuccessItem(null);

    const parsedTags = dumpTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Auto-detect platform from URL
    const detectPlatform = (urlStr: string) => {
      const lower = urlStr.toLowerCase();
      if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
      if (lower.includes('pinterest.com') || lower.includes('pin.it')) return 'pinterest';
      if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'facebook';
      if (lower.includes('tiktok.com')) return 'tiktok';
      if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
      return 'web';
    };

    chrome.runtime.sendMessage(
      {
        type: 'DUMP_URL_ITEM',
        payload: {
          platform: detectPlatform(dumpUrl.trim()) as any,
          url: dumpUrl.trim(),
          title: dumpTitle.trim() || undefined,
          tags: parsedTags,
          userNote: dumpNote.trim() || undefined,
        },
      },
      (res) => {
        setDumping(false);
        if (res?.success) {
          setDumpSuccessItem({
            title: res.title || 'Saved Link',
            id: res.id,
            alreadyExists: res.alreadyExists,
          });
        } else {
          setDumpError(res?.error || 'Failed to dump item to Rut Bank.');
        }
      }
    );
  };

  // Scraping & Sync Handlers
  const handleStartScrape = () => {
    if (!activeTab?.id) return;
    setIsScraping(true);
    setScrapedCount(0);
    setSyncedCount(null);
    setSyncError(null);

    chrome.tabs.sendMessage(activeTab.id, { type: 'START_SCRAPING' }, (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        setIsScraping(false);
        setSyncError(res?.error || 'Could not communicate with Instagram tab. Please refresh page.');
      }
    });
  };

  const handleStopScrapeEarly = () => {
    if (!activeTab?.id) return;
    chrome.tabs.sendMessage(activeTab.id, { type: 'STOP_SCRAPING' }, () => {
      setIsScraping(false);
    });
  };

  const handleStartFacebookSync = async () => {
    if (!activeTab?.id) return;
    setIsScraping(true);
    setScrapedCount(0);
    setSyncedCount(null);
    setSyncError(null);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          const items: Array<{
            shortcode: string;
            url: string;
            title: string;
            caption: string | null;
            thumbnailUrl: string | null;
          }> = [];
          const seen = new Set<string>();

          const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
          for (const a of links) {
            const href = a.href;
            if (!href || href.startsWith('javascript:') || href.includes('/login') || href.includes('/help/')) continue;
            const isItemLink =
              href.includes('/reel/') ||
              href.includes('/videos/') ||
              href.includes('/watch') ||
              href.includes('/posts/') ||
              href.includes('/photo') ||
              href.includes('/saved/');

            if (isItemLink && !seen.has(href)) {
              seen.add(href);
              const img = a.querySelector<HTMLImageElement>('img') || a.parentElement?.querySelector<HTMLImageElement>('img');
              const text = a.textContent?.trim() || a.getAttribute('aria-label') || '';
              const idMatch = href.match(/([0-9]{7,})/);
              const shortcode = idMatch ? idMatch[1] : Math.random().toString(36).substring(2, 10);
              items.push({
                shortcode,
                url: href,
                title: text.slice(0, 100) || 'Facebook Saved Item',
                caption: text || null,
                thumbnailUrl: img?.src || null,
              });
            }
          }
          return items;
        },
      });

      const harvested = results?.[0]?.result || [];
      if (harvested.length === 0) {
        setIsScraping(false);
        setSyncError('No saved items detected on this Facebook page. Open facebook.com/saved.');
        return;
      }

      setScrapedCount(harvested.length);
      setIsScraping(false);

      const mappedItems: ScrapedReelMetadata[] = harvested.map((item: any) => ({
        shortcode: item.shortcode,
        url: item.url,
        type: 'url',
        title: item.title,
        caption: item.caption,
        thumbnailUrl: item.thumbnailUrl,
        viewCountText: null,
        collection: {
          id: 'fb-saved',
          slug: 'saved',
          name: collectionOriginTag.trim() || activeTab.title || 'Facebook Saved',
        },
        source: 'facebook_collection',
        scrapedAt: new Date().toISOString(),
      }));

      handleSyncToFirestore(mappedItems, 'facebook');
    } catch (err: any) {
      setIsScraping(false);
      setSyncError(err.message || 'Failed to inspect Facebook page.');
    }
  };

  const handleStartPinterestSync = async () => {
    if (!activeTab?.id) return;
    setIsScraping(true);
    setScrapedCount(0);
    setSyncedCount(null);
    setSyncError(null);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          const items: Array<{
            shortcode: string;
            url: string;
            title: string;
            caption: string | null;
            thumbnailUrl: string | null;
          }> = [];
          const seen = new Set<string>();

          const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/pin/"]'));
          for (const a of links) {
            const href = a.href;
            const match = href.match(/\/pin\/([0-9a-zA-Z_-]+)/);
            if (!match) continue;
            const shortcode = match[1];
            if (seen.has(shortcode)) continue;
            seen.add(shortcode);

            const img = a.querySelector<HTMLImageElement>('img') || a.parentElement?.querySelector<HTMLImageElement>('img');
            const alt = img?.alt || a.textContent?.trim() || '';
            const title = alt.slice(0, 100) || `Pinterest Pin (${shortcode})`;

            items.push({
              shortcode,
              url: `https://www.pinterest.com/pin/${shortcode}/`,
              title,
              caption: alt || null,
              thumbnailUrl: img?.src || null,
            });
          }
          return items;
        },
      });

      const harvested = results?.[0]?.result || [];
      if (harvested.length === 0) {
        setIsScraping(false);
        setSyncError('No pins detected on this page. Navigate to a Pinterest board.');
        return;
      }

      setScrapedCount(harvested.length);
      setIsScraping(false);

      const mappedItems: ScrapedReelMetadata[] = harvested.map((item: any) => ({
        shortcode: item.shortcode,
        url: item.url,
        type: 'url',
        title: item.title,
        caption: item.caption,
        thumbnailUrl: item.thumbnailUrl,
        viewCountText: null,
        collection: {
          id: 'pinterest-board',
          slug: 'board',
          name: collectionOriginTag.trim() || activeTab.title || 'Pinterest Board',
        },
        source: 'pinterest_collection',
        scrapedAt: new Date().toISOString(),
      }));

      handleSyncToFirestore(mappedItems, 'pinterest');
    } catch (err: any) {
      setIsScraping(false);
      setSyncError(err.message || 'Failed to inspect Pinterest board.');
    }
  };

  const handleSyncToFirestore = (
    items: ScrapedReelMetadata[],
    platform: 'instagram' | 'facebook' | 'pinterest' = syncPlatform
  ) => {
    setIsSyncing(true);
    const parsedCustomTags = collectionCustomTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    chrome.runtime.sendMessage(
      {
        type: 'SYNC_ITEMS',
        items,
        customTags: parsedCustomTags,
        collectionOrigin: collectionOriginTag.trim() || collection?.title || undefined,
        platform,
      },
      (res) => {
        setIsSyncing(false);
        if (res?.success) {
          setSyncedCount(res.count);
        } else {
          setSyncError(res?.error || 'Failed to sync to Rut Bank.');
        }
      }
    );
  };

  // ----------------------------------------------------
  // RENDER: Loading
  // ----------------------------------------------------
  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>EXTENSION</span>
            <span style={styles.versionBadge}>v{EXTENSION_VERSION}</span>
          </div>
        </div>
        <div style={styles.centerBox}>
          <p style={styles.subtitle}>Connecting to rut...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STATE 1: Unauthenticated
  // ----------------------------------------------------
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>EXTENSION</span>
            <span style={styles.versionBadge}>v{EXTENSION_VERSION}</span>
          </div>
        </div>

        <div style={styles.banner}>
          <p style={styles.bannerTitle}>DUMP & SYNC TO RUT BANK</p>
          <p style={styles.bannerDesc}>
            Sign in with your rut account to dump links or sync entire collections with tags & origin preserved.
          </p>
        </div>

        {authError && <div style={styles.errorBox}>{authError}</div>}

        <form onSubmit={handleEmailLogin} style={styles.form}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={submittingAuth} style={styles.btnPrimary}>
            {submittingAuth ? 'AUTHENTICATING...' : 'SIGN IN'}
          </button>
        </form>
      </div>
    );
  }

  // ----------------------------------------------------
  // STATE 2: Syncing / Completed Collection Sync
  // ----------------------------------------------------
  if (isScraping || isSyncing || syncedCount !== null) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>SYNCING</span>
            <span style={styles.versionBadge}>v{EXTENSION_VERSION}</span>
          </div>
          <button onClick={handleSignOut} style={styles.linkBtn}>LOGOUT</button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardMetaRow}>
            <span style={styles.cardTag}>COLLECTION ORIGIN</span>
            <span style={styles.cardTitle}>{collectionOriginTag || collection?.title || 'Saved Items'}</span>
          </div>

          {isScraping && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.progressRow}>
                <span style={styles.pulseDot} />
                <span style={styles.progressText}>Scanning collection DOM...</span>
              </div>
              <div style={styles.countDisplay}>
                <span style={styles.countNumber}>{scrapedCount}</span>
                <span style={styles.countLabel}>ITEMS DISCOVERED</span>
              </div>
              <p style={styles.subtext}>Extracting captions, thumbnails, and origin tags with rate-limit protection.</p>
              {syncPlatform === 'instagram' && (
                <button onClick={handleStopScrapeEarly} style={{ ...styles.btnSecondary, marginTop: '14px' }}>
                  STOP & SYNC EARLY ({scrapedCount})
                </button>
              )}
            </div>
          )}

          {isSyncing && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.progressRow}>
                <span style={styles.pulseDot} />
                <span style={styles.progressText}>Writing batch to Firestore...</span>
              </div>
              <p style={styles.subtext}>Committing {scrapedCount} items with origin tags to your Rut Bank.</p>
            </div>
          )}

          {syncedCount !== null && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.successBanner}>
                ✓ SUCCESSFULLY SYNCED {syncedCount} ITEMS
              </div>
              <p style={styles.subtext}>
                Origin collection tag and custom tags have been applied to all items in your Rut Bank!
              </p>
              <button
                onClick={() => chrome.tabs.create({ url: `${RUT_WEB_APP_URL}/bank` })}
                style={{ ...styles.btnPrimary, marginTop: '14px' }}
              >
                OPEN RUT BANK ↗
              </button>
              <button
                onClick={() => {
                  setSyncedCount(null);
                  inspectActiveTab();
                }}
                style={{ ...styles.btnSecondary, marginTop: '8px' }}
              >
                SYNC ANOTHER COLLECTION
              </button>
            </div>
          )}

          {syncError && <div style={{ ...styles.errorBox, marginTop: '12px' }}>{syncError}</div>}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STATE 3: Authenticated — Main Dashboard
  // ----------------------------------------------------
  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <span style={styles.logo}>RUT</span>
          <span style={styles.badge}>SYNC</span>
          <span style={styles.versionBadge}>v{EXTENSION_VERSION}</span>
        </div>
        <button onClick={handleSignOut} style={styles.linkBtn}>LOGOUT</button>
      </div>

      {/* User Status Bar */}
      <div style={styles.userBar}>
        <span style={styles.userDot} />
        <span style={styles.userEmail}>{user.email || user.uid}</span>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={styles.modeTabsRow}>
        <button
          onClick={() => setActiveMode('quick_dump')}
          style={{
            ...styles.modeTab,
            ...(activeMode === 'quick_dump' ? styles.modeTabActive : {}),
          }}
        >
          ⚡ DUMP LINK
        </button>
        <button
          onClick={() => setActiveMode('collection_sync')}
          style={{
            ...styles.modeTab,
            ...(activeMode === 'collection_sync' ? styles.modeTabActive : {}),
          }}
        >
          📁 SYNC COLLECTION
        </button>
      </div>

      {/* MODE 1: QUICK DUMP / ADD URL */}
      {activeMode === 'quick_dump' && (
        <div style={styles.card}>
          {dumpSuccessItem ? (
            <div style={{ marginTop: '6px' }}>
              <div
                style={
                  dumpSuccessItem.alreadyExists ? styles.infoBanner : styles.successBanner
                }
              >
                {dumpSuccessItem.alreadyExists
                  ? 'ℹ ALREADY IN DUMP (NOT DUPLICATED)'
                  : '✓ DUMPED TO RUT BANK'}
              </div>
              <p style={styles.successItemTitle}>&ldquo;{dumpSuccessItem.title}&rdquo;</p>
              <p style={styles.subtext}>
                {dumpSuccessItem.alreadyExists
                  ? 'This link already exists in your Rut Bank, so a duplicate was not created.'
                  : 'Added with tags. Available immediately in your Rut Bank!'}
              </p>
              <button
                onClick={() => chrome.tabs.create({ url: `${RUT_WEB_APP_URL}/bank` })}
                style={{ ...styles.btnPrimary, marginTop: '14px' }}
              >
                VIEW IN RUT BANK ↗
              </button>
              <button
                onClick={() => {
                  setDumpSuccessItem(null);
                  setDumpTitle('');
                  setDumpNote('');
                }}
                style={{ ...styles.btnSecondary, marginTop: '8px' }}
              >
                + DUMP ANOTHER LINK
              </button>
            </div>
          ) : (
            <form onSubmit={handleDumpItem} style={styles.form}>
              {/* URL Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={styles.inputLabel}>LINK URL *</label>
                  {activeTab?.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setDumpUrl(activeTab.url || '');
                        if (activeTab.title) setDumpTitle(activeTab.title);
                      }}
                      style={styles.microBtn}
                    >
                      USE CURRENT TAB
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={dumpUrl}
                  onChange={(e) => setDumpUrl(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>

              {/* Title (Optional) */}
              <div>
                <label style={styles.inputLabel}>TITLE (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. Tactile Stoneware Ceramic Vessel"
                  value={dumpTitle}
                  onChange={(e) => setDumpTitle(e.target.value)}
                  style={styles.input}
                />
              </div>

              {/* Tags */}
              <div>
                <label style={styles.inputLabel}>TAGS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  placeholder="e.g. ceramics, stoneware, minimal, tactile"
                  value={dumpTags}
                  onChange={(e) => setDumpTags(e.target.value)}
                  style={styles.input}
                />
              </div>

              {/* Personal Notes (Optional) */}
              <div>
                <label style={styles.inputLabel}>NOTES / CONTEXT (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="Why did you dump this? Dimensions, texture..."
                  value={dumpNote}
                  onChange={(e) => setDumpNote(e.target.value)}
                  style={styles.input}
                />
              </div>

              {dumpError && <div style={styles.errorBox}>{dumpError}</div>}

              <button
                type="submit"
                disabled={dumping || !dumpUrl.trim()}
                style={{ ...styles.btnPrimary, marginTop: '4px' }}
              >
                {dumping ? 'DUMPING...' : 'DUMP'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* MODE 2: COLLECTION SYNC */}
      {activeMode === 'collection_sync' && (
        <div style={styles.card}>
          {/* Platform Option Selector */}
          <div style={{ marginBottom: '14px' }}>
            <label style={styles.inputLabel}>CHOOSE COLLECTION PLATFORM</label>
            <div style={styles.platformSelectorRow}>
              <button
                type="button"
                onClick={() => setSyncPlatform('instagram')}
                style={{
                  ...styles.platformBtn,
                  ...(syncPlatform === 'instagram' ? styles.platformBtnActive : {}),
                }}
              >
                📸 INSTAGRAM
              </button>
              <button
                type="button"
                onClick={() => setSyncPlatform('facebook')}
                style={{
                  ...styles.platformBtn,
                  ...(syncPlatform === 'facebook' ? styles.platformBtnActive : {}),
                }}
              >
                📘 FACEBOOK
              </button>
              <button
                type="button"
                onClick={() => setSyncPlatform('pinterest')}
                style={{
                  ...styles.platformBtn,
                  ...(syncPlatform === 'pinterest' ? styles.platformBtnActive : {}),
                }}
              >
                📌 PINTEREST
              </button>
            </div>
          </div>

          {/* INSTAGRAM OPTION */}
          {syncPlatform === 'instagram' && (
            collection?.detected ? (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.highlightBadge}>INSTAGRAM COLLECTION DETECTED</span>
                </div>
                <h2 style={styles.collectionHeading}>{collection.title}</h2>
                <p style={styles.collectionPath}>/{collection.slug}/</p>

                <div style={{ marginTop: '12px' }}>
                  <label style={styles.inputLabel}>COLLECTION ORIGIN TAG</label>
                  <input
                    type="text"
                    value={collectionOriginTag}
                    onChange={(e) => setCollectionOriginTag(e.target.value)}
                    placeholder="e.g. Saved Architecture"
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>
                    Each item will be tagged with #{collectionOriginTag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'collection'}
                  </span>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={styles.inputLabel}>ADDITIONAL TAGS (COMMA SEPARATED)</label>
                  <input
                    type="text"
                    value={collectionCustomTags}
                    onChange={(e) => setCollectionCustomTags(e.target.value)}
                    placeholder="e.g. brutalist, concrete, grid"
                    style={styles.input}
                  />
                </div>

                <p style={{ ...styles.subtext, marginTop: '12px' }}>
                  Auto-scrolls the collection DOM to scrape virtualized Reels, extracting captions, thumbnails, and tagging each item with the origin.
                </p>

                <button onClick={handleStartScrape} style={{ ...styles.btnPrimary, marginTop: '14px' }}>
                  ⚡ SYNC INSTAGRAM COLLECTION
                </button>
              </div>
            ) : (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.neutralBadge}>STANDBY</span>
                </div>
                <h3 style={styles.cardTitleNotice}>NAVIGATE TO AN INSTAGRAM COLLECTION</h3>
                <p style={styles.subtext}>
                  Open any Instagram Saved Collection or Saved Posts page on Instagram Web to start auto-syncing entire boards.
                </p>

                <button
                  onClick={() => chrome.tabs.create({ url: 'https://www.instagram.com/saved/' })}
                  style={{ ...styles.btnPrimary, marginTop: '14px' }}
                >
                  OPEN INSTAGRAM SAVED ↗
                </button>

                <button
                  onClick={inspectActiveTab}
                  disabled={checkingTab}
                  style={{ ...styles.btnSecondary, marginTop: '8px' }}
                >
                  {checkingTab ? 'CHECKING TAB...' : '↻ RE-CHECK CURRENT TAB'}
                </button>
              </div>
            )
          )}

          {/* FACEBOOK OPTION */}
          {syncPlatform === 'facebook' && (
            activeTab?.url?.includes('facebook.com') ? (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.highlightBadge}>FACEBOOK SAVED DETECTED</span>
                </div>
                <h2 style={styles.collectionHeading}>
                  {activeTab.title?.replace(/\s*\|.*Facebook/i, '').trim() || 'Facebook Saved'}
                </h2>
                <p style={styles.collectionPath}>
                  /{activeTab.url ? new URL(activeTab.url).pathname.replace(/^\/|\/$/g, '') : 'saved'}/
                </p>

                <div style={{ marginTop: '12px' }}>
                  <label style={styles.inputLabel}>COLLECTION ORIGIN TAG</label>
                  <input
                    type="text"
                    value={collectionOriginTag}
                    onChange={(e) => setCollectionOriginTag(e.target.value)}
                    placeholder="e.g. Saved Videos, Saved Architecture"
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>
                    Each item will be tagged with #{collectionOriginTag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'collection'}
                  </span>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={styles.inputLabel}>ADDITIONAL TAGS (COMMA SEPARATED)</label>
                  <input
                    type="text"
                    value={collectionCustomTags}
                    onChange={(e) => setCollectionCustomTags(e.target.value)}
                    placeholder="e.g. video, inspiration, design"
                    style={styles.input}
                  />
                </div>

                <p style={{ ...styles.subtext, marginTop: '12px' }}>
                  Extracts saved posts, videos, and links from the current Facebook page into your Rut Bank.
                </p>

                <button onClick={handleStartFacebookSync} style={{ ...styles.btnPrimary, marginTop: '14px' }}>
                  ⚡ SYNC FACEBOOK COLLECTION
                </button>
              </div>
            ) : (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.neutralBadge}>STANDBY</span>
                </div>
                <h3 style={styles.cardTitleNotice}>NAVIGATE TO FACEBOOK SAVED</h3>
                <p style={styles.subtext}>
                  Open any Facebook Saved Collection or Saved Posts page on Facebook Web to start syncing.
                </p>

                <button
                  onClick={() => chrome.tabs.create({ url: 'https://www.facebook.com/saved/' })}
                  style={{ ...styles.btnPrimary, marginTop: '14px' }}
                >
                  OPEN FACEBOOK SAVED ↗
                </button>

                <button
                  onClick={inspectActiveTab}
                  disabled={checkingTab}
                  style={{ ...styles.btnSecondary, marginTop: '8px' }}
                >
                  {checkingTab ? 'CHECKING TAB...' : '↻ RE-CHECK CURRENT TAB'}
                </button>
              </div>
            )
          )}

          {/* PINTEREST OPTION */}
          {syncPlatform === 'pinterest' && (
            activeTab?.url?.includes('pinterest.com') ? (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.highlightBadge}>PINTEREST BOARD DETECTED</span>
                </div>
                <h2 style={styles.collectionHeading}>
                  {activeTab.title?.replace(/\s*\|.*Pinterest/i, '').trim() || 'Pinterest Board'}
                </h2>
                <p style={styles.collectionPath}>
                  /{activeTab.url ? new URL(activeTab.url).pathname.replace(/^\/|\/$/g, '') : 'board'}/
                </p>

                <div style={{ marginTop: '12px' }}>
                  <label style={styles.inputLabel}>COLLECTION ORIGIN TAG</label>
                  <input
                    type="text"
                    value={collectionOriginTag}
                    onChange={(e) => setCollectionOriginTag(e.target.value)}
                    placeholder="e.g. Minimal Ceramics, Typography"
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>
                    Each item will be tagged with #{collectionOriginTag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'board'}
                  </span>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={styles.inputLabel}>ADDITIONAL TAGS (COMMA SEPARATED)</label>
                  <input
                    type="text"
                    value={collectionCustomTags}
                    onChange={(e) => setCollectionCustomTags(e.target.value)}
                    placeholder="e.g. ceramics, interior, minimal"
                    style={styles.input}
                  />
                </div>

                <p style={{ ...styles.subtext, marginTop: '12px' }}>
                  Extracts pins, titles, and preview images from the current Pinterest board into your Rut Bank.
                </p>

                <button onClick={handleStartPinterestSync} style={{ ...styles.btnPrimary, marginTop: '14px' }}>
                  ⚡ SYNC PINTEREST COLLECTION
                </button>
              </div>
            ) : (
              <div>
                <div style={styles.collectionBadgeRow}>
                  <span style={styles.neutralBadge}>STANDBY</span>
                </div>
                <h3 style={styles.cardTitleNotice}>NAVIGATE TO A PINTEREST BOARD</h3>
                <p style={styles.subtext}>
                  Open any Pinterest Board or Saved Pins page on Pinterest Web to start syncing.
                </p>

                <button
                  onClick={() => chrome.tabs.create({ url: 'https://www.pinterest.com/' })}
                  style={{ ...styles.btnPrimary, marginTop: '14px' }}
                >
                  OPEN PINTEREST ↗
                </button>

                <button
                  onClick={inspectActiveTab}
                  disabled={checkingTab}
                  style={{ ...styles.btnSecondary, marginTop: '8px' }}
                >
                  {checkingTab ? 'CHECKING TAB...' : '↻ RE-CHECK CURRENT TAB'}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Footer Version Notice */}
      <div style={styles.footer}>
        <span style={styles.footerText}>RUT EXTENSION v{EXTENSION_VERSION}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// RUT BRUTALIST DESIGN SYSTEM STYLES
// ----------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    backgroundColor: '#0c0c0c',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
    minHeight: '440px',
    width: '360px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '10px',
    borderBottom: '1px solid #222222',
    marginBottom: '10px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  versionBadge: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.4px',
    color: '#888888',
    backgroundColor: '#161616',
    border: '1px solid #282828',
    padding: '2px 5px',
    borderRadius: '0px',
    fontFamily: 'monospace',
  },
  footer: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #1a1a1a',
    display: 'flex',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: '9px',
    color: '#444444',
    fontFamily: 'monospace',
    letterSpacing: '0.6px',
  },
  logo: {
    fontWeight: 900,
    fontSize: '18px',
    letterSpacing: '-0.5px',
    color: '#ffffff',
    marginRight: '8px',
  },
  badge: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '2px 5px',
    borderRadius: '0px',
  },
  modeTabsRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '10px',
  },
  modeTab: {
    flex: 1,
    padding: '8px 10px',
    backgroundColor: '#181818',
    color: '#888888',
    border: '1px solid #282828',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    borderRadius: '0px',
    textAlign: 'center',
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderColor: '#ffffff',
    fontWeight: 800,
  },
  platformSelectorRow: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  platformBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#161616',
    color: '#888888',
    border: '1px solid #282828',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    borderRadius: '0px',
    textAlign: 'center',
  },
  platformBtnActive: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderColor: '#ffffff',
    fontWeight: 800,
  },
  inputLabel: {
    display: 'block',
    fontSize: '9px',
    fontWeight: 800,
    color: '#888888',
    letterSpacing: '0.6px',
    marginBottom: '3px',
  },
  fieldHint: {
    display: 'block',
    fontSize: '9px',
    color: '#666666',
    marginTop: '2px',
    fontFamily: 'monospace',
  },
  microBtn: {
    background: 'none',
    border: 'none',
    color: '#aaaaaa',
    fontSize: '9px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  banner: {
    backgroundColor: '#161616',
    border: '1px solid #282828',
    padding: '12px',
    marginBottom: '14px',
  },
  bannerTitle: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.6px',
    color: '#ffffff',
    marginBottom: '4px',
  },
  bannerDesc: {
    fontSize: '11px',
    lineHeight: '16px',
    color: '#888888',
  },
  userBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 8px',
    backgroundColor: '#141414',
    border: '1px solid #242424',
    marginBottom: '10px',
  },
  userDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#00ff66',
    marginRight: '8px',
  },
  userEmail: {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#cccccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  card: {
    backgroundColor: '#141414',
    border: '1px solid #282828',
    padding: '14px',
    flex: 1,
  },
  collectionBadgeRow: {
    marginBottom: '6px',
  },
  highlightBadge: {
    fontSize: '9px',
    fontWeight: 800,
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '2px 6px',
    letterSpacing: '0.5px',
  },
  neutralBadge: {
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: '#262626',
    color: '#aaaaaa',
    padding: '2px 6px',
    letterSpacing: '0.5px',
  },
  collectionHeading: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#ffffff',
    margin: '4px 0 2px 0',
  },
  collectionPath: {
    fontSize: '11px',
    color: '#777777',
    fontFamily: 'monospace',
    marginBottom: '6px',
  },
  cardTitleNotice: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#ffffff',
    margin: '6px 0 6px 0',
  },
  subtext: {
    fontSize: '11px',
    lineHeight: '16px',
    color: '#888888',
  },
  successItemTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#ffffff',
    margin: '4px 0 6px 0',
  },
  btnPrimary: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#ffffff',
    color: '#000000',
    border: 'none',
    fontWeight: 800,
    fontSize: '11px',
    letterSpacing: '0.6px',
    cursor: 'pointer',
    borderRadius: '0px',
  },
  btnSecondary: {
    width: '100%',
    padding: '9px 14px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '1px solid #333333',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    borderRadius: '0px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#888888',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '12px 0',
  },
  dividerText: {
    fontSize: '9px',
    color: '#555555',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    backgroundColor: '#161616',
    border: '1px solid #282828',
    color: '#ffffff',
    fontSize: '11px',
    outline: 'none',
    borderRadius: '0px',
  },
  errorBox: {
    padding: '8px 10px',
    backgroundColor: '#2a0e0e',
    border: '1px solid #731e1e',
    color: '#ff8888',
    fontSize: '11px',
    marginBottom: '8px',
  },
  successBanner: {
    padding: '8px 10px',
    backgroundColor: '#0d2818',
    border: '1px solid #1b5e20',
    color: '#4caf50',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  infoBanner: {
    padding: '8px 10px',
    backgroundColor: '#112233',
    border: '1px solid #1e3a5f',
    color: '#64b5f6',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#00ff66',
    marginRight: '8px',
  },
  progressText: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#ffffff',
  },
  countDisplay: {
    padding: '14px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #222222',
    textAlign: 'center',
    marginBottom: '10px',
  },
  countNumber: {
    fontSize: '32px',
    fontWeight: 900,
    fontFamily: 'monospace',
    color: '#ffffff',
    display: 'block',
  },
  countLabel: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#666666',
    letterSpacing: '1px',
  },
  cardMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid #222222',
    paddingBottom: '8px',
  },
  cardTag: {
    fontSize: '9px',
    color: '#666666',
    fontWeight: 800,
  },
  cardTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#cccccc',
  },
  centerBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: '11px',
    color: '#666666',
  },
};
