import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  collection,
  query,
  onSnapshot,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../src/lib/firebase/client';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../../../src/design/tokens';
import { Project, ProjectInspirationLink, InspirationItem } from '../../../src/types';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [links, setLinks] = useState<ProjectInspirationLink[]>([]);
  const [bankMap, setBankMap] = useState<Record<string, InspirationItem>>({});
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ inspirationId: string; reason: string; confidence: number }>
  >([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBrief, setEditBrief] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const projRef = doc(db, 'users', user.uid, 'projects', id);
    const unsubProject = onSnapshot(projRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as any) } as Project;
        setProject(data);
        setEditTitle(data.title);
        setEditBrief(data.brief || '');
        setEditNotes(data.notes || '');
      } else {
        router.replace('/(app)/(tabs)/projects');
      }
      setLoading(false);
    });

    const linksRef = collection(db, 'users', user.uid, 'projects', id, 'inspirationLinks');
    const unsubLinks = onSnapshot(linksRef, (snap) => {
      const fetched: ProjectInspirationLink[] = [];
      snap.forEach((d) => fetched.push({ id: d.id, ...(d.data() as any) }));
      setLinks(fetched);
    });

    return () => {
      unsubProject();
      unsubLinks();
    };
  }, [user, id]);

  // Fetch inspiration bank items for title/preview mapping
  useEffect(() => {
    if (!user) return;
    const fetchBank = async () => {
      const snap = await getDocs(collection(db, 'users', user.uid, 'inspirations'));
      const map: Record<string, InspirationItem> = {};
      snap.forEach((d) => {
        map[d.id] = { id: d.id, ...(d.data() as any) } as InspirationItem;
      });
      setBankMap(map);
    };
    fetchBank();
  }, [user]);

  const handleSaveEdits = async () => {
    if (!user || !project) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'projects', project.id), {
        title: editTitle.trim(),
        brief: editBrief.trim() || null,
        notes: editNotes.trim(),
        updatedAt: Date.now(),
      });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAiSuggestions = async () => {
    if (!user || !id || loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const suggestFn = httpsCallable<
        { projectId: string },
        { suggestions: Array<{ inspirationId: string; reason: string; confidence: number }> }
      >(functions, 'suggestProjectLinks');

      const res = await suggestFn({ projectId: id });
      const received = res.data.suggestions || [];
      setAiSuggestions(received);

      // Auto-link items if autoLinkEnabled is true and confidence >= threshold
      if (project?.autoLinkEnabled) {
        for (const sug of received) {
          if (sug.confidence >= project.autoLinkConfidenceThreshold) {
            await handleLinkInspiration(sug.inspirationId, 'ai', sug.reason, sug.confidence);
          }
        }
      }
    } catch (err: any) {
      Alert.alert('AI Matching Failed', err.message || 'Could not fetch suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLinkInspiration = async (
    inspirationId: string,
    linkedBy: 'user' | 'ai' = 'user',
    reason: string | null = null,
    confidence: number | null = null
  ) => {
    if (!user || !id) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', inspirationId),
        {
          inspirationId,
          linkedBy,
          reason,
          confidence,
          createdAt: Date.now(),
        }
      );
      // Remove from suggestions list if present
      setAiSuggestions((prev) => prev.filter((s) => s.inspirationId !== inspirationId));
    } catch (err: any) {
      Alert.alert('Error', 'Failed to link inspiration.');
    }
  };

  const handleUnlinkInspiration = async (inspirationId: string) => {
    if (!user || !id) return;
    try {
      await deleteDoc(
        doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', inspirationId)
      );
    } catch (err: any) {
      Alert.alert('Error', 'Failed to unlink item.');
    }
  };

  const handleDeleteProject = async () => {
    if (!user || !project) return;
    Alert.alert(
      'Delete Project',
      'Are you sure you want to permanently delete this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'projects', project.id));
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  if (loading || !project) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav title="rut" subtitle="Loading Project..." />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="PROJECT" message={project.title} />
      <TopNav
        title="rut"
        subtitle="Project Workspace"
        rightAction={
          <Button
            title={editing ? 'CANCEL' : 'EDIT'}
            variant="text"
            onPress={() => setEditing(!editing)}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {editing ? (
          <View>
            <Input label="PROJECT TITLE" value={editTitle} onChangeText={setEditTitle} />
            <Input
              label="BRIEF / OBJECTIVE"
              value={editBrief}
              onChangeText={setEditBrief}
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
            <Input
              label="NOTES"
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={6}
              style={{ height: 140, textAlignVertical: 'top' }}
            />
            <Button
              title={saving ? 'SAVING...' : 'SAVE PROJECT'}
              onPress={handleSaveEdits}
              loading={saving}
              style={{ marginTop: spacing.base }}
            />
          </View>
        ) : (
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{project.title}</Text>
              <Badge label={project.status.toUpperCase()} variant="inverse" />
            </View>

            {project.brief ? (
              <Card style={styles.briefCard}>
                <Text style={styles.sectionHeading}>BRIEF</Text>
                <Text style={styles.bodyText}>{project.brief}</Text>
              </Card>
            ) : null}

            {project.notes ? (
              <Card style={styles.notesCard}>
                <Text style={styles.sectionHeading}>NOTES &amp; SCRATCHPAD</Text>
                <Text style={styles.bodyText}>{project.notes}</Text>
              </Card>
            ) : null}

            {/* Linked Inspirations Section */}
            <View style={styles.linksHeader}>
              <Text style={styles.sectionHeading}>
                LINKED INSPIRATION ({links.length})
              </Text>
              <Button
                title={loadingSuggestions ? 'MATCHING...' : '⚡ FIND AI MATCHES'}
                variant="secondary"
                onPress={handleRequestAiSuggestions}
                loading={loadingSuggestions}
                style={{ height: 36, paddingHorizontal: 12 }}
              />
            </View>

            {links.length === 0 ? (
              <Card style={styles.emptyLinksCard}>
                <Text style={styles.emptyLinksText}>
                  No inspiration items linked yet. Tap &ldquo;Find AI Matches&rdquo; to discover relevant links from your bank.
                </Text>
              </Card>
            ) : (
              links.map((link) => {
                const item = bankMap[link.inspirationId];
                return (
                  <Card key={link.id} style={styles.linkCard}>
                    <View style={styles.linkCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkTitle} numberOfLines={1}>
                          {item ? item.title : `Inspiration ${link.inspirationId}`}
                        </Text>
                        {link.reason ? (
                          <Text style={styles.linkReason}>Why linked: {link.reason}</Text>
                        ) : null}
                      </View>
                      <Badge
                        label={link.linkedBy === 'ai' ? 'AI MATCH' : 'MANUAL'}
                        variant={link.linkedBy === 'ai' ? 'inverse' : 'grade'}
                      />
                    </View>
                    <View style={styles.linkActions}>
                      {item ? (
                        <Button
                          title="VIEW ITEM →"
                          variant="text"
                          onPress={() => router.push(`/(app)/inspiration/${item.id}`)}
                          style={{ marginRight: spacing.base }}
                        />
                      ) : null}
                      <Button
                        title="UNLINK"
                        variant="text"
                        onPress={() => handleUnlinkInspiration(link.inspirationId)}
                      />
                    </View>
                  </Card>
                );
              })
            )}

            {/* AI Suggestions Available for Confirmation */}
            {aiSuggestions.length > 0 ? (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.sectionHeading}>
                  AI SUGGESTIONS ({aiSuggestions.length})
                </Text>
                {aiSuggestions.map((sug) => {
                  const item = bankMap[sug.inspirationId];
                  return (
                    <Card key={sug.inspirationId} style={styles.suggestionCard}>
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item ? item.title : `Inspiration ${sug.inspirationId}`}
                        </Text>
                        <Badge
                          label={`${Math.round(sug.confidence * 100)}% MATCH`}
                          variant="outline"
                        />
                      </View>
                      <Text style={styles.suggestionReason}>{sug.reason}</Text>
                      <View style={styles.suggestionButtonRow}>
                        <Button
                          title="+ LINK TO PROJECT"
                          variant="primary"
                          onPress={() =>
                            handleLinkInspiration(
                              sug.inspirationId,
                              'ai',
                              sug.reason,
                              sug.confidence
                            )
                          }
                          style={{ height: 36, paddingHorizontal: 16 }}
                        />
                        <Button
                          title="DISMISS"
                          variant="text"
                          onPress={() =>
                            setAiSuggestions((prev) =>
                              prev.filter((s) => s.inspirationId !== sug.inspirationId)
                            )
                          }
                          style={{ marginLeft: spacing.base }}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : null}

            {/* Project Settings & Delete */}
            <View style={styles.footerSection}>
              <Button
                title="DELETE PROJECT"
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

const styles = StyleSheet.create({
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
  },
  bodyText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
  },
  linksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  emptyLinksCard: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    padding: spacing.base,
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
  },
  linkReason: {
    ...typography.captionSm,
    color: colors.inkSoft,
    marginTop: 2,
  },
  linkActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  suggestionsContainer: {
    marginTop: spacing.xl,
  },
  suggestionCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.xs,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  suggestionTitle: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.xs,
  },
  suggestionReason: {
    ...typography.captionSm,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  suggestionButtonRow: {
    flexDirection: 'row',
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
