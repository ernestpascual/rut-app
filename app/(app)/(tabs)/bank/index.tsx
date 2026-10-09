import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../src/lib/firebase/client';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Input } from '../../../../src/components/ui/Input';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../../../../src/design/tokens';
import { InspirationItem, SourcePlatform } from '../../../../src/types';

export default function BankScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'inspirations'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: InspirationItem[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setItems(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('Inspirations snapshot listener error:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
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
      console.warn('Semantic search fallback to keyword:', err);
      setSemanticResults(null);
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

  const platforms = ['ALL', 'INSTAGRAM', 'TIKTOK', 'X', 'THREADS', 'YOUTUBE', 'WEB'];

  // Collect all unique tags
  const allTags = Array.from(
    new Set(items.flatMap((i) => [...(i.tags || []), ...(i.aiTags || [])]))
  ).slice(0, 15);

  const filteredItems = items.filter((item) => {
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
      return matchTitle || matchNote || matchSummary || matchTags;
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="BANK" message="AI-indexed private ideas &amp; inspirations" />
      <TopNav
        title="rut"
        subtitle="Inspiration Bank"
        rightAction={
          <Button
            title="+ NEW"
            onPress={() => router.push('/(app)/inspiration/new')}
            style={{ height: 36, paddingHorizontal: 16 }}
          />
        }
      />

      <View style={styles.searchSection}>
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
            style={{ height: 46, marginLeft: spacing.xs, paddingHorizontal: 16 }}
          />
        </View>

        {/* Platform filter pills */}
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

        {/* Tag filters */}
        {allTags.length > 0 ? (
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
        ) : null}
      </View>

      {loading || searching ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
          <Text style={styles.loadingText}>
            {searching ? 'SEARCHING WITH AI...' : 'LOADING BANK...'}
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>NO INSPIRATION FOUND</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No items match your search filters.'
              : 'Your bank is empty. Save links, snippets, or notes to get started.'}
          </Text>
          <Button
            title="+ ADD FIRST ITEM"
            onPress={() => router.push('/(app)/inspiration/new')}
            style={{ marginTop: spacing.base }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/(app)/inspiration/${item.id}`)}
              style={styles.itemCard}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  {item.sourcePlatform ? (
                    <Badge
                      label={item.sourcePlatform.toUpperCase()}
                      variant="inverse"
                    />
                  ) : (
                    <Badge label={item.kind.toUpperCase()} variant="grade" />
                  )}
                  {item.sourceDomain ? (
                    <Badge label={item.sourceDomain} variant="outline" />
                  ) : null}
                </View>

                {/* Processing status */}
                {item.processingStatus === 'pending' || item.processingStatus === 'processing' ? (
                  <Badge label="AI INDEXING..." variant="grade" />
                ) : item.processingStatus === 'failed' ? (
                  <Pressable onPress={() => handleRetryIndexing(item.id)}>
                    <Badge label="FAILED (RETRY)" variant="outline" />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.itemTitle}>{item.title}</Text>

              {item.aiSummary ? (
                <Text style={styles.aiSummary} numberOfLines={2}>
                  {item.aiSummary}
                </Text>
              ) : item.userNote ? (
                <Text style={styles.userNote} numberOfLines={2}>
                  {item.userNote}
                </Text>
              ) : item.sharedText ? (
                <Text style={styles.userNote} numberOfLines={2}>
                  {item.sharedText}
                </Text>
              ) : null}

              {item.url ? (
                <Pressable onPress={() => Linking.openURL(item.url!)}>
                  <Text style={styles.sourceUrl} numberOfLines={1}>
                    ↗ {item.url}
                  </Text>
                </Pressable>
              ) : null}

              {/* Tags */}
              <View style={styles.itemTagRow}>
                {(item.tags || []).slice(0, 4).map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" />
                ))}
                {(item.aiTags || []).slice(0, 3).map((t) => (
                  <Badge key={t} label={`*${t}`} variant="outline" />
                ))}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  searchSection: {
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
  },
  itemCard: {
    marginBottom: spacing.sm,
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
