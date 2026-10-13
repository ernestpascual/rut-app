import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Modal,
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
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { Project, ProjectInspirationLink, InspirationItem, ChatMessage, ChatSession } from '../../../src/types';
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
import {
  getOrCreateIdeaChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  AVAILABLE_MODELS,
  DEFAULT_AI_MODEL,
  getUserPreferredModel,
  setUserPreferredModel,
} from '../../../src/features/chat/chatService';

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

  // Train of Thought Chat state
  const [ideaChat, setIdeaChat] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [sendingThought, setSendingThought] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL);
  const [showModelModal, setShowModelModal] = useState(false);
  const thoughtStreamScrollRef = useRef<ScrollView>(null);

  // Load user's default preferred model
  useEffect(() => {
    getUserPreferredModel(user?.uid).then((pref) => {
      if (pref) setSelectedModel(pref);
    });
  }, [user?.uid]);

  // Auto-scroll chat stream when thoughts update
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        thoughtStreamScrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatMessages.length, sendingThought]);

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
          snap.forEach((d) => {
            itemsList.push({ id: d.id, ...(d.data() as any) } as InspirationItem);
          });
        } catch {
          itemsList = await getDumpInspirations();
        }
      } else {
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

  // Synchronize dedicated Train of Thought for this Idea
  useEffect(() => {
    if (!project) return;
    let isMounted = true;

    const attachedItems = links
      .map((l) => bankMap[l.inspirationId])
      .filter(Boolean) as InspirationItem[];

    getOrCreateIdeaChat(project, attachedItems, user?.uid).then(async (chat) => {
      if (!isMounted) return;
      setIdeaChat(chat);
      const msgs = await getChatMessages(chat.id, user?.uid);
      if (isMounted) {
        setChatMessages(msgs);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [project?.id, project?.title, links.length, user?.uid]);

  // Send a thought or query in the idea's train of thought
  const handleSendThought = async (customPrompt?: string) => {
    const promptToSend = (customPrompt !== undefined ? customPrompt : chatInputText).trim();
    if (!promptToSend || !ideaChat || sendingThought || !project) return;

    setChatInputText('');
    setSendingThought(true);

    try {
      const attachedItems = links
        .map((l) => bankMap[l.inspirationId])
        .filter(Boolean) as InspirationItem[];

      const result = await sendChatMessage(ideaChat.id, promptToSend, {
        uid: user?.uid,
        ideaContext: {
          title: project.title,
          brief: project.brief,
          notes: project.notes,
          tags: project.tags,
        },
        pinnedInspirations: attachedItems,
        allInspirations: allDumpItems,
        model: selectedModel,
      });

      setChatMessages((prev) => {
        const filtered = prev.filter(
          (m) => m.id !== result.userMessage.id && m.id !== result.assistantMessage.id
        );
        return [...filtered, result.userMessage, result.assistantMessage];
      });

      const updatedProj: Project = {
        ...project,
        thoughtCount: (project.thoughtCount || 0) + 1,
        chatId: ideaChat.id,
        updatedAt: Date.now(),
      };
      setProject(updatedProj);
      saveProject(updatedProj).catch(() => {});
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Could not complete thought train.');
    } finally {
      setSendingThought(false);
    }
  };

  const handleDeleteThought = (messageId: string) => {
    if (!ideaChat) return;
    Alert.alert('Delete Insight', 'Are you sure you want to delete this thought message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChatMessage(ideaChat.id, messageId, user?.uid);
          setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
        },
      },
    ]);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setUserPreferredModel(modelId, user?.uid);
    setShowModelModal(false);
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
              {Array.from(new Set(editTags)).map((t, idx) => (
                <Pressable
                  key={`edit-tag-${t}-${idx}`}
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
                {Array.from(new Set(project.tags)).map((t, idx) => (
                  <Badge key={`proj-tag-${t}-${idx}`} label={`#${t}`} variant="grade" style={{ marginRight: 4 }} />
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
                        {item?.editorialContext ? (
                          <Text style={styles.linkReason} numberOfLines={2}>
                            {item.editorialContext}
                          </Text>
                        ) : link.reason ? (
                          <Text style={styles.linkReason}>💡 {link.reason}</Text>
                        ) : null}

                        {item?.tags && item.tags.length > 0 ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                            {Array.from(new Set(item.tags)).slice(0, 4).map((t, idx) => (
                              <Badge key={`item-tag-${t}-${idx}`} label={`#${t}`} variant="grade" style={{ marginRight: 4, marginBottom: 2 }} />
                            ))}
                          </View>
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

            {/* TRAIN OF THOUGHT CHAT SECTION */}
            <View style={styles.thoughtSection}>
              <View style={styles.thoughtHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, flex: 1 }}>
                  <Text style={styles.sectionHeading}>TRAIN OF THOUGHT</Text>
                  <Badge
                    label={`${chatMessages.length} THOUGHTS`}
                    variant={chatMessages.length > 0 ? 'inverse' : 'grade'}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Pressable
                    style={styles.modelPillButton}
                    onPress={() => setShowModelModal(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Change AI model"
                  >
                    <Text style={styles.modelPillText}>
                      ⚡ {selectedModel.replace('gemini-', '').toUpperCase()} ▾
                    </Text>
                  </Pressable>
                  {ideaChat ? (
                    <Button
                      title="↗ FULL CHAT"
                      variant="secondary"
                      onPress={() => router.push(`/(app)/chat/${ideaChat.id}`)}
                      style={{ height: 32, paddingHorizontal: 10 }}
                    />
                  ) : null}
                </View>
              </View>

              <Card style={styles.thoughtCard}>
                <Text style={styles.thoughtBannerText}>
                  Interactive thought flow powered by {selectedModel}. Attached inspirations ({links.length}) are anchored into reasoning context.
                </Text>

                {/* SCROLLABLE CHAT MESSAGES STREAM */}
                <View style={styles.chatStreamContainer}>
                  {chatMessages.length > 0 ? (
                    <ScrollView
                      nestedScrollEnabled
                      ref={thoughtStreamScrollRef}
                      style={styles.chatMessageScroll}
                      contentContainerStyle={styles.chatMessageScrollContent}
                      showsVerticalScrollIndicator
                    >
                      {chatMessages.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.chatBubbleWrapper,
                              isUser ? styles.chatUserWrapper : styles.chatAssistantWrapper,
                            ]}
                          >
                            <View
                              style={[
                                styles.chatBubble,
                                isUser ? styles.chatUserBubble : styles.chatAssistantBubble,
                              ]}
                            >
                              <View style={styles.chatBubbleMetaRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text
                                    style={[
                                      styles.chatRoleTag,
                                      isUser ? styles.chatUserRoleTag : styles.chatAssistantRoleTag,
                                    ]}
                                  >
                                    {isUser ? 'YOU' : 'RUT'}
                                  </Text>
                                  {!isUser && (
                                    <Badge
                                      label={msg.model ? msg.model.replace('gemini-', '').toUpperCase() : selectedModel.replace('gemini-', '').toUpperCase()}
                                      variant="grade"
                                      style={{ marginLeft: 6, paddingVertical: 1, paddingHorizontal: 4 }}
                                    />
                                  )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text
                                    style={[
                                      styles.chatTimestamp,
                                      isUser ? styles.chatUserTimestamp : styles.chatAssistantTimestamp,
                                    ]}
                                  >
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                  <Pressable
                                    onPress={() => handleDeleteThought(msg.id)}
                                    hitSlop={8}
                                    style={{ marginLeft: 8 }}
                                  >
                                    <Text
                                      style={[
                                        styles.chatDeleteBtn,
                                        isUser ? styles.chatUserDeleteBtn : styles.chatAssistantDeleteBtn,
                                      ]}
                                    >
                                      ✕
                                    </Text>
                                  </Pressable>
                                </View>
                              </View>

                              <Text
                                style={[
                                  styles.chatMessageText,
                                  isUser ? styles.chatUserText : styles.chatAssistantText,
                                ]}
                                selectable
                              >
                                {msg.content}
                              </Text>

                              {/* Cited references */}
                              {msg.sourceInspirationIds && msg.sourceInspirationIds.length > 0 && (
                                <View style={styles.chatCitationsBox}>
                                  <Text style={styles.chatCitationsTitle}>CITED REFERENCES:</Text>
                                  <View style={styles.chatCitationsRow}>
                                    {msg.sourceInspirationIds.map((sid) => {
                                      const item = bankMap[sid] || allDumpItems.find((d) => d.id === sid);
                                      return (
                                        <Pressable
                                          key={sid}
                                          style={styles.citationPill}
                                          onPress={() => router.push(`/(app)/inspiration/${sid}`)}
                                        >
                                          <Text style={styles.citationPillText} numberOfLines={1}>
                                            🔗 {item?.title || `Ref [${sid.slice(-4)}]`}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyThoughtBox}>
                      <Text style={styles.emptyThoughtHeading}>START THE TRAIN OF THOUGHT</Text>
                      <Text style={styles.emptyThoughtText}>
                        Brainstorm angles, critique directions, or synthesize your saved inspirations using {selectedModel}.
                      </Text>
                    </View>
                  )}
                </View>

                {sendingThought ? (
                  <View style={styles.thinkingIndicator}>
                    <ActivityIndicator size="small" color={colors.ink} />
                    <Text style={styles.thinkingText}>
                      DEVELOPING TRAIN OF THOUGHT ({selectedModel.replace('gemini-', '').toUpperCase()})...
                    </Text>
                  </View>
                ) : null}

                {/* QUICK PROMPT CHIPS CAROUSEL */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.quickPromptScroll}
                  contentContainerStyle={styles.quickPromptScrollContent}
                >
                  <Pressable
                    style={styles.quickChip}
                    onPress={() => handleSendThought(`Explore conceptual variations and bold angles for ${project.title}`)}
                  >
                    <Text style={styles.quickChipText}>💡 Concept Variations</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickChip}
                    onPress={() => handleSendThought(`Suggest materiality, textures, and color palette for ${project.title}`)}
                  >
                    <Text style={styles.quickChipText}>🎨 Material & Palette</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickChip}
                    onPress={() => handleSendThought(`Synthesize this idea with all attached inspirations`)}
                  >
                    <Text style={styles.quickChipText}>🔗 Synthesize References</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickChip}
                    onPress={() => handleSendThought(`Critique and sharpen the editorial brief for ${project.title}`)}
                  >
                    <Text style={styles.quickChipText}>✍️ Polish Brief</Text>
                  </Pressable>
                  <Pressable
                    style={styles.quickChip}
                    onPress={() => handleSendThought(`What spatial or physical installation would best manifest ${project.title}?`)}
                  >
                    <Text style={styles.quickChipText}>📐 Spatial & Form</Text>
                  </Pressable>
                </ScrollView>

                {/* INLINE CHAT INPUT DOCK */}
                <View style={styles.chatInputDock}>
                  <View style={styles.chatInputTopRow}>
                    <Pressable
                      style={styles.chatInputModelBadge}
                      onPress={() => setShowModelModal(true)}
                    >
                      <Text style={styles.chatInputModelText}>
                        ⚡ {selectedModel} ▾
                      </Text>
                    </Pressable>
                    <Text style={styles.chatInputHelpText}>
                      Tap model to switch • Persists across sessions
                    </Text>
                  </View>
                  <View style={styles.thoughtInputRow}>
                    <Input
                      value={chatInputText}
                      onChangeText={setChatInputText}
                      placeholder="Type a thought, critique, or inquiry..."
                      containerStyle={{ flex: 1, marginVertical: 0 }}
                      onSubmitEditing={() => handleSendThought()}
                      returnKeyType="send"
                    />
                    <Button
                      title={sendingThought ? '...' : 'THINK →'}
                      onPress={() => handleSendThought()}
                      disabled={!chatInputText.trim() || sendingThought}
                      style={{ marginLeft: spacing.xs, height: 46, paddingHorizontal: 16 }}
                    />
                  </View>
                </View>
              </Card>
            </View>

            {/* MODEL SELECTION MODAL */}
            <Modal visible={showModelModal} animationType="slide" transparent>
              <SafeAreaView style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <TopNav
                    title="rut"
                    subtitle="Select Gemini Model"
                    rightAction={
                      <Button
                        title="DONE"
                        variant="text"
                        onPress={() => setShowModelModal(false)}
                      />
                    }
                  />
                  <ScrollView style={{ padding: spacing.base }}>
                    <Text style={styles.modalSubhead}>
                      Select the model used for Train of Thought synthesis and inspiration retrieval. Your choice is saved as your default model preference.
                    </Text>
                    {AVAILABLE_MODELS.map((m) => {
                      const isSelected = selectedModel === m.id;
                      return (
                        <Card
                          key={m.id}
                          onPress={() => handleSelectModel(m.id)}
                          style={[
                            styles.modelCardItem,
                            isSelected ? styles.modelCardItemActive : null,
                          ]}
                        >
                          <View style={styles.modelRow}>
                            <View style={{ flex: 1, marginRight: spacing.sm }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={[styles.modelItemTitle, { fontWeight: '700' }]}>{m.name}</Text>
                                <Badge
                                  label={m.badge}
                                  variant={isSelected ? 'inverse' : 'grade'}
                                  style={{ marginLeft: spacing.xs }}
                                />
                              </View>
                              <Text style={[styles.modelItemDesc, { fontSize: 11, lineHeight: 16 }]}>
                                {m.description}
                              </Text>
                            </View>
                            <Badge
                              label={isSelected ? 'ACTIVE ✓' : 'SELECT'}
                              variant={isSelected ? 'inverse' : 'outline'}
                            />
                          </View>
                        </Card>
                      );
                    })}
                  </ScrollView>
                </View>
              </SafeAreaView>
            </Modal>

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
  thoughtSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.base,
  },
  thoughtHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modelPillButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  modelPillText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  thoughtCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.ink,
    padding: spacing.base,
  },
  thoughtBannerText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  chatStreamContainer: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    marginBottom: spacing.sm,
  },
  chatMessageScroll: {
    maxHeight: 420,
    minHeight: 180,
  },
  chatMessageScrollContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  chatBubbleWrapper: {
    width: '100%',
  },
  chatUserWrapper: {
    alignItems: 'flex-end',
  },
  chatAssistantWrapper: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    maxWidth: '92%',
    padding: spacing.sm,
  },
  chatUserBubble: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  chatAssistantBubble: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
  },
  chatBubbleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatRoleTag: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
  },
  chatUserRoleTag: {
    color: colors.onInk,
  },
  chatAssistantRoleTag: {
    color: colors.ink,
  },
  chatTimestamp: {
    ...typography.captionCap,
    fontSize: 8,
  },
  chatUserTimestamp: {
    color: colors.inkMid,
  },
  chatAssistantTimestamp: {
    color: colors.inkSoft,
  },
  chatDeleteBtn: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
  },
  chatUserDeleteBtn: {
    color: colors.inkMid,
  },
  chatAssistantDeleteBtn: {
    color: colors.inkSoft,
  },
  chatMessageText: {
    ...typography.bodyMd,
    fontSize: 13,
    lineHeight: 19,
  },
  chatUserText: {
    color: colors.onInk,
  },
  chatAssistantText: {
    color: colors.ink,
  },
  chatCitationsBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  chatCitationsTitle: {
    ...typography.captionCap,
    fontSize: 8,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  chatCitationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  citationPill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  citationPillText: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.ink,
  },
  emptyThoughtBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyThoughtHeading: {
    ...typography.captionCap,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyThoughtText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  thinkingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  thinkingText: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    marginLeft: spacing.xs,
  },
  quickPromptScroll: {
    marginBottom: spacing.sm,
  },
  quickPromptScrollContent: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.canvas,
  },
  quickChipText: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '600',
    fontSize: 10,
  },
  chatInputDock: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xs,
  },
  chatInputTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  chatInputModelBadge: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chatInputModelText: {
    ...typography.captionCap,
    fontSize: 8,
    fontWeight: '700',
    color: colors.ink,
  },
  chatInputHelpText: {
    ...typography.captionCap,
    fontSize: 8,
    color: colors.inkSoft,
  },
  thoughtInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  modalSubhead: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.base,
  },
  modelCardItem: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    padding: spacing.sm,
  },
  modelCardItemActive: {
    borderColor: colors.ink,
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelItemTitle: {
    ...typography.bodyMd,
    color: colors.ink,
  },
  modelItemDesc: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
});
