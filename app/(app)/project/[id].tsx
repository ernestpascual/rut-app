import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Linking,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  collection,
  onSnapshot,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { Project, ProjectInspirationLink, InspirationItem } from '../../../src/types';
import {
  getDumpInspirations,
  getProjects,
  saveProject,
  deleteProjectLocal,
  getProjectLinks,
  attachInspirationToProject,
  detachInspirationFromProject,
} from '../../../src/features/dump/dumpService';
import { matchIdeaWithDump, IdeaMatchResult } from '../../../src/features/ideas/ideaMatcher';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isDummy = !user || user.uid === DUMMY_USER_UID;

  const [project, setProject] = useState<Project | null>(null);
  const [links, setLinks] = useState<ProjectInspirationLink[]>([]);
  const [bankMap, setBankMap] = useState<Record<string, InspirationItem>>({});
  const [allDumpItems, setAllDumpItems] = useState<InspirationItem[]>([]);
  const [matchedResults, setMatchedResults] = useState<IdeaMatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit states for writing the idea
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBrief, setEditBrief] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Manual picker toggle
  const [showManualPicker, setShowManualPicker] = useState(false);

  // Load project & inspiration links
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    if (!user) {
      // Local mode
      getProjects().then(async (allProjs) => {
        if (!isMounted) return;
        const found = allProjs.find((p) => p.id === id);
        if (found) {
          setProject(found);
          setEditTitle(found.title);
          setEditBrief(found.brief || '');
          setEditNotes(found.notes || '');
          setEditTags(found.tags || []);
        } else {
          router.replace('/(app)/(tabs)/projects');
        }

        const localLinks = await getProjectLinks(id);
        if (isMounted) setLinks(localLinks);
        setLoading(false);
      });
      return;
    }

    // Firestore mode
    try {
      const projRef = doc(db, 'users', user.uid, 'projects', id);
      const unsubProject = onSnapshot(
        projRef,
        async (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...(snap.data() as any) } as Project;
            setProject(data);
            setEditTitle(data.title);
            setEditBrief(data.brief || '');
            setEditNotes(data.notes || '');
            setEditTags(data.tags || []);
          } else {
            // Check local fallback
            const localProjs = await getProjects();
            const found = localProjs.find((p) => p.id === id);
            if (found) {
              setProject(found);
              setEditTitle(found.title);
              setEditBrief(found.brief || '');
              setEditNotes(found.notes || '');
              setEditTags(found.tags || []);
            } else {
              router.replace('/(app)/(tabs)/projects');
            }
          }
          setLoading(false);
        },
        async () => {
          const localProjs = await getProjects();
          const found = localProjs.find((p) => p.id === id);
          if (found) {
            setProject(found);
            setEditTitle(found.title);
            setEditBrief(found.brief || '');
            setEditNotes(found.notes || '');
            setEditTags(found.tags || []);
          }
          setLoading(false);
        }
      );

      const linksRef = collection(db, 'users', user.uid, 'projects', id, 'inspirationLinks');
      const unsubLinks = onSnapshot(
        linksRef,
        (snap) => {
          const fetched: ProjectInspirationLink[] = [];
          snap.forEach((d) => fetched.push({ id: d.id, ...(d.data() as any) }));
          setLinks(fetched);
        },
        async () => {
          const localLinks = await getProjectLinks(id);
          setLinks(localLinks);
        }
      );

      return () => {
        isMounted = false;
        unsubProject();
        unsubLinks();
      };
    } catch {
      getProjects().then(async (allProjs) => {
        const found = allProjs.find((p) => p.id === id);
        if (found) {
          setProject(found);
          setEditTitle(found.title);
          setEditBrief(found.brief || '');
          setEditNotes(found.notes || '');
          setEditTags(found.tags || []);
        }
        const localLinks = await getProjectLinks(id);
        setLinks(localLinks);
        setLoading(false);
      });
    }
  }, [user, id, isDummy]);

  // Load dump bank items
  useEffect(() => {
    let isMounted = true;
    const fetchBank = async () => {
      let itemsList: InspirationItem[] = [];
      if (user) {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'inspirations'));
          if (!snap.empty) {
            snap.forEach((d) => {
              itemsList.push({ id: d.id, ...(d.data() as any) } as InspirationItem);
            });
          }
        } catch {}
      }

      if (itemsList.length === 0) {
        itemsList = await getDumpInspirations();
      }

      if (!isMounted) return;
      setAllDumpItems(itemsList);
      const map: Record<string, InspirationItem> = {};
      itemsList.forEach((item) => {
        map[item.id] = item;
      });
      setBankMap(map);
    };

    fetchBank();
    return () => {
      isMounted = false;
    };
  }, [user, isDummy]);

  // Save idea modifications
  const handleSaveEdits = async () => {
    if (!project) return;
    setSaving(true);
    const updated: Project = {
      ...project,
      title: editTitle.trim(),
      brief: editBrief.trim() || null,
      notes: editNotes.trim(),
      tags: editTags,
      updatedAt: Date.now(),
    };

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'projects', project.id), {
          title: updated.title,
          brief: updated.brief,
          notes: updated.notes,
          tags: updated.tags,
          updatedAt: Date.now(),
        });
      }
      await saveProject(updated);
      setProject(updated);
      setEditing(false);
    } catch (e: any) {
      await saveProject(updated);
      setProject(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Get inspirations from the dump matching this idea
  const handleGetInspirationsFromDump = async () => {
    if (!project) return;
    setLoadingSuggestions(true);

    if (allDumpItems.length === 0) {
      Alert.alert(
        'Inspiration Bank is Empty',
        'Dump links from Pinterest, Instagram, or mobile apps in your Bank first so they can be matched as references for this idea.'
      );
      setLoadingSuggestions(false);
      return;
    }

    try {
      // 1. Try cloud function if available
      if (user) {
        try {
          const suggestFn = httpsCallable<
            { projectId: string },
            { suggestions: Array<{ inspirationId: string; reason: string; confidence: number }> }
          >(functions, 'suggestProjectLinks');
          const res = await suggestFn({ projectId: id! });
          if (res.data?.suggestions && res.data.suggestions.length > 0) {
            const mapped: IdeaMatchResult[] = res.data.suggestions.map((s) => ({
              inspirationId: s.inspirationId,
              inspiration: bankMap[s.inspirationId] || {
                id: s.inspirationId,
                title: 'Dump Item',
                kind: 'link',
              } as any,
              confidence: s.confidence,
              reason: s.reason,
              matchedKeywords: [],
            }));
            setMatchedResults(mapped);
            setHasSearched(true);
            setLoadingSuggestions(false);
            return;
          }
        } catch {}
      }

      // 2. Intelligent local matching engine
      const attachedSet = new Set(links.map((l) => l.inspirationId));
      const localMatches = matchIdeaWithDump(
        {
          title: project.title,
          brief: project.brief,
          notes: project.notes,
          tags: project.tags,
        },
        allDumpItems,
        attachedSet
      );

      setMatchedResults(localMatches);
      setHasSearched(true);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Attach inspiration to this idea as reference
  const handleAttachReference = async (
    inspirationId: string,
    reason: string | null = null,
    confidence: number | null = null
  ) => {
    if (!id) return;
    try {
      const newLink = await attachInspirationToProject(
        id,
        inspirationId,
        confidence ? 'ai' : 'user',
        reason,
        confidence
      );

      if (user) {
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', inspirationId),
            {
              inspirationId,
              linkedBy: confidence ? 'ai' : 'user',
              reason,
              confidence,
              createdAt: Date.now(),
            }
          );
        } catch {}
      }

      setLinks((prev) => {
        if (prev.some((l) => l.inspirationId === inspirationId)) return prev;
        return [newLink, ...prev];
      });

      // Remove from matched results
      setMatchedResults((prev) => prev.filter((r) => r.inspirationId !== inspirationId));
    } catch (err: any) {
      Alert.alert('Error', 'Failed to attach reference.');
    }
  };

  // Attach all top matched inspirations
  const handleAttachAllMatches = async () => {
    for (const match of matchedResults) {
      await handleAttachReference(match.inspirationId, match.reason, match.confidence);
    }
  };

  // Detach inspiration reference
  const handleDetachReference = async (inspirationId: string) => {
    if (!id) return;
    try {
      await detachInspirationFromProject(id, inspirationId);
      if (user) {
        try {
          await deleteDoc(
            doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', inspirationId)
          );
        } catch {}
      }
      setLinks((prev) => prev.filter((l) => l.inspirationId !== inspirationId));
    } catch (err: any) {
      Alert.alert('Error', 'Failed to detach reference.');
    }
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!project) return;
    Alert.alert('Delete Idea', 'Are you sure you want to delete this idea?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProjectLocal(project.id);
            if (user) {
              await deleteDoc(doc(db, 'users', user.uid, 'projects', project.id)).catch(() => {});
            }
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  if (loading || !project) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title="rut"
          subtitle="Loading Idea..."
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(app)/(tabs)/projects');
            }
          }}
          backTitle="IDEAS"
        />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  const unattachedDumpItems = allDumpItems.filter(
    (item) => !links.some((l) => l.inspirationId === item.id)
  );

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar
        pillText="IDEA"
        message={project.title}
      />
      <TopNav
        title="rut"
        subtitle="Idea Studio"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/projects');
          }
        }}
        backTitle="IDEAS"
        rightAction={
          <Button
            title={editing ? '✕ CANCEL' : '✎ WRITE / EDIT'}
            variant="text"
            onPress={() => setEditing(!editing)}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* EDIT / WRITE IDEA FORM */}
        {editing ? (
          <Card style={styles.editCard}>
            <Text style={styles.sectionHeading}>WRITE / REFINE YOUR IDEA</Text>
            <Input label="IDEA TITLE" value={editTitle} onChangeText={setEditTitle} />
            <Input
              label="CONCEPT / BRIEF"
              value={editBrief}
              onChangeText={setEditBrief}
              placeholder="Describe your creative concept, problem, or vision..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
            <Input
              label="NOTES &amp; SPECIFICATIONS"
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Material details, color palettes, visual references, typography requirements..."
              multiline
              numberOfLines={5}
              style={{ height: 120, textAlignVertical: 'top' }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
              <Input
                value={editTagInput}
                onChangeText={setEditTagInput}
                placeholder="Add tag (e.g. ceramics, typography)..."
                containerStyle={{ flex: 1, marginVertical: 0 }}
                onSubmitEditing={() => {
                  const t = editTagInput.trim().toLowerCase();
                  if (t && !editTags.includes(t)) {
                    setEditTags([...editTags, t]);
                    setEditTagInput('');
                  }
                }}
              />
              <Button
                title="+ TAG"
                variant="secondary"
                onPress={() => {
                  const t = editTagInput.trim().toLowerCase();
                  if (t && !editTags.includes(t)) {
                    setEditTags([...editTags, t]);
                    setEditTagInput('');
                  }
                }}
                style={{ marginLeft: spacing.xs, height: 46 }}
              />
            </View>

            <View style={styles.tagRow}>
              {editTags.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEditTags(editTags.filter((tag) => tag !== t))}
                >
                  <Badge label={`#${t} ✕`} variant="grade" style={{ marginRight: 4, marginBottom: 4 }} />
                </Pressable>
              ))}
            </View>

            <Button
              title={saving ? 'SAVING...' : 'SAVE IDEA'}
              onPress={handleSaveEdits}
              loading={saving}
              style={{ marginTop: spacing.base }}
            />
          </Card>
        ) : (
          <View>
            {/* IDEA HEADER */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>{project.title}</Text>
              <Badge label={project.status.toUpperCase()} variant="inverse" />
            </View>

            {project.brief ? (
              <Card style={styles.briefCard}>
                <Text style={styles.sectionHeading}>CONCEPT BRIEF</Text>
                <Text style={styles.bodyText}>{project.brief}</Text>
              </Card>
            ) : null}

            {project.notes ? (
              <Card style={styles.notesCard}>
                <Text style={styles.sectionHeading}>NOTES &amp; SPECIFICATIONS</Text>
                <Text style={styles.bodyText}>{project.notes}</Text>
              </Card>
            ) : null}

            {/* TAGS */}
            {(project.tags || []).length > 0 ? (
              <View style={[styles.tagRow, { marginBottom: spacing.base }]}>
                {project.tags.map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" style={{ marginRight: 4 }} />
                ))}
              </View>
            ) : null}

            {/* MATCH ACTION BANNER */}
            <Card style={styles.matchActionCard}>
              <Text style={styles.matchActionTitle}>
                ⚡ GET INSPIRATIONS FROM DUMP FOR THIS IDEA
              </Text>
              <Text style={styles.matchActionDesc}>
                Scans your saved inspirations from Pinterest, Instagram, TikTok, and Web to match relevant visual references.
              </Text>
              <Button
                title={loadingSuggestions ? 'ANALYZING DUMP...' : '⚡ FIND INSPIRATIONS FROM DUMP'}
                onPress={handleGetInspirationsFromDump}
                loading={loadingSuggestions}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            {/* MATCHED INSPIRATIONS (FOUND FROM DUMP) */}
            {matchedResults.length > 0 ? (
              <View style={styles.matchedSection}>
                <View style={styles.matchedSectionHeader}>
                  <Text style={styles.sectionHeading}>
                    MATCHED INSPIRATIONS FROM DUMP ({matchedResults.length})
                  </Text>
                  <Button
                    title="ATTACH ALL MATCHES"
                    variant="primary"
                    onPress={handleAttachAllMatches}
                    style={{ height: 32, paddingHorizontal: 10 }}
                  />
                </View>

                {matchedResults.map((result) => {
                  const item = result.inspiration;
                  return (
                    <Card key={result.inspirationId} style={styles.matchedCard}>
                      <View style={styles.matchedHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Badge
                            label={`${Math.round(result.confidence * 100)}% MATCH`}
                            variant="inverse"
                            style={{ marginRight: spacing.xs }}
                          />
                          {item.sourcePlatform ? (
                            <Badge
                              label={item.sourcePlatform.toUpperCase()}
                              variant="outline"
                            />
                          ) : null}
                        </View>
                      </View>

                      {item.remotePreviewImageUrl ? (
                        <Image
                          source={{ uri: item.remotePreviewImageUrl }}
                          style={styles.matchedThumb}
                          resizeMode="cover"
                        />
                      ) : null}

                      <Text style={styles.matchedTitle}>{item.title}</Text>
                      <Text style={styles.matchedReason}>💡 {result.reason}</Text>

                      {item.url ? (
                        <Pressable onPress={() => Linking.openURL(item.url!)}>
                          <Text style={styles.urlLink} numberOfLines={1}>
                            ↗ {item.url}
                          </Text>
                        </Pressable>
                      ) : null}

                      <View style={styles.matchedButtonRow}>
                        <Button
                          title="+ ATTACH AS REFERENCE"
                          variant="primary"
                          onPress={() =>
                            handleAttachReference(
                              result.inspirationId,
                              result.reason,
                              result.confidence
                            )
                          }
                          style={{ height: 36, paddingHorizontal: 14 }}
                        />
                        <Button
                          title="DISMISS"
                          variant="text"
                          onPress={() =>
                            setMatchedResults((prev) =>
                              prev.filter((r) => r.inspirationId !== result.inspirationId)
                            )
                          }
                          style={{ marginLeft: spacing.sm }}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : hasSearched ? (
              <Card style={[styles.emptyLinksCard, { marginBottom: spacing.base }]}>
                <Text style={styles.emptyLinksTitle}>NO DIRECT MATCHES IN DUMP</Text>
                <Text style={styles.emptyLinksText}>
                  No inspirations in your bank matched this idea&apos;s tags or concepts. You can dump more links in your Bank, or use &ldquo;+ BROWSE DUMP&rdquo; below to attach any saved reference manually.
                </Text>
              </Card>
            ) : null}

            {/* ATTACHED REFERENCES SECTION */}
            <View style={styles.linksHeader}>
              <Text style={styles.sectionHeading}>
                ATTACHED REFERENCES ({links.length})
              </Text>
              <Button
                title={showManualPicker ? 'HIDE PICKER' : '+ BROWSE DUMP'}
                variant="secondary"
                onPress={() => setShowManualPicker(!showManualPicker)}
                style={{ height: 34, paddingHorizontal: 10 }}
              />
            </View>

            {/* MANUAL DUMP PICKER */}
            {showManualPicker ? (
              <Card style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>SELECT ANY INSPIRATION FROM YOUR DUMP</Text>
                {unattachedDumpItems.length === 0 ? (
                  <Text style={styles.emptyLinksText}>All dump items are already attached!</Text>
                ) : (
                  unattachedDumpItems.map((item) => (
                    <View key={item.id} style={styles.pickerRow}>
                      <View style={{ flex: 1, marginRight: spacing.xs }}>
                        <Text style={styles.pickerItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.pickerItemSub}>
                          {item.sourcePlatform ? item.sourcePlatform.toUpperCase() : item.kind}
                        </Text>
                      </View>
                      <Button
                        title="+ ATTACH"
                        variant="secondary"
                        onPress={() => handleAttachReference(item.id, 'Manually attached reference')}
                        style={{ height: 32, paddingHorizontal: 10 }}
                      />
                    </View>
                  ))
                )}
              </Card>
            ) : null}

            {links.length === 0 ? (
              <Card style={styles.emptyLinksCard}>
                <Text style={styles.emptyLinksTitle}>NO REFERENCES ATTACHED YET</Text>
                <Text style={styles.emptyLinksText}>
                  Click &ldquo;Find Inspirations From Dump&rdquo; above to automatically match and attach references from your saved items.
                </Text>
              </Card>
            ) : (
              links.map((link) => {
                const item = bankMap[link.inspirationId];
                return (
                  <Card key={link.id} style={styles.linkCard}>
                    <View style={styles.linkCardHeader}>
                      <View style={{ flex: 1, marginRight: spacing.xs }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          {item?.sourcePlatform ? (
                            <Badge
                              label={item.sourcePlatform.toUpperCase()}
                              variant="inverse"
                              style={{ marginRight: 6 }}
                            />
                          ) : null}
                          <Badge
                            label={link.linkedBy === 'ai' ? 'ATTACHED MATCH' : 'ATTACHED REFERENCE'}
                            variant="grade"
                          />
                        </View>
                        <Text style={styles.linkTitle} numberOfLines={2}>
                          {item ? item.title : `Reference ${link.inspirationId}`}
                        </Text>
                        {link.reason ? (
                          <Text style={styles.linkReason}>💡 {link.reason}</Text>
                        ) : null}
                      </View>

                      {item?.remotePreviewImageUrl ? (
                        <Image
                          source={{ uri: item.remotePreviewImageUrl }}
                          style={styles.attachedThumb}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>

                    {item?.url ? (
                      <Pressable onPress={() => Linking.openURL(item.url!)}>
                        <Text style={styles.urlLink} numberOfLines={1}>
                          ↗ {item.url}
                        </Text>
                      </Pressable>
                    ) : null}

                    <View style={styles.linkActions}>
                      {item ? (
                        <Button
                          title="VIEW IN BANK →"
                          variant="text"
                          onPress={() => router.push(`/(app)/inspiration/${item.id}`)}
                          style={{ marginRight: spacing.base }}
                        />
                      ) : null}
                      <Button
                        title="✕ DETACH"
                        variant="text"
                        onPress={() => handleDetachReference(link.inspirationId)}
                      />
                    </View>
                  </Card>
                );
              })
            )}

            {/* DELETE IDEA BUTTON */}
            <View style={styles.footerSection}>
              <Button
                title="DELETE IDEA"
                variant="secondary"
                onPress={handleDeleteProject}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.base,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  editCard: {
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  title: {
    ...typography.displayMd,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.sm,
  },
  briefCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.base,
  },
  notesCard: {
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sectionHeading: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '700',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  bodyText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xxs,
  },
  matchActionCard: {
    backgroundColor: colors.ink,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  matchActionTitle: {
    ...typography.captionCap,
    color: colors.onInk,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.xxs,
  },
  matchActionDesc: {
    ...typography.captionSm,
    color: colors.hairlineSoft,
    lineHeight: 18,
  },
  matchedSection: {
    marginBottom: spacing.base,
  },
  matchedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  matchedCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.ink,
    marginBottom: spacing.sm,
    padding: spacing.base,
  },
  matchedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  matchedThumb: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceGrade,
    marginBottom: spacing.xs,
  },
  matchedTitle: {
    ...typography.bodyLg,
    color: colors.ink,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  matchedReason: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  matchedButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  linksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  pickerCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  pickerTitle: {
    ...typography.captionCap,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pickerItemTitle: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: '500',
  },
  pickerItemSub: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
  emptyLinksCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyLinksTitle: {
    ...typography.captionCap,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  emptyLinksText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  linkCard: {
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.base,
  },
  linkCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  linkTitle: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkReason: {
    ...typography.captionSm,
    color: colors.inkSoft,
    marginTop: 2,
  },
  attachedThumb: {
    width: 60,
    height: 60,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  urlLink: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
  linkActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  footerSection: {
    marginTop: spacing['2xl'],
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
