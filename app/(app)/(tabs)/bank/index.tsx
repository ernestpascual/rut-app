import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../../src/features/auth/AuthContext';
import { useTheme } from '../../../../src/design/ThemeContext';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Input } from '../../../../src/components/ui/Input';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { InspirationItem } from '../../../../src/types';
import {
  getDumpInspirations,
  setDumpInspirations,
  sortDumpItems,
  DumpSortOption,
  enrichInspirationItem,
} from '../../../../src/features/dump/dumpService';

export default function BankScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const isDummy = !user || user.uid === DUMMY_USER_UID;

  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<DumpSortOption>('newest');
  const [activeControlTab, setActiveControlTab] = useState<'search' | 'tags' | 'sort' | null>(null);
  const [showImages, setShowImages] = useState(true);

  // Load showImages preference
  useEffect(() => {
    AsyncStorage.getItem('@rut_show_images')
      .then((val) => {
        if (val !== null) {
          setShowImages(val === 'true');
        }
      })
      .catch(() => {});
  }, []);

  const toggleShowImages = async () => {
    const next = !showImages;
    setShowImages(next);
    try {
      await AsyncStorage.setItem('@rut_show_images', String(next));
    } catch {}
  };


  // Load inspirations from Firestore
  useEffect(() => {
    let isMounted = true;

    if (!user) {
      getDumpInspirations().then((loaded) => {
        if (isMounted) {
          setItems(loaded);
          setLoading(false);
        }
      });
      return;
    }

    // Firestore mode (including test account under users/test)
    try {
      const q = query(
        collection(db, 'users', user.uid, 'inspirations'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const fetched: InspirationItem[] = [];
          snapshot.forEach((docSnap) => {
            const rawItem = { id: docSnap.id, ...(docSnap.data() as any) } as InspirationItem;
            fetched.push(enrichInspirationItem(rawItem));
          });
          setItems(fetched);
          setLoading(false);
        },
        (err) => {
          console.warn('Firestore fallback to local dump store:', err);
          getDumpInspirations().then((loaded) => {
            if (isMounted) {
              setItems(loaded);
              setLoading(false);
            }
          });
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch {
      getDumpInspirations().then((loaded) => {
        if (isMounted) {
          setItems(loaded);
          setLoading(false);
        }
      });
    }
  }, [user]);


  const handleSemanticSearch = async () => {
    if (!searchQuery.trim() || !user) {
      setSemanticResults(null);
      return;
    }
    setSearching(true);
    try {
      const searchFn = httpsCallable<{ query: string }, { inspirationIds: string[] }>(
        functions,
        'semanticSearch'
      );
      const res = await searchFn({ query: searchQuery.trim() });
      setSemanticResults(res.data.inspirationIds || []);
    } catch (err) {
      // Local keyword fallback
      const q = searchQuery.toLowerCase();
      const matched = items
        .filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.aiSummary || '').toLowerCase().includes(q) ||
            (i.concepts || []).some((c) => c.toLowerCase().includes(q)) ||
            (i.tags || []).some((t) => t.toLowerCase().includes(q))
        )
        .map((i) => i.id);
      setSemanticResults(matched);
    } finally {
      setSearching(false);
    }
  };

  const handleRetryIndexing = async (itemId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'inspirations', itemId), {
        processingStatus: 'pending',
        processingErrorCode: null,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error('Failed to retry indexing:', e);
    }
  };

  const platforms = [
    'ALL',
    'BEHANCE',
    'ARE.NA',
    'DRIBBBLE',
    'PINTEREST',
    'INSTAGRAM',
    'TIKTOK',
    'X',
    'THREADS',
    'YOUTUBE',
    'GITHUB',
    'WEB',
  ];

  const sortOptionsList: Array<{ label: string; value: DumpSortOption }> = [
    { label: 'NEWEST', value: 'newest' },
    { label: 'OLDEST', value: 'oldest' },
    { label: 'PLATFORM', value: 'platform' },
    { label: 'TITLE A-Z', value: 'title-asc' },
    { label: 'TITLE Z-A', value: 'title-desc' },
    { label: 'TAGS', value: 'tags' },
  ];

  // Collect unique tags
  const allTags = Array.from(
    new Set(items.flatMap((i) => [...(i.tags || []), ...(i.aiTags || [])]))
  ).slice(0, 15);

  // Filter items
  const filtered = items.filter((item) => {
    if (item.archived) return false;

    // Platform filter
    if (
      selectedPlatform !== 'ALL' &&
      item.sourcePlatform?.toUpperCase() !== selectedPlatform
    ) {
      return false;
    }

    // Tag filter
    if (selectedTag) {
      const combined = [...(item.tags || []), ...(item.aiTags || [])];
      if (!combined.includes(selectedTag)) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      if (semanticMode && semanticResults !== null) {
        return semanticResults.includes(item.id);
      }
      const queryLower = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(queryLower);
      const matchNote = item.userNote?.toLowerCase().includes(queryLower);
      const matchSummary = item.aiSummary?.toLowerCase().includes(queryLower);
      const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(queryLower));
      const matchConcepts = (item.concepts || []).some((c) => c.toLowerCase().includes(queryLower));
      return matchTitle || matchNote || matchSummary || matchTags || matchConcepts;
    }

    return true;
  });

  // Apply sorting
  const sortedAndFilteredItems = sortDumpItems(filtered, sortOption);


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopNav
        title="rut"
        subtitle="Dump Folder"
        rightAction={
          <Button
            title="+ NEW"
            onPress={() => router.push('/(app)/inspiration/new')}
            style={{ height: 34, paddingHorizontal: 14 }}
          />
        }
      />

      {/* TUCKED CONTROL TABS */}
      <View style={styles.controlTabsBar}>
        <View style={styles.controlTabsRow}>
          <Pressable
            onPress={() => setActiveControlTab(activeControlTab === 'search' ? null : 'search')}
            style={[
              styles.controlTabBtn,
              activeControlTab === 'search' && styles.controlTabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.controlTabBtnText,
                activeControlTab === 'search' && styles.controlTabBtnTextActive,
              ]}
            >
              SEARCH{searchQuery.trim() ? ' •' : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveControlTab(activeControlTab === 'tags' ? null : 'tags')}
            style={[
              styles.controlTabBtn,
              activeControlTab === 'tags' && styles.controlTabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.controlTabBtnText,
                activeControlTab === 'tags' && styles.controlTabBtnTextActive,
              ]}
            >
              TAGS{(selectedTag || selectedPlatform !== 'ALL') ? ' •' : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveControlTab(activeControlTab === 'sort' ? null : 'sort')}
            style={[
              styles.controlTabBtn,
              activeControlTab === 'sort' && styles.controlTabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.controlTabBtnText,
                activeControlTab === 'sort' && styles.controlTabBtnTextActive,
              ]}
            >
              SORT: {sortOption.toUpperCase()}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleShowImages}
            style={[
              styles.controlTabBtn,
              !showImages && styles.controlTabBtnOff,
            ]}
          >
            <Text
              style={[
                styles.controlTabBtnText,
                !showImages && styles.controlTabBtnTextOff,
              ]}
            >
              {showImages ? '🖼️ IMG: ON' : '🖼️ IMG: OFF'}
            </Text>
          </Pressable>
        </View>

        {/* ACTIVE FILTER PILLS (When any filter is active) */}
        {(searchQuery.trim() || selectedTag || selectedPlatform !== 'ALL') ? (
          <View style={styles.activeFiltersRow}>
            {searchQuery.trim() ? (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setSemanticResults(null);
                }}
                style={styles.activeFilterChip}
              >
                <Text style={styles.activeFilterChipText}>"{searchQuery.slice(0, 15)}" ✕</Text>
              </Pressable>
            ) : null}

            {selectedPlatform !== 'ALL' ? (
              <Pressable
                onPress={() => setSelectedPlatform('ALL')}
                style={styles.activeFilterChip}
              >
                <Text style={styles.activeFilterChipText}>{selectedPlatform} ✕</Text>
              </Pressable>
            ) : null}

            {selectedTag ? (
              <Pressable
                onPress={() => setSelectedTag(null)}
                style={styles.activeFilterChip}
              >
                <Text style={styles.activeFilterChipText}>#{selectedTag} ✕</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSemanticResults(null);
                setSelectedPlatform('ALL');
                setSelectedTag(null);
              }}
              style={styles.clearAllBtn}
            >
              <Text style={styles.clearAllText}>CLEAR ALL</Text>
            </Pressable>
          </View>
        ) : null}

        {/* EXPANDED CONTENT WHEN A TAB IS ACTIVE */}
        {activeControlTab === 'search' ? (
          <View style={styles.tuckedPanel}>
            <View style={styles.searchRow}>
              <Input
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (!text.trim()) setSemanticResults(null);
                }}
                placeholder={
                  semanticMode
                    ? 'Semantic AI search (e.g. brutalist typography)...'
                    : 'Filter by keyword or title...'
                }
                containerStyle={{ flex: 1, marginVertical: 0 }}
                onSubmitEditing={semanticMode ? handleSemanticSearch : undefined}
                autoFocus
              />
              <Button
                title={semanticMode ? 'AI ON' : 'AI OFF'}
                variant={semanticMode ? 'primary' : 'secondary'}
                onPress={() => {
                  const next = !semanticMode;
                  setSemanticMode(next);
                  if (next && searchQuery.trim()) {
                    handleSemanticSearch();
                  } else {
                    setSemanticResults(null);
                  }
                }}
                style={{ height: 46, marginLeft: spacing.xs, paddingHorizontal: 14 }}
              />
            </View>
          </View>
        ) : null}

        {activeControlTab === 'tags' ? (
          <View style={styles.tuckedPanel}>
            <Text style={styles.panelSectionLabel}>PLATFORM</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={platforms}
              keyExtractor={(item) => item}
              style={styles.platformRow}
              renderItem={({ item: plat }) => (
                <Pressable
                  onPress={() => setSelectedPlatform(plat)}
                  style={[
                    styles.platformPill,
                    selectedPlatform === plat && styles.platformPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.platformPillText,
                      selectedPlatform === plat && styles.platformPillTextActive,
                    ]}
                  >
                    {plat}
                  </Text>
                </Pressable>
              )}
            />

            {allTags.length > 0 ? (
              <>
                <Text style={[styles.panelSectionLabel, { marginTop: spacing.xs }]}>TAGS</Text>
                <View style={styles.tagFilterRow}>
                  {allTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    >
                      <Badge
                        label={selectedTag === tag ? `${tag} ✓` : tag}
                        variant={selectedTag === tag ? 'inverse' : 'grade'}
                        style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {activeControlTab === 'sort' ? (
          <View style={styles.tuckedPanel}>
            <Text style={styles.panelSectionLabel}>SORT ORDER</Text>
            <View style={styles.sortOptionsGrid}>
              {sortOptionsList.map((item) => {
                const isActive = sortOption === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setSortOption(item.value)}
                    style={[styles.sortPill, isActive && styles.sortPillActive]}
                  >
                    <Text style={[styles.sortPillText, isActive && styles.sortPillTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {/* ITEMS LIST */}
      {loading || searching ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
          <Text style={styles.loadingText}>
            {searching ? 'SEARCHING INSPIRATIONS...' : 'LOADING BANK...'}
          </Text>
        </View>
      ) : sortedAndFilteredItems.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>NO INSPIRATIONS IN DUMP</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No items match your active filters.'
              : 'Share links from your phone (Pinterest, Instagram, TikTok, web) or paste them above. Everything you dump starts here.'}
          </Text>
          <Button
            title="+ ADD FIRST INSPIRATION"
            onPress={() => router.push('/(app)/inspiration/new')}
            style={{ marginTop: spacing.base }}
          />
        </View>
      ) : (
        <FlatList
          data={sortedAndFilteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/(app)/inspiration/${item.id}`)}
              style={styles.itemCard}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <Badge label="📁 DUMP" variant="grade" style={{ marginRight: 4 }} />
                  {item.sourcePlatform ? (
                    <Badge
                      label={item.sourcePlatform.toUpperCase()}
                      variant="inverse"
                      style={{ marginRight: 4 }}
                    />
                  ) : (
                    <Badge label={item.kind.toUpperCase()} variant="grade" style={{ marginRight: 4 }} />
                  )}
                  {item.author ? (
                    <Badge
                      label={item.author.startsWith('@') ? item.author : `@${item.author}`}
                      variant="grade"
                      style={{ marginRight: 4 }}
                    />
                  ) : null}
                  {item.siteName ? (
                    <Badge label={item.siteName} variant="outline" style={{ marginRight: 4 }} />
                  ) : item.sourceDomain ? (
                    <Badge label={item.sourceDomain} variant="outline" style={{ marginRight: 4 }} />
                  ) : null}
                </View>

                {item.processingStatus === 'pending' || item.processingStatus === 'processing' ? (
                  <Badge label="AI INDEXING..." variant="grade" />
                ) : item.processingStatus === 'failed' ? (
                  <Pressable onPress={() => handleRetryIndexing(item.id)}>
                    <Badge label="FAILED (RETRY)" variant="outline" />
                  </Pressable>
                ) : null}
              </View>

              {/* Preview image if available and toggled ON */}
              {showImages && item.remotePreviewImageUrl ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.remotePreviewImageUrl }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <Text style={styles.itemTitle}>{item.title}</Text>

              {/* Caption */}
              {item.caption ? (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionText} numberOfLines={2}>
                    📝 "{item.caption}"
                  </Text>
                </View>
              ) : null}

              {/* Rich Context & Auto-Summary */}
              {item.editorialContext ? (
                <View style={styles.contextContainer}>
                  <Text style={styles.contextText} numberOfLines={2}>
                    {item.editorialContext}
                  </Text>
                </View>
              ) : item.aiSummary ? (
                <Text style={styles.aiSummary} numberOfLines={2}>
                  {item.aiSummary}
                </Text>
              ) : item.userNote ? (
                <Text style={styles.userNote} numberOfLines={2}>
                  {item.userNote}
                </Text>
              ) : null}

              {item.url ? (
                <Pressable onPress={() => Linking.openURL(item.url!)}>
                  <Text style={styles.sourceUrl} numberOfLines={1}>
                    ↗ {item.url}
                  </Text>
                </Pressable>
              ) : null}

              {/* Tags & Auto-Tags */}
              <View style={styles.itemTagRow}>
                {(item.tags || []).slice(0, 6).map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" style={{ marginRight: 4, marginBottom: 4 }} />
                ))}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  controlTabsBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    backgroundColor: colors.canvas,
  },
  controlTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlTabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: rounded.none,
    backgroundColor: colors.canvas,
  },
  controlTabBtnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  controlTabBtnOff: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  controlTabBtnText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.ink,
  },
  controlTabBtnTextActive: {
    color: colors.onInk,
  },
  controlTabBtnTextOff: {
    color: colors.inkSoft,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  activeFilterChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  activeFilterChipText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clearAllText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  tuckedPanel: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  panelSectionLabel: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkSoft,
    marginBottom: spacing.xxs,
  },
  sortOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: spacing.xxs,
    backgroundColor: colors.canvas,
  },
  sortPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  sortPillText: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
  },
  sortPillTextActive: {
    color: colors.onInk,
    fontWeight: '700',
  },
  platformRow: {
    marginTop: spacing.xs,
  },
  platformPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: rounded.none,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginRight: spacing.xs,
    backgroundColor: colors.canvas,
  },
  platformPillActive: {
    backgroundColor: colors.ink,
  },
  platformPillText: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.ink,
  },
  platformPillTextActive: {
    color: colors.onInk,
  },
  tagFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
    ...(Platform.OS === 'web'
      ? {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.base,
          alignItems: 'flex-start',
        }
      : {}),
  },
  itemCard: {
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web'
      ? {
          width: 400,
          maxWidth: '100%',
        }
      : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceGrade,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    ...typography.bodyLg,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  aiSummary: {
    ...typography.bodyMd,
    color: colors.ink,
    marginBottom: spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  userNote: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  sourceUrl: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
    marginBottom: spacing.xs,
  },
  itemTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xxs,
  },
  contextContainer: {
    backgroundColor: colors.surfaceGrade,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  contextText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  captionContainer: {
    backgroundColor: colors.surfaceGrade,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  captionText: {
    ...typography.captionSm,
    color: colors.ink,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.captionCap,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    ...typography.displayMd,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 320,
  },
});
