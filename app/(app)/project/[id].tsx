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
  Platform,
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
import { MarkdownRenderer } from '../../../src/components/ui/MarkdownRenderer';
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
  getChatSessions,
  saveChatSession,
  createChatSession,
  AVAILABLE_MODELS,
  DEFAULT_AI_MODEL,
  getUserPreferredModel,
  setUserPreferredModel,
} from '../../../src/features/chat/chatService';
import {
  copyIdeaAsMarkdown,
  exportIdeaAsPDF,
  exportIdeaAsDoc,
  generateIdeaContextMarkdown,
} from '../../../src/features/ideas/ideaExporter';
import { calculateDynamicInputHeight } from '../../../src/utils/inputHeight';

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
  const [deleting, setDeleting] = useState(false);

  // Studio Segmented Tab State ('overview' | 'references' | 'thoughts')
  const [activeTab, setActiveTab] = useState<'overview' | 'references' | 'thoughts'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Link existing Train of Thought chats to this Idea
  const [showLinkChatModal, setShowLinkChatModal] = useState(false);
  const [availableChats, setAvailableChats] = useState<ChatSession[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [linkingChatId, setLinkingChatId] = useState<string | null>(null);

  // Export idea context states
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);
  const [showPreviewMarkdown, setShowPreviewMarkdown] = useState(false);

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
    setActiveTab('references');
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
          setDeleting(true);
          try {
            await deleteProjectLocal(project.id);
            if (user) {
              await deleteDoc(doc(db, 'users', user.uid, 'projects', project.id)).catch(() => {});
            }
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setDeleting(false);
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
      if (chat.thesisStatement && !project.thesisStatement) {
        setProject((p) => (p ? { ...p, thesisStatement: chat.thesisStatement } : p));
      }
      const msgs = await getChatMessages(chat.id, user?.uid);
      if (isMounted) {
        setChatMessages(msgs);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [project?.id, project?.title, links.length, user?.uid]);

  // Open the full dedicated chat interface for this thought / idea
  const handleOpenFullChat = async () => {
    if (ideaChat) {
      router.push(`/(app)/chat/${ideaChat.id}`);
      return;
    }
    if (!project) return;
    try {
      const attachedItems = links
        .map((l) => bankMap[l.inspirationId])
        .filter(Boolean) as InspirationItem[];
      const chat = await getOrCreateIdeaChat(project, attachedItems, user?.uid);
      setIdeaChat(chat);
      router.push(`/(app)/chat/${chat.id}`);
    } catch {
      // Fallback
      router.push('/(app)/(tabs)/chats');
    }
  };

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

      if (result.thesisStatement) {
        setIdeaChat((prev) =>
          prev ? { ...prev, thesisStatement: result.thesisStatement || prev.thesisStatement } : prev
        );
      }

      const updatedProj: Project = {
        ...project,
        thesisStatement: result.thesisStatement || project.thesisStatement,
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

  // Add a train-of-thought message to the project's notes
  const handleAddThoughtToNotes = async (content: string) => {
    if (!project || !id) return;
    const currentNotes = project.notes || '';
    const formattedAddition = `\n\n--- Thought (${new Date().toLocaleDateString()}) ---\n${content}`;
    const updatedNotes = (currentNotes ? currentNotes + formattedAddition : content).trim();

    try {
      const updatedProj: Project = {
        ...project,
        notes: updatedNotes,
        updatedAt: Date.now(),
      };
      setProject(updatedProj);
      setEditNotes(updatedNotes);

      if (!isDummy) {
        await updateDoc(doc(db, 'users', user!.uid, 'projects', id), {
          notes: updatedNotes,
          updatedAt: new Date().toISOString(),
        });
      }
      await saveProject(updatedProj, user?.uid || DUMMY_USER_UID);
      setToastMessage('THOUGHT ADDED TO NOTES');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Failed to add thought to idea notes:', err);
      Alert.alert('Notice', 'Could not save thought to idea notes.');
    }
  };

  // Set a train-of-thought message as the concept brief
  const handleSetThoughtAsBrief = async (content: string) => {
    if (!project || !id) return;
    try {
      const updatedProj: Project = {
        ...project,
        brief: content,
        updatedAt: Date.now(),
      };
      setProject(updatedProj);
      setEditBrief(content);

      if (!isDummy) {
        await updateDoc(doc(db, 'users', user!.uid, 'projects', id), {
          brief: content,
          updatedAt: new Date().toISOString(),
        });
      }
      await saveProject(updatedProj, user?.uid || DUMMY_USER_UID);
      setToastMessage('THOUGHT SET AS BRIEF');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Failed to set brief:', err);
      Alert.alert('Notice', 'Could not update concept brief.');
    }
  };

  // Open modal to view and link existing chats
  const handleOpenLinkChatModal = async () => {
    setShowLinkChatModal(true);
    setLoadingChats(true);
    try {
      const sessions = await getChatSessions(user?.uid);
      setAvailableChats(sessions.filter((s) => !s.archived));
    } catch {
      setAvailableChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Link selected chat to this idea
  const handleLinkChat = async (selectedChat: ChatSession) => {
    if (!project) return;
    setLinkingChatId(selectedChat.id);
    try {
      // 1. Detach old chats currently linked to this project
      const allChats = await getChatSessions(user?.uid);
      for (const c of allChats) {
        if (c.id !== selectedChat.id && c.projectId === project.id) {
          const detached: ChatSession = {
            ...c,
            projectId: null,
            projectTitle: null,
            updatedAt: Date.now(),
          };
          await saveChatSession(detached, user?.uid);
        }
      }

      // 2. Attach selected chat to this project
      const updatedChat: ChatSession = {
        ...selectedChat,
        projectId: project.id,
        projectTitle: project.title,
        updatedAt: Date.now(),
      };
      await saveChatSession(updatedChat, user?.uid);

      // 3. Update project document
      const updatedProj: Project = {
        ...project,
        chatId: selectedChat.id,
        updatedAt: Date.now(),
      };
      await saveProject(updatedProj);
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'projects', project.id), {
          chatId: selectedChat.id,
          updatedAt: Date.now(),
        }).catch(() => {});
      }

      setProject(updatedProj);
      setIdeaChat(updatedChat);
      const msgs = await getChatMessages(selectedChat.id, user?.uid);
      setChatMessages(msgs);
      setShowLinkChatModal(false);
      Alert.alert(
        'Chat Linked',
        `"${selectedChat.title}" is now the active Train of Thought for this idea.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to link chat.');
    } finally {
      setLinkingChatId(null);
    }
  };

  // Create a brand new dedicated train of thought for this idea
  const handleCreateNewChatForIdea = async () => {
    if (!project) return;
    setLinkingChatId('new');
    try {
      const attachedItems = links
        .map((l) => bankMap[l.inspirationId])
        .filter(Boolean) as InspirationItem[];

      const newSession = await createChatSession(`${project.title} — Train of Thought`, {
        projectId: project.id,
        projectTitle: project.title,
        pinnedInspirationIds: attachedItems.map((a) => a.id),
        thesisStatement: project.thesisStatement || project.brief || null,
        uid: user?.uid,
      });

      const updatedProj: Project = {
        ...project,
        chatId: newSession.id,
        updatedAt: Date.now(),
      };
      await saveProject(updatedProj);
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'projects', project.id), {
          chatId: newSession.id,
          updatedAt: Date.now(),
        }).catch(() => {});
      }

      setProject(updatedProj);
      setIdeaChat(newSession);
      setChatMessages([]);
      setShowLinkChatModal(false);
      Alert.alert(
        'New Train of Thought Created',
        'A fresh dedicated thought stream has been linked to this idea.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create chat.');
    } finally {
      setLinkingChatId(null);
    }
  };

  // Export handlers
  const handleCopyMarkdown = async () => {
    if (!project) return;
    const success = await copyIdeaAsMarkdown(
      project,
      links,
      bankMap,
      ideaChat,
      chatMessages
    );
    if (success) {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
      Alert.alert('Copied to Clipboard', 'Full idea context markdown has been copied to your clipboard.');
    } else {
      Alert.alert('Notice', 'Unable to copy to clipboard automatically.');
    }
  };

  const handleExportPDF = async () => {
    if (!project) return;
    setExportingPDF(true);
    try {
      await exportIdeaAsPDF(
        project,
        links,
        bankMap,
        ideaChat,
        chatMessages
      );
    } catch (e: any) {
      Alert.alert('PDF Export Notice', e.message || 'Could not export as PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportDoc = async () => {
    if (!project) return;
    setExportingDoc(true);
    try {
      await exportIdeaAsDoc(
        project,
        links,
        bankMap,
        ideaChat,
        chatMessages
      );
    } catch (e: any) {
      Alert.alert('Document Export Notice', e.message || 'Could not export as Document.');
    } finally {
      setExportingDoc(false);
    }
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
            title="EXPORT ▾"
            variant="secondary"
            onPress={() => setShowExportModal(true)}
            style={{ height: 28, paddingHorizontal: 8 }}
          />
        }
      />

      {toastMessage ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>✓ {toastMessage}</Text>
        </View>
      ) : null}

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
              numberOfLines={1}
              style={{
                height: calculateDynamicInputHeight(editBrief),
                maxHeight: 124,
                paddingTop: 10,
                paddingBottom: 10,
                textAlignVertical: 'top',
              }}
            />
            <Input
              label="NOTES &amp; SPECIFICATIONS"
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Material details, color palettes, visual references, typography requirements..."
              multiline
              numberOfLines={1}
              style={{
                height: calculateDynamicInputHeight(editNotes),
                maxHeight: 124,
                paddingTop: 10,
                paddingBottom: 10,
                textAlignVertical: 'top',
              }}
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

            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.base }}>
              <Button
                title="CANCEL"
                variant="secondary"
                onPress={() => setEditing(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={saving ? 'SAVING...' : 'SAVE IDEA'}
                onPress={handleSaveEdits}
                loading={saving}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        ) : (
          <View>
            {/* CLEAN IDEA HEADER */}
            <View style={styles.headerArea}>
              <View style={styles.titleRow}>
                <Text style={styles.projectTitle}>{project.title}</Text>
                <Button
                  title="EDIT IDEA"
                  variant="secondary"
                  onPress={() => setEditing(true)}
                  style={styles.headerEditBtn}
                  textStyle={styles.headerEditBtnText}
                />
              </View>
            </View>

            {/* SLEEK SEGMENTED STUDIO TAB BAR */}
            <View style={styles.studioTabBar}>
              <Pressable
                style={[styles.studioTab, activeTab === 'overview' && styles.studioTabActive]}
                onPress={() => setActiveTab('overview')}
                accessibilityRole="tab"
                accessibilityLabel="Concept tab"
              >
                <Text style={[styles.studioTabLabel, activeTab === 'overview' && styles.studioTabLabelActive]}>
                  CONCEPT
                </Text>
              </Pressable>

              <Pressable
                style={[styles.studioTab, activeTab === 'references' && styles.studioTabActive]}
                onPress={() => setActiveTab('references')}
                accessibilityRole="tab"
                accessibilityLabel="References tab"
              >
                <Text style={[styles.studioTabLabel, activeTab === 'references' && styles.studioTabLabelActive]}>
                  REFERENCES
                </Text>
              </Pressable>

              <Pressable
                style={[styles.studioTab, activeTab === 'thoughts' && styles.studioTabActive]}
                onPress={() => setActiveTab('thoughts')}
                accessibilityRole="tab"
                accessibilityLabel="Thoughts tab"
              >
                <Text style={[styles.studioTabLabel, activeTab === 'thoughts' && styles.studioTabLabelActive]}>
                  THOUGHTS
                </Text>
              </Pressable>
            </View>

            {/* TAB 1: CONCEPT & SPECS */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                {project.brief ? (
                  <View style={styles.specSection}>
                    <Text style={styles.specSectionLabel}>CONCEPT BRIEF</Text>
                    <Card style={styles.specCard}>
                      <Text style={styles.specBodyText}>{project.brief}</Text>
                    </Card>
                  </View>
                ) : (
                  <View style={styles.specSection}>
                    <Text style={styles.specSectionLabel}>CONCEPT BRIEF</Text>
                    <Pressable
                      style={styles.specEmptyCard}
                      onPress={() => setEditing(true)}
                    >
                      <Text style={styles.specEmptyText}>No concept brief written yet</Text>
                      <Button
                        title="✎ WRITE BRIEF"
                        variant="secondary"
                        onPress={() => setEditing(true)}
                        style={{ height: 28, paddingHorizontal: 10 }}
                      />
                    </Pressable>
                  </View>
                )}

                {project.notes ? (
                  <View style={styles.specSection}>
                    <Text style={styles.specSectionLabel}>NOTES &amp; SPECIFICATIONS</Text>
                    <Card style={styles.specCard}>
                      <Text style={styles.specBodyText}>{project.notes}</Text>
                    </Card>
                  </View>
                ) : (
                  <View style={styles.specSection}>
                    <Text style={styles.specSectionLabel}>NOTES &amp; SPECIFICATIONS</Text>
                    <Pressable
                      style={styles.specEmptyCard}
                      onPress={() => setEditing(true)}
                    >
                      <Text style={styles.specEmptyText}>No specification notes written yet</Text>
                      <Button
                        title="✎ ADD NOTES"
                        variant="secondary"
                        onPress={() => setEditing(true)}
                        style={{ height: 28, paddingHorizontal: 10 }}
                      />
                    </Pressable>
                  </View>
                )}

                {(project.tags || []).length > 0 ? (
                  <View style={styles.specSection}>
                    <Text style={styles.specSectionLabel}>TAGS</Text>
                    <View style={styles.tagRow}>
                      {Array.from(new Set(project.tags)).map((t, idx) => (
                        <Badge
                          key={`proj-tag-${t}-${idx}`}
                          label={`#${t}`}
                          variant="grade"
                          style={{ marginRight: 4, marginBottom: 4 }}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Studio Cross-links Strip */}
                <View style={styles.overviewNavStrip}>
                  <Pressable
                    style={styles.overviewNavCard}
                    onPress={() => setActiveTab('references')}
                  >
                    <Text style={styles.overviewNavLabel}>VISUAL REFERENCES</Text>
                    <Text style={styles.overviewNavCount}>{links.length} Linked</Text>
                    <Text style={styles.overviewNavHint}>OPEN GALLERY →</Text>
                  </Pressable>

                  <Pressable
                    style={styles.overviewNavCard}
                    onPress={() => setActiveTab('thoughts')}
                  >
                    <Text style={styles.overviewNavLabel}>TRAIN OF THOUGHT</Text>
                    <Text style={styles.overviewNavCount}>{chatMessages.length} Messages</Text>
                    <Text style={styles.overviewNavHint}>BRAINSTORM →</Text>
                  </Pressable>
                </View>

                {/* DANGER ZONE */}
                <View style={styles.dangerZoneCard}>
                  <View style={styles.dangerZoneRow}>
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={styles.dangerHeading}>DELETE THIS IDEA</Text>
                      <Text style={styles.dangerText}>
                        Permanently delete this idea and all associated data.
                      </Text>
                    </View>
                    <Button
                      title={deleting ? 'DELETING...' : 'DELETE IDEA'}
                      onPress={handleDeleteProject}
                      disabled={deleting}
                      style={styles.dangerButton}
                      textStyle={styles.dangerButtonText}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: REFERENCES */}
            {activeTab === 'references' && (
              <View style={styles.tabContent}>
                {/* TOOLBAR */}
                <View style={styles.tabHeaderToolbar}>
                  <Text style={styles.tabSectionTitle}>
                    ATTACHED REFERENCES ({links.length})
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Button
                      title={loadingSuggestions ? 'SCANNING...' : '⚡ SCAN DUMP'}
                      variant="secondary"
                      onPress={handleGetInspirationsFromDump}
                      loading={loadingSuggestions}
                      style={{ height: 28, paddingHorizontal: 8 }}
                    />
                    <Button
                      title={showManualPicker ? 'HIDE PICKER' : '+ BROWSE DUMP'}
                      variant="secondary"
                      onPress={() => setShowManualPicker(!showManualPicker)}
                      style={{ height: 28, paddingHorizontal: 8 }}
                    />
                  </View>
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
                            style={{ height: 28, paddingHorizontal: 8 }}
                          />
                        </View>
                      ))
                    )}
                  </Card>
                ) : null}

                {/* AI MATCHED RESULTS */}
                {matchedResults.length > 0 && (
                  <View style={styles.matchedSection}>
                    <View style={styles.matchedSectionHeader}>
                      <Text style={styles.sectionHeading}>
                        MATCHED INSPIRATIONS ({matchedResults.length})
                      </Text>
                      <Button
                        title="ATTACH ALL MATCHES"
                        variant="primary"
                        onPress={handleAttachAllMatches}
                        style={{ height: 28, paddingHorizontal: 8 }}
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
                              style={{ height: 28, paddingHorizontal: 10 }}
                            />
                            <Button
                              title="DISMISS"
                              variant="text"
                              onPress={() =>
                                setMatchedResults((prev) =>
                                  prev.filter((r) => r.inspirationId !== result.inspirationId)
                                )
                              }
                              style={{ marginLeft: spacing.sm, height: 28, paddingHorizontal: 8 }}
                            />
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}

                {/* ATTACHED REFERENCES LIST */}
                {links.length === 0 ? (
                  <Card style={styles.emptyLinksCard}>
                    <Text style={styles.emptyLinksTitle}>NO REFERENCES ATTACHED YET</Text>
                    <Text style={styles.emptyLinksText}>
                      Tap &ldquo;⚡ SCAN DUMP&rdquo; above to automatically match references from your saved items, or &ldquo;+ BROWSE DUMP&rdquo; to attach manually.
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
                                  <Badge
                                    key={`item-tag-${t}-${idx}`}
                                    label={`#${t}`}
                                    variant="grade"
                                    style={{ marginRight: 4, marginBottom: 2 }}
                                  />
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
                              style={{ marginRight: spacing.base, height: 28, paddingHorizontal: 4 }}
                            />
                          ) : null}
                          <Button
                            title="✕ DETACH"
                            variant="text"
                            onPress={() => handleDetachReference(link.inspirationId)}
                            style={{ height: 28, paddingHorizontal: 4 }}
                          />
                        </View>
                      </Card>
                    );
                  })
                )}
              </View>
            )}

            {/* TAB 3: THOUGHTS */}
            {activeTab === 'thoughts' && (
              <View style={styles.tabContent}>
                {/* TOOLBAR: MODEL SELECTOR, LINK CHAT, OPEN CHAT */}
                <View style={styles.thoughtsToolbarContainer}>
                  <Pressable
                    style={styles.thoughtsEqualBtn}
                    onPress={() => setShowModelModal(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Select AI Model"
                  >
                    <Text style={styles.thoughtsEqualBtnText} numberOfLines={1}>
                      {selectedModel.replace('gemini-', '').toUpperCase()} ▾
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.thoughtsEqualBtn}
                    onPress={handleOpenLinkChatModal}
                    accessibilityRole="button"
                    accessibilityLabel="Link Chat"
                  >
                    <Text style={styles.thoughtsEqualBtnText} numberOfLines={1}>
                      LINK CHAT
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.thoughtsEqualBtn, styles.thoughtsEqualBtnPrimary]}
                    onPress={handleOpenFullChat}
                    accessibilityRole="button"
                    accessibilityLabel="Open Chat"
                  >
                    <Text style={[styles.thoughtsEqualBtnText, styles.thoughtsEqualBtnTextPrimary]} numberOfLines={1}>
                      OPEN CHAT
                    </Text>
                  </Pressable>
                </View>

                <Card style={styles.thoughtCard}>
                  <View style={styles.thoughtBannerRow}>
                    <Text style={styles.thoughtBannerText}>
                      Interactive thought flow linked to &ldquo;{ideaChat?.title || project.title}&rdquo;.
                    </Text>
                    <Pressable onPress={handleOpenFullChat} hitSlop={8}>
                      <Text style={styles.thoughtBannerAction}>OPEN CHAT →</Text>
                    </Pressable>
                  </View>

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
                              <Pressable
                                key={msg.id}
                                onPress={handleOpenFullChat}
                                style={({ pressed }) => [
                                  styles.chatBubbleWrapper,
                                  isUser ? styles.chatUserWrapper : styles.chatAssistantWrapper,
                                  pressed && { opacity: 0.8 },
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
                                          label={
                                            msg.model
                                              ? msg.model.replace('gemini-', '').toUpperCase()
                                              : selectedModel.replace('gemini-', '').toUpperCase()
                                          }
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
                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </Text>
                                      <Pressable
                                        onPress={handleOpenFullChat}
                                        hitSlop={8}
                                        style={styles.openInChatChip}
                                      >
                                        <Text style={styles.openInChatChipText}>↗ FULL CHAT</Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={(e) => {
                                          e.stopPropagation?.();
                                          handleDeleteThought(msg.id);
                                        }}
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

                                  {isUser ? (
                                    <Text style={styles.chatUserText} selectable>
                                      {msg.content}
                                    </Text>
                                  ) : (
                                    <MarkdownRenderer content={msg.content} />
                                  )}

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
                                              onPress={(e) => {
                                                e.stopPropagation?.();
                                                router.push(`/(app)/inspiration/${sid}`);
                                              }}
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
                                  {/* ACTION ROW: ADD THOUGHT TO IDEA NOTES / BRIEF */}
                                  <View style={styles.thoughtActionRow}>
                                    <Pressable
                                      style={styles.thoughtActionBtn}
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        handleAddThoughtToNotes(msg.content);
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel="Add to idea notes"
                                    >
                                      <Text style={styles.thoughtActionBtnText}>+ ADD TO NOTES</Text>
                                    </Pressable>
                                    <Pressable
                                      style={styles.thoughtActionBtn}
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        handleSetThoughtAsBrief(msg.content);
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel="Set as brief"
                                    >
                                      <Text style={styles.thoughtActionBtnText}>SET AS BRIEF</Text>
                                    </Pressable>
                                    <Pressable
                                      style={styles.thoughtActionBtn}
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        handleOpenFullChat();
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel="Open in full chat"
                                    >
                                      <Text style={styles.thoughtActionBtnText}>OPEN CHAT →</Text>
                                    </Pressable>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      ) : (
                        <Pressable
                          style={styles.emptyThoughtBox}
                          onPress={handleOpenFullChat}
                        >
                          <Text style={styles.emptyThoughtHeading}>START THE TRAIN OF THOUGHT</Text>
                          <Text style={styles.emptyThoughtText}>
                            Brainstorm angles, critique directions, or synthesize your saved inspirations using {selectedModel}. Tap to open chat.
                          </Text>
                          <Button
                            title="OPEN CHAT"
                            variant="primary"
                            onPress={handleOpenFullChat}
                            style={{ marginTop: spacing.sm, alignSelf: 'center', height: 36, paddingHorizontal: 16 }}
                          />
                        </Pressable>
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
                  </Card>
                </View>
              )}

            {/* LINK TRAIN OF THOUGHT MODAL */}
            <Modal visible={showLinkChatModal} animationType="slide" transparent>
              <SafeAreaView style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <TopNav
                    title="rut"
                    subtitle="Link Train of Thought"
                    rightAction={
                      <Button
                        title="DONE"
                        variant="text"
                        onPress={() => setShowLinkChatModal(false)}
                      />
                    }
                  />
                  <ScrollView style={{ padding: spacing.base }}>
                    <Text style={styles.modalSubhead}>
                      Attach any of your existing train of thought brainstorms to &ldquo;{project.title}&rdquo;, or spin up a new dedicated stream.
                    </Text>

                    <Card style={styles.newChatCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={styles.newChatTitle}>+ NEW DEDICATED STREAM</Text>
                          <Text style={styles.newChatDesc}>
                            Create a fresh, focused brainstorm session exclusively for this idea.
                          </Text>
                        </View>
                        <Button
                          title={linkingChatId === 'new' ? 'CREATING...' : '+ CREATE NEW'}
                          variant="primary"
                          onPress={handleCreateNewChatForIdea}
                          loading={linkingChatId === 'new'}
                          style={{ height: 32, paddingHorizontal: 10 }}
                        />
                      </View>
                    </Card>

                    <Text style={[styles.sectionHeading, { marginTop: spacing.base, marginBottom: spacing.xs }]}>
                      YOUR EXISTING TRAIN OF THOUGHT CHATS ({availableChats.length})
                    </Text>

                    {loadingChats ? (
                      <ActivityIndicator color={colors.ink} size="small" style={{ marginVertical: spacing.xl }} />
                    ) : availableChats.length === 0 ? (
                      <Card style={styles.emptyLinksCard}>
                        <Text style={styles.emptyLinksTitle}>NO CHATS FOUND</Text>
                        <Text style={styles.emptyLinksText}>
                          You do not have any other chat sessions yet. Tap &ldquo;+ Create New&rdquo; above to start a brainstorm stream.
                        </Text>
                      </Card>
                    ) : (
                      availableChats.map((c) => {
                        const isCurrentlyLinked = (ideaChat?.id === c.id) || (project.chatId === c.id);
                        const isLinking = linkingChatId === c.id;
                        return (
                          <Card
                            key={c.id}
                            style={[
                              styles.chatItemCard,
                              isCurrentlyLinked && styles.chatItemActiveCard,
                            ]}
                          >
                            <View style={styles.chatItemRow}>
                              <View style={{ flex: 1, marginRight: spacing.sm }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                  <Text style={styles.chatItemTitle} numberOfLines={1}>
                                    {c.title}
                                  </Text>
                                  {isCurrentlyLinked && (
                                    <Badge label="ACTIVE LINK ✓" variant="inverse" style={{ marginLeft: 6 }} />
                                  )}
                                </View>
                                <Text style={styles.chatItemSub}>
                                  {c.projectId === project.id
                                    ? 'Linked to this idea'
                                    : c.projectTitle
                                    ? `Linked to: ${c.projectTitle}`
                                    : 'General brainstorm thread'}
                                  {c.updatedAt
                                    ? ` • ${new Date(c.updatedAt).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                      })}`
                                    : ''}
                                </Text>
                              </View>

                              {isCurrentlyLinked ? (
                                <Button
                                  title="OPEN ↗"
                                  variant="secondary"
                                  onPress={() => {
                                    setShowLinkChatModal(false);
                                    router.push(`/(app)/chat/${c.id}`);
                                  }}
                                  style={{ height: 30, paddingHorizontal: 10 }}
                                />
                              ) : (
                                <Button
                                  title={isLinking ? 'LINKING...' : 'LINK TO IDEA'}
                                  variant="primary"
                                  onPress={() => handleLinkChat(c)}
                                  loading={isLinking}
                                  style={{ height: 30, paddingHorizontal: 10 }}
                                />
                              )}
                            </View>
                          </Card>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              </SafeAreaView>
            </Modal>

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

            {/* EXPORT IDEA CONTEXT MODAL */}
            <Modal visible={showExportModal} animationType="slide" transparent>
              <SafeAreaView style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <TopNav
                    title="rut"
                    subtitle="Export Idea Context"
                    rightAction={
                      <Button
                        title="DONE"
                        variant="text"
                        onPress={() => setShowExportModal(false)}
                      />
                    }
                  />
                  <ScrollView style={{ padding: spacing.base }}>
                    <Text style={styles.modalSubhead}>
                      Export &ldquo;{project.title}&rdquo; as comprehensive research context, including concept brief, specifications, attached dump references, and the full train of thought transcript.
                    </Text>

                    {/* OPTION 1: COPY AS MARKDOWN */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.exportOptionTitle}>📋 COPY AS MARKDOWN</Text>
                            {copiedMarkdown && (
                              <Badge label="COPIED ✓" variant="inverse" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                          <Text style={styles.exportOptionDesc}>
                            Compiles complete structured Markdown context for AI prompts (Claude, ChatGPT, Gemini), Obsidian, or developer docs.
                          </Text>
                        </View>
                        <Button
                          title={copiedMarkdown ? 'COPIED ✓' : 'COPY ⎘'}
                          variant={copiedMarkdown ? 'primary' : 'secondary'}
                          onPress={handleCopyMarkdown}
                          style={{ height: 32, paddingHorizontal: 12 }}
                        />
                      </View>
                    </Card>

                    {/* OPTION 2: EXPORT AS PDF */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={styles.exportOptionTitle}>📄 EXPORT AS PDF</Text>
                          <Text style={styles.exportOptionDesc}>
                            Generates an editorial print-ready PDF document with metadata badges, visual citations, and interactive transcripts.
                          </Text>
                        </View>
                        <Button
                          title={exportingPDF ? 'GENERATING...' : 'PRINT / PDF ↗'}
                          variant="primary"
                          onPress={handleExportPDF}
                          loading={exportingPDF}
                          style={{ height: 32, paddingHorizontal: 12 }}
                        />
                      </View>
                    </Card>

                    {/* OPTION 3: EXPORT AS DOC */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={styles.exportOptionTitle}>📝 EXPORT AS DOC</Text>
                          <Text style={styles.exportOptionDesc}>
                            Downloads a Microsoft Word and Google Docs compatible (.doc) file for editorial reviews, proposals, and briefs.
                          </Text>
                        </View>
                        <Button
                          title={exportingDoc ? 'PREPARING...' : 'DOWNLOAD .DOC ⤓'}
                          variant="secondary"
                          onPress={handleExportDoc}
                          loading={exportingDoc}
                          style={{ height: 32, paddingHorizontal: 12 }}
                        />
                      </View>
                    </Card>

                    {/* CONTEXT MARKDOWN PREVIEW */}
                    <View style={{ marginTop: spacing.base, marginBottom: spacing.xl }}>
                      <Pressable
                        style={styles.previewToggleBtn}
                        onPress={() => setShowPreviewMarkdown(!showPreviewMarkdown)}
                      >
                        <Text style={styles.previewToggleText}>
                          {showPreviewMarkdown ? '▴ HIDE RAW MARKDOWN PREVIEW' : '▾ VIEW COMPILED MARKDOWN CONTEXT'}
                        </Text>
                      </Pressable>

                      {showPreviewMarkdown && (
                        <Card style={styles.rawMarkdownCard}>
                          <Text style={styles.rawMarkdownText} selectable>
                            {generateIdeaContextMarkdown(
                              project,
                              links,
                              bankMap,
                              ideaChat,
                              chatMessages
                            )}
                          </Text>
                        </Card>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </SafeAreaView>
            </Modal>
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
  thoughtBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  thoughtBannerText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    flex: 1,
  },
  thoughtBannerAction: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '800',
    color: colors.ink,
    marginLeft: spacing.xs,
  },
  openInChatChip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  openInChatChipText: {
    ...typography.captionCap,
    fontSize: 8,
    fontWeight: '700',
    color: colors.ink,
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
    alignItems: 'flex-end',
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
  toastBanner: {
    backgroundColor: colors.ink,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  toastText: {
    ...typography.captionCap,
    color: colors.onInk,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  headerArea: {
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectTitle: {
    ...typography.displayMd,
    fontSize: 22,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.sm,
  },
  headerEditBtn: {
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEditBtnText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  thoughtsToolbarContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    marginBottom: spacing.sm,
  },
  thoughtsEqualBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  thoughtsEqualBtnPrimary: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  thoughtsEqualBtnText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  thoughtsEqualBtnTextPrimary: {
    color: colors.canvas,
  },
  studioTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    marginBottom: spacing.base,
    backgroundColor: colors.canvas,
  },
  studioTab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: spacing.xs,
  },
  studioTabActive: {
    borderBottomColor: colors.ink,
  },
  studioTabLabel: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  studioTabLabelActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  tabContent: {
    marginBottom: spacing.base,
  },
  tabHeaderToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tabSectionTitle: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  specSection: {
    marginBottom: spacing.base,
  },
  specSectionLabel: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 1,
    marginBottom: spacing.xxs,
  },
  specCard: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.surfaceGrade,
    padding: spacing.base,
  },
  specBodyText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
  },
  specEmptyCard: {
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderStyle: 'dashed',
    padding: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  specEmptyText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  overviewNavStrip: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.base,
  },
  overviewNavCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    padding: spacing.sm,
  },
  overviewNavLabel: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  overviewNavCount: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: colors.ink,
  },
  overviewNavHint: {
    ...typography.captionCap,
    fontSize: 8,
    color: colors.ink,
    fontWeight: '700',
    marginTop: 4,
  },
  thoughtActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    gap: 6,
    flexWrap: 'wrap',
  },
  thoughtActionBtn: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  thoughtActionBtnText: {
    ...typography.captionCap,
    fontSize: 8,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  newChatCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.ink,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  newChatTitle: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  newChatDesc: {
    ...typography.captionSm,
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  chatItemCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  chatItemActiveCard: {
    borderColor: colors.ink,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceGrade,
  },
  chatItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatItemTitle: {
    ...typography.bodyMd,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  chatItemSub: {
    ...typography.captionSm,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  dangerZoneCard: {
    borderWidth: 1.5,
    borderColor: '#E53935',
    backgroundColor: 'rgba(229, 57, 53, 0.05)',
    padding: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.base,
  },
  dangerZoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dangerHeading: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    color: '#E53935',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dangerText: {
    ...typography.captionSm,
    fontSize: 11,
    color: '#D32F2F',
    lineHeight: 16,
  },
  dangerButton: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
    borderWidth: 1,
    height: 32,
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  exportOptionCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  exportOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportOptionTitle: {
    ...typography.bodyMd,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  exportOptionDesc: {
    ...typography.captionSm,
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 16,
    marginTop: 2,
  },
  previewToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    alignItems: 'center',
  },
  previewToggleText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  rawMarkdownCard: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    maxHeight: 280,
  },
  rawMarkdownText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: colors.ink,
    lineHeight: 16,
  },
});
