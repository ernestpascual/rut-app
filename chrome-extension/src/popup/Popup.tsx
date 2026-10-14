import React, { useState, useEffect } from 'react';
import { CollectionInfo, ScrapedReelMetadata, UserSnapshot } from '../types/insight';
import { RUT_WEB_APP_URL } from '../config/firebase';

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

  // 2. Inspect Active Tab & Detect Collection
  const inspectActiveTab = () => {
    setCheckingTab(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const current = tabs[0];
      setActiveTab(current || null);

      if (current?.id && current.url?.includes('instagram.com')) {
        chrome.tabs.sendMessage(current.id, { type: 'CHECK_COLLECTION_STATUS' }, (res) => {
          if (chrome.runtime.lastError || !res) {
            setCollection({ detected: false });
          } else {
            setCollection(res);
            if (res.isScraping) {
              setIsScraping(true);
              setScrapedCount(res.harvestedCount || 0);
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
        handleSyncToFirestore(msg.items);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Auth Handlers
  const handleGoogleLogin = () => {
    setAuthError(null);
    setSubmittingAuth(true);
    chrome.runtime.sendMessage({ type: 'AUTH_LOGIN_GOOGLE' }, (res) => {
      setSubmittingAuth(false);
      if (res?.success) {
        setUser(res.user);
      } else {
        setAuthError(res?.error || 'Google login failed.');
      }
    });
  };

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
    });
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

  const handleSyncToFirestore = (items: ScrapedReelMetadata[]) => {
    setIsSyncing(true);
    chrome.runtime.sendMessage({ type: 'SYNC_ITEMS', items }, (res) => {
      setIsSyncing(false);
      if (res?.success) {
        setSyncedCount(res.count);
      } else {
        setSyncError(res?.error || 'Failed to sync to Insight Bank.');
      }
    });
  };

  // ----------------------------------------------------
  // RENDER: Loading
  // ----------------------------------------------------
  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.logo}>RUT</span>
          <span style={styles.badge}>SYNC</span>
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
          <div>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>EXTENSION</span>
          </div>
        </div>

        <div style={styles.banner}>
          <p style={styles.bannerTitle}>SYNC INSTAGRAM TO INSIGHT BANK</p>
          <p style={styles.bannerDesc}>
            Log into your rut account to scrape & sync Reels directly into your Inspiration Dump.
          </p>
        </div>

        {authError && <div style={styles.errorBox}>{authError}</div>}

        <button
          onClick={handleGoogleLogin}
          disabled={submittingAuth}
          style={{ ...styles.btnPrimary, marginBottom: '12px' }}
        >
          {submittingAuth ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR EMAIL</span>
        </div>

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
          <button type="submit" disabled={submittingAuth} style={styles.btnSecondary}>
            {submittingAuth ? 'AUTHENTICATING...' : 'SIGN IN WITH PASSWORD'}
          </button>
        </form>
      </div>
    );
  }

  // ----------------------------------------------------
  // STATE 4: Syncing / Completed
  // ----------------------------------------------------
  if (isScraping || isSyncing || syncedCount !== null) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>SYNCING</span>
          </div>
          <button onClick={handleSignOut} style={styles.linkBtn}>LOGOUT</button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardMetaRow}>
            <span style={styles.cardTag}>COLLECTION</span>
            <span style={styles.cardTitle}>{collection?.title || 'Saved Reels'}</span>
          </div>

          {isScraping && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.progressRow}>
                <span style={styles.pulseDot} />
                <span style={styles.progressText}>Auto-scrolling Instagram DOM...</span>
              </div>
              <div style={styles.countDisplay}>
                <span style={styles.countNumber}>{scrapedCount}</span>
                <span style={styles.countLabel}>REELS DISCOVERED</span>
              </div>
              <p style={styles.subtext}>Extracting captions, thumbnails, and shortcodes with rate-limit protection.</p>
              <button onClick={handleStopScrapeEarly} style={{ ...styles.btnSecondary, marginTop: '14px' }}>
                STOP & SYNC EARLY ({scrapedCount})
              </button>
            </div>
          )}

          {isSyncing && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.progressRow}>
                <span style={styles.pulseDot} />
                <span style={styles.progressText}>Writing batch to Firestore...</span>
              </div>
              <p style={styles.subtext}>Committing {scrapedCount} Reels in chunks of 400 to Insight Bank.</p>
            </div>
          )}

          {syncedCount !== null && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.successBanner}>
                ✓ SUCCESSFULLY SYNCED {syncedCount} REELS
              </div>
              <p style={styles.subtext}>
                Items are in your Insight Bank! Cloud Functions will automatically index embeddings & AI summaries.
              </p>
              <button
                onClick={() => chrome.tabs.create({ url: `${RUT_WEB_APP_URL}/bank` })}
                style={{ ...styles.btnPrimary, marginTop: '14px' }}
              >
                OPEN RUT INSIGHT BANK ↗
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
  // STATE 3: Authenticated — Collection Detected
  // ----------------------------------------------------
  if (collection?.detected) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <span style={styles.logo}>RUT</span>
            <span style={styles.badge}>READY</span>
          </div>
          <button onClick={handleSignOut} style={styles.linkBtn}>LOGOUT</button>
        </div>

        <div style={styles.userBar}>
          <span style={styles.userDot} />
          <span style={styles.userEmail}>{user.email || user.uid}</span>
        </div>

        <div style={styles.card}>
          <div style={styles.collectionBadgeRow}>
            <span style={styles.highlightBadge}>INSTAGRAM DETECTED</span>
          </div>
          <h2 style={styles.collectionHeading}>{collection.title}</h2>
          <p style={styles.collectionPath}>/{collection.slug}/</p>

          <p style={styles.subtext}>
            Ready to scrape all virtualized Reels, captions, and links from this collection into your rut Insight Bank.
          </p>

          <button onClick={handleStartScrape} style={{ ...styles.btnPrimary, marginTop: '16px' }}>
            ⚡ SYNC REELS TO INSIGHT BANK
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STATE 2: Authenticated — Wrong Page
  // ----------------------------------------------------
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.logo}>RUT</span>
          <span style={styles.badge}>CONNECTED</span>
        </div>
        <button onClick={handleSignOut} style={styles.linkBtn}>LOGOUT</button>
      </div>

      <div style={styles.userBar}>
        <span style={styles.userDot} />
        <span style={styles.userEmail}>{user.email || user.uid}</span>
      </div>

      <div style={styles.card}>
        <div style={styles.collectionBadgeRow}>
          <span style={styles.neutralBadge}>STANDBY</span>
        </div>
        <h3 style={styles.cardTitleNotice}>NAVIGATE TO A SAVED COLLECTION</h3>
        <p style={styles.subtext}>
          Open any Instagram Saved Collection or Saved Posts page on Instagram Web to start syncing.
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
    minHeight: '420px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid #222222',
    marginBottom: '14px',
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
    borderRadius: '2px',
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
    padding: '6px 10px',
    backgroundColor: '#141414',
    border: '1px solid #242424',
    marginBottom: '12px',
  },
  userDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#00ff66',
    marginRight: '8px',
  },
  userEmail: {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#cccccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  card: {
    backgroundColor: '#141414',
    border: '1px solid #282828',
    padding: '16px',
    flex: 1,
  },
  collectionBadgeRow: {
    marginBottom: '8px',
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
    fontSize: '16px',
    fontWeight: 800,
    color: '#ffffff',
    margin: '4px 0 2px 0',
  },
  collectionPath: {
    fontSize: '11px',
    color: '#777777',
    fontFamily: 'monospace',
    marginBottom: '10px',
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
  btnPrimary: {
    width: '100%',
    padding: '11px 14px',
    backgroundColor: '#ffffff',
    color: '#000000',
    border: 'none',
    fontWeight: 800,
    fontSize: '11px',
    letterSpacing: '0.6px',
    cursor: 'pointer',
  },
  btnSecondary: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '1px solid #333333',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.5px',
    cursor: 'pointer',
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
    gap: '8px',
  },
  input: {
    padding: '10px 12px',
    backgroundColor: '#161616',
    border: '1px solid #282828',
    color: '#ffffff',
    fontSize: '12px',
    outline: 'none',
  },
  errorBox: {
    padding: '8px 10px',
    backgroundColor: '#2a0e0e',
    border: '1px solid #731e1e',
    color: '#ff8888',
    fontSize: '11px',
    marginBottom: '10px',
  },
  successBanner: {
    padding: '10px',
    backgroundColor: '#0d2818',
    border: '1px solid #1b5e20',
    color: '#4caf50',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    marginBottom: '8px',
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
