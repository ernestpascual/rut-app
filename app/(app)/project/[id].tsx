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
  KeyboardAvoidingView,
  TextInput,
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
import { isPlatformTag } from '../../../src/design/platformColors';
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
  getOrGenerateThoughtSummary,
  AVAILABLE_MODELS,
  DEFAULT_AI_MODEL,
  getUserPreferredModel,
  setUserPreferredModel,
} from '../../../src/features/chat/chatService';
import { openExternalUrl } from '../../../src/utils/linking';
import {
  copyIdeaAsMarkdown,
  downloadIdeaAsMarkdown,
  exportIdeaAsPDF,
  exportIdeaAsDoc,
  generateIdeaContextMarkdown,
  ExportIdeaOptions,
  ThoughtExportItem,
} from '../../../src/features/ideas/ideaExporter';
import { calculateDynamicInputHeight } from '../../../src/utils/inputHeight';

function getShortModelName(model: string): string {
  if (!model) return 'AI';
  const clean = model.replace('gemini-', '');
  if (clean.includes('flash-thinking')) return 'THINKING';
  if (clean.includes('flash-lite')) return '3.5 LITE';
  if (clean.includes('2.5-pro')) return '2.5 PRO';
  if (clean.includes('2.5-flash')) return '2.5 FLASH';
  return clean.slice(0, 10).toUpperCase();
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isDummy = !user || user.uid === DUMMY_USER_UID;

  const [project, setProject] = useState<Project | null>(null);
  const [links, setLinks] = useState<ProjectInspirationLink[]>([]);
  const [attachingIds, setAttachingIds] = useState<Set<string>>(new Set());

  // Guaranteed deduplicated list of attached inspiration links
  const uniqueLinks = useMemo(() => {
    const seen = new Set<string>();
    return links.filter((l) => {
      const inspId = l.inspirationId || l.id;
      if (!inspId || seen.has(inspId)) return false;
      seen.add(inspId);
      return true;
    });
  }, [links]);

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
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Multi-selection state for attached references
  const [selectRefsMode, setSelectRefsMode] = useState(false);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [deletingRefs, setDeletingRefs] = useState(false);

  // Train of Thought Chat state
  const [ideaChat, setIdeaChat] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [thoughtSummary, setThoughtSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
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
  const [downloadingMarkdown, setDownloadingMarkdown] = useState(false);
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
          router.replace('/(app)/(tabs)/ideas');
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
              router.replace('/(app)/(tabs)/ideas');
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
          const seen = new Set<string>();
          const duplicateDocIdsToDelete: string[] = [];

          snap.forEach((d) => {
            const data = { id: d.id, ...(d.data() as any) } as ProjectInspirationLink;
            const inspId = data.inspirationId || d.id;
            if (!seen.has(inspId)) {
              seen.add(inspId);
              fetched.push({ ...data, id: inspId, inspirationId: inspId });
            } else {
              duplicateDocIdsToDelete.push(d.id);
            }
          });
          setLinks(fetched);

          // Asynchronously purge any legacy duplicate docs in the background
          if (duplicateDocIdsToDelete.length > 0 && user) {
            duplicateDocIdsToDelete.forEach((docId) => {
              deleteDoc(doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', docId)).catch(() => {});
            });
          }
        },
        async () => {
          const localLinks = await getProjectLinks(id);
          const seen = new Set<string>();
          setLinks(
            localLinks.filter((l) => {
              const inspId = l.inspirationId || l.id;
              if (seen.has(inspId)) return false;
              seen.add(inspId);
              return true;
            })
          );
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
            const mapped: IdeaMatchResult[] = res.data.suggestions.slice(0, 10).map((s) => ({
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
      const attachedSet = new Set(uniqueLinks.map((l) => l.inspirationId || l.id));
      const localMatches = matchIdeaWithDump(
        {
          title: project.title,
          brief: project.brief,
          notes: project.notes,
          tags: project.tags,
        },
        allDumpItems,
        attachedSet,
        10
      );

      setMatchedResults(localMatches.slice(0, 10));
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
    if (!id || !inspirationId) return;

    // Guard against simultaneous or repeated clicks
    if (attachingIds.has(inspirationId)) return;
    if (uniqueLinks.some((l) => (l.inspirationId || l.id) === inspirationId)) {
      setMatchedResults((prev) => prev.filter((r) => r.inspirationId !== inspirationId));
      return;
    }

    setAttachingIds((prev) => new Set(prev).add(inspirationId));

    // Immediately remove from matched results so UI doesn't allow double clicks
    setMatchedResults((prev) => prev.filter((r) => r.inspirationId !== inspirationId));

    try {
      const newLink = await attachInspirationToProject(
        id,
        inspirationId,
        confidence ? 'ai' : 'user',
        reason,
        confidence,
        user?.uid
      );

      setLinks((prev) => {
        if (prev.some((l) => (l.inspirationId || l.id) === inspirationId)) return prev;
        return [newLink, ...prev];
      });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to attach reference.');
    } finally {
      setAttachingIds((prev) => {
        const next = new Set(prev);
        next.delete(inspirationId);
        return next;
      });
    }
  };

  // Attach all top matched inspirations
  const handleAttachAllMatches = async () => {
    if (matchedResults.length === 0) return;
    const toAttach = [...matchedResults];
    setMatchedResults([]);
    for (const match of toAttach) {
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

  const toggleSelectRef = (inspirationId: string) => {
    setSelectedRefIds((prev) =>
      prev.includes(inspirationId)
        ? prev.filter((i) => i !== inspirationId)
        : [...prev, inspirationId]
    );
  };

  const handleToggleSelectAllRef = () => {
    if (selectedRefIds.length === uniqueLinks.length) {
      setSelectedRefIds([]);
    } else {
      setSelectedRefIds(uniqueLinks.map((l) => l.inspirationId || l.id));
    }
  };

  const handleDeleteSelectedReferences = async () => {
    if (!id || selectedRefIds.length === 0) return;
    const count = selectedRefIds.length;

    const performDelete = async () => {
      setDeletingRefs(true);
      try {
        for (const refId of selectedRefIds) {
          await detachInspirationFromProject(id, refId);
          if (user) {
            try {
              await deleteDoc(
                doc(db, 'users', user.uid, 'projects', id, 'inspirationLinks', refId)
              );
            } catch {}
          }
        }
        setLinks((prev) => prev.filter((l) => !selectedRefIds.includes(l.inspirationId)));
        setSelectedRefIds([]);
        setSelectRefsMode(false);
      } catch (err) {
        Alert.alert('Error', 'Failed to remove references.');
      } finally {
        setDeletingRefs(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(
        `Delete Selected References?\n\nAre you sure you want to remove ${count} ${count === 1 ? 'reference' : 'references'} from this idea?`
      );
      if (confirmed) {
        await performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Selected References',
      `Are you sure you want to remove ${count} ${count === 1 ? 'reference' : 'references'} from this idea?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
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

    const attachedItems = uniqueLinks
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
  }, [project?.id, project?.title, uniqueLinks.length, user?.uid]);

  // Load and cache 2-sentence summary of the train of thought
  useEffect(() => {
    let isMounted = true;
    if (!ideaChat || chatMessages.length === 0) {
      setThoughtSummary('');
      return;
    }

    const lastMsg = chatMessages[chatMessages.length - 1];

    // If chat already has a cached summary and the last message matches, do not reprocess!
    if (
      ideaChat.thoughtSummary &&
      ideaChat.summaryLastMessageId === lastMsg.id &&
      ideaChat.thoughtSummary.trim().length > 0
    ) {
      setThoughtSummary(ideaChat.thoughtSummary);
      return;
    }

    setLoadingSummary(true);
    getOrGenerateThoughtSummary(ideaChat.id, chatMessages, ideaChat, user?.uid)
      .then((summary) => {
        if (isMounted && summary) {
          setThoughtSummary(summary);
          setIdeaChat((prev) => (prev ? {
            ...prev,
            thoughtSummary: summary,
            summaryLastMessageId: lastMsg.id,
            summaryUpdatedAt: Date.now(),
          } : prev));
        }
      })
      .catch((err) => {
        console.warn('Failed to summarize thought chat:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingSummary(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ideaChat?.id, chatMessages, user?.uid]);

  // Force re-sync of thought summary
  const handleRefreshSummary = async () => {
    if (!ideaChat || chatMessages.length === 0) return;
    setLoadingSummary(true);
    try {
      const lastMsg = chatMessages[chatMessages.length - 1];
      const chatWithoutCache = { ...ideaChat, summaryLastMessageId: null, thoughtSummary: null };
      const summary = await getOrGenerateThoughtSummary(ideaChat.id, chatMessages, chatWithoutCache, user?.uid);
      setThoughtSummary(summary);
      setIdeaChat((prev) => (prev ? {
        ...prev,
        thoughtSummary: summary,
        summaryLastMessageId: lastMsg.id,
        summaryUpdatedAt: Date.now(),
      } : prev));
      setToastMessage('THOUGHT SUMMARY RE-SYNCED');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.warn('Failed to refresh thought summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Open the full dedicated chat interface for this thought / idea
  const handleOpenFullChat = async () => {
    if (ideaChat) {
      router.push(`/(app)/thought/${ideaChat.id}`);
      return;
    }
    if (!project) return;
    try {
      const attachedItems = uniqueLinks
        .map((l) => bankMap[l.inspirationId])
        .filter(Boolean) as InspirationItem[];
      const chat = await getOrCreateIdeaChat(project, attachedItems, user?.uid);
      setIdeaChat(chat);
      router.push(`/(app)/thought/${chat.id}`);
    } catch {
      // Fallback
      router.push('/(app)/(tabs)/thoughts');
    }
  };

  // Send a thought or query in the idea's train of thought
  const handleSendThought = async (customPrompt?: string) => {
    const promptToSend = (customPrompt !== undefined ? customPrompt : chatInputText).trim();
    if (!promptToSend || !ideaChat || sendingThought || !project) return;

    setChatInputText('');
    setSendingThought(true);

    try {
      const attachedItems = uniqueLinks
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
        `"${selectedChat.title}" is now the active Thought for this idea.`
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
      const attachedItems = uniqueLinks
        .map((l) => bankMap[l.inspirationId])
        .filter(Boolean) as InspirationItem[];

      const newSession = await createChatSession(`${project.title} — Thought`, {
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
        'New Thought Created',
        'A fresh dedicated thought stream has been linked to this idea.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create chat.');
    } finally {
      setLinkingChatId(null);
    }
  };

  // Export handlers
  const getExportOptions = (): ExportIdeaOptions => {
    const list: ThoughtExportItem[] = [];
    const seen = new Set<string>();

    if (ideaChat) {
      const citedIds = Array.from(
        new Set(
          chatMessages
            .flatMap((m) => m.sourceInspirationIds || [])
            .concat(ideaChat.pinnedInspirationIds || [])
        )
      ).filter(Boolean);

      list.push({
        id: ideaChat.id,
        title: ideaChat.title || `${project?.title || 'Idea'} — Train of Thought`,
        summary: thoughtSummary || ideaChat.thoughtSummary || ideaChat.summary || null,
        model: ideaChat.model || null,
        messageCount: chatMessages.length || ideaChat.summaryMessageCount || 0,
        updatedAt: ideaChat.updatedAt,
        citedInspirationIds: citedIds,
        messages: chatMessages,
      });
      seen.add(ideaChat.id);
    }

    availableChats.forEach((c) => {
      if (!seen.has(c.id) && project && (c.projectId === project.id || c.id === project.chatId)) {
        list.push({
          id: c.id,
          title: c.title,
          summary: c.thoughtSummary || c.summary || null,
          model: c.model || null,
          messageCount: c.summaryMessageCount || 0,
          updatedAt: c.updatedAt,
          citedInspirationIds: c.pinnedInspirationIds || [],
        });
        seen.add(c.id);
      }
    });

    return {
      thoughtSummary,
      allThoughts: list,
    };
  };

  const handleCopyMarkdown = async () => {
    if (!project) return;
    const exportOpts = getExportOptions();
    const success = await copyIdeaAsMarkdown(
      project,
      uniqueLinks,
      bankMap,
      ideaChat,
      chatMessages,
      exportOpts
    );
    if (success) {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
      Alert.alert('Copied to Clipboard', 'Full idea context markdown has been copied to your clipboard.');
    } else {
      Alert.alert('Notice', 'Unable to copy to clipboard automatically.');
    }
  };

  const handleDownloadMarkdown = async () => {
    if (!project) return;
    setDownloadingMarkdown(true);
    try {
      const exportOpts = getExportOptions();
      const success = await downloadIdeaAsMarkdown(
        project,
        uniqueLinks,
        bankMap,
        ideaChat,
        chatMessages,
        exportOpts
      );
      if (!success) {
        Alert.alert('Notice', 'Unable to download Markdown file directly.');
      }
    } finally {
      setDownloadingMarkdown(false);
    }
  };

  const handleExportPDF = async () => {
    if (!project) return;
    setExportingPDF(true);
    try {
      const exportOpts = getExportOptions();
      await exportIdeaAsPDF(
        project,
        uniqueLinks,
        bankMap,
        ideaChat,
        chatMessages,
        exportOpts
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
      const exportOpts = getExportOptions();
      await exportIdeaAsDoc(
        project,
        uniqueLinks,
        bankMap,
        ideaChat,
        chatMessages,
        exportOpts
      );
    } catch (e: any) {
      Alert.alert('Document Export Notice', e.message || 'Could not export as Document.');
    } finally {
      setExportingDoc(false);
    }
  };

  const unattachedDumpItems = useMemo(() => {
    const attachedIds = new Set(uniqueLinks.map((l) => l.inspirationId || l.id));
    return allDumpItems.filter((item) => !item.archived && !attachedIds.has(item.id));
  }, [allDumpItems, uniqueLinks]);

  const filteredDumpItems = useMemo(() => {
    const q = pickerSearchQuery.trim().toLowerCase();
    if (!q) return unattachedDumpItems;
    return unattachedDumpItems.filter((item) => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchPlatform = (item.sourcePlatform || '').toLowerCase().includes(q);
      const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchAiTags = (item.aiTags || []).some((t) => t.toLowerCase().includes(q));
      const matchConcepts = (item.concepts || []).some((c) => c.toLowerCase().includes(q));
      const matchNote = (item.userNote || '').toLowerCase().includes(q);
      const matchSummary = (item.aiSummary || '').toLowerCase().includes(q);
      const matchContext = (item.editorialContext || '').toLowerCase().includes(q);
      const matchUrl = (item.url || '').toLowerCase().includes(q);
      return (
        matchTitle ||
        matchPlatform ||
        matchTags ||
        matchAiTags ||
        matchConcepts ||
        matchNote ||
        matchSummary ||
        matchContext ||
        matchUrl
      );
    });
  }, [unattachedDumpItems, pickerSearchQuery]);

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
              router.replace('/(app)/(tabs)/ideas');
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

  // FULL HEIGHT EDIT SCREEN FOR EXTENSIVE NOTES & SPECIFICATIONS
  if (editing) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title="rut"
          subtitle="Edit Idea"
          onBack={() => setEditing(false)}
          backTitle="CANCEL"
          rightAction={
            <Button
              title={saving ? 'SAVING...' : 'SAVE IDEA'}
              onPress={handleSaveEdits}
              loading={saving}
              style={{ height: 28, paddingHorizontal: 12 }}
            />
          }
        />

        {toastMessage ? (
          <View style={styles.toastBanner}>
            <Text style={styles.toastText}>✓ {toastMessage}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.editFullContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.editHeaderRow}>
              <Text style={styles.editHeading}>WRITE / REFINE SPECIFICATIONS</Text>
            </View>

            <View>
              <Input
                label="IDEA TITLE"
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Idea title..."
              />
              <Text style={styles.charCountText}>
                {editTitle.length.toLocaleString()} CHARACTERS
              </Text>
            </View>

            <View>
              <Input
                label="CONCEPT / BRIEF"
                value={editBrief}
                onChangeText={setEditBrief}
                placeholder="Describe your creative concept, problem, or vision..."
                multiline
                numberOfLines={3}
                style={styles.briefInput}
              />
              <Text style={styles.charCountText}>
                {editBrief.length.toLocaleString()} CHARACTERS
              </Text>
            </View>

            <View style={styles.notesSectionContainer}>
              <Input
                label="NOTES & SPECIFICATIONS"
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Detailed specifications, dimensions, textures, color systems, fabrication notes, references, and train of thought summaries..."
                multiline
                numberOfLines={3}
                containerStyle={styles.notesInputContainer}
                style={styles.notesInput}
              />
              <Text style={styles.charCountText}>
                {editNotes.length.toLocaleString()} CHARACTERS
              </Text>
            </View>

            <View style={styles.tagInputRow}>
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

            {editTags.length > 0 && (
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
            )}

            <View style={styles.editBottomBar}>
              <Button
                title="CANCEL"
                variant="secondary"
                onPress={() => setEditing(false)}
                style={{ flex: 1, height: 44 }}
              />
              <Button
                title={saving ? 'SAVING...' : 'SAVE IDEA'}
                onPress={handleSaveEdits}
                loading={saving}
                style={{ flex: 2, height: 44 }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title=""
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/ideas');
          }
        }}
        backTitle="IDEAS"
        rightAction={
          <Button
            title="EXPORT ▾"
            variant="secondary"
            onPress={() => {
              setShowExportModal(true);
              if (availableChats.length === 0) {
                getChatSessions(user?.uid)
                  .then((sessions) => setAvailableChats(sessions.filter((s) => !s.archived)))
                  .catch(() => {});
              }
            }}
            style={styles.exportTopNavBtn}
            textStyle={styles.exportTopNavText}
          />
        }
      />

      {toastMessage ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>✓ {toastMessage}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
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
                accessibilityLabel="Inspirations tab"
              >
                <Text style={[styles.studioTabLabel, activeTab === 'references' && styles.studioTabLabelActive]}>
                  INSPIRATIONS
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
                    <Text style={styles.charCountText}>
                      {(project.brief || '').length.toLocaleString()} CHARACTERS
                    </Text>
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
                    <Text style={styles.charCountText}>
                      {(project.notes || '').length.toLocaleString()} CHARACTERS
                    </Text>
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
                    <Text style={styles.overviewNavLabel}>INSPIRATIONS</Text>
                    <Text style={styles.overviewNavCount}>{uniqueLinks.length} Linked</Text>
                    <Text style={styles.overviewNavHint}>OPEN GALLERY →</Text>
                  </Pressable>

                  <Pressable
                    style={styles.overviewNavCard}
                    onPress={() => setActiveTab('thoughts')}
                  >
                    <Text style={styles.overviewNavLabel}>THOUGHTS</Text>
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
                {/* REFERENCES TOOLBAR: 2 EQUAL 1/2 WIDTH BUTTONS */}
                <View style={styles.referencesToolbar}>
                  <Button
                    title={loadingSuggestions ? 'SCANNING...' : 'SCAN DUMP'}
                    variant="secondary"
                    onPress={handleGetInspirationsFromDump}
                    loading={loadingSuggestions}
                    style={styles.referencesHalfBtn}
                  />
                  <Button
                    title={showManualPicker ? 'HIDE PICKER' : '+ BROWSE DUMP'}
                    variant="secondary"
                    onPress={() => setShowManualPicker(!showManualPicker)}
                    style={styles.referencesHalfBtn}
                  />
                </View>

                {/* MANUAL DUMP PICKER */}
                {showManualPicker ? (
                  <Card style={styles.pickerCard}>
                    <View style={styles.pickerHeaderRow}>
                      <Text style={styles.pickerTitle}>
                        BROWSE INSPIRATION DUMP ({filteredDumpItems.length} OF {unattachedDumpItems.length})
                      </Text>
                      {unattachedDumpItems.length > 0 && (
                        <View style={styles.pickerSearchRow}>
                          <TextInput
                            style={styles.pickerSearchInput}
                            placeholder="Search dump by title, tag, platform, or note..."
                            placeholderTextColor={colors.inkSoft}
                            value={pickerSearchQuery}
                            onChangeText={setPickerSearchQuery}
                          />
                          {pickerSearchQuery.length > 0 && (
                            <Pressable
                              onPress={() => setPickerSearchQuery('')}
                              style={styles.pickerSearchClearBtn}
                              hitSlop={8}
                            >
                              <Text style={styles.pickerSearchClearText}>✕</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>

                    {unattachedDumpItems.length === 0 ? (
                      <Text style={styles.emptyLinksText}>All dump items are already attached!</Text>
                    ) : filteredDumpItems.length === 0 ? (
                      <View style={styles.pickerEmptySearchBox}>
                        <Text style={styles.pickerEmptySearchText}>
                          No dump items matching &ldquo;{pickerSearchQuery}&rdquo;
                        </Text>
                        <Button
                          title="CLEAR SEARCH"
                          variant="text"
                          onPress={() => setPickerSearchQuery('')}
                          style={{ height: 28, marginTop: spacing.xs }}
                        />
                      </View>
                    ) : (
                      filteredDumpItems.map((item) => (
                        <View key={item.id} style={styles.pickerItemCard}>
                          <View style={styles.pickerItemMainRow}>
                            {/* Thumbnail Image */}
                            {item.remotePreviewImageUrl ? (
                              <Image
                                source={{ uri: item.remotePreviewImageUrl }}
                                style={styles.pickerThumb}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.pickerThumbPlaceholder}>
                                <Text style={styles.pickerThumbPlaceholderText}>
                                  {(item.sourcePlatform || 'DUMP').slice(0, 3).toUpperCase()}
                                </Text>
                              </View>
                            )}

                            {/* Metadata Column */}
                            <View style={styles.pickerItemMetaCol}>
                              <View style={styles.pickerBadgeRow}>
                                {item.sourcePlatform ? (
                                  <Badge
                                    label={item.sourcePlatform.toUpperCase()}
                                    variant="inverse"
                                    style={{ marginRight: 6 }}
                                  />
                                ) : null}
                                {item.folder ? (
                                  <Badge
                                    label={item.folder.toUpperCase()}
                                    variant="grade"
                                    style={{ marginRight: 6 }}
                                  />
                                ) : null}
                                {item.createdAt ? (
                                  <Text style={styles.pickerDateText}>
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </Text>
                                ) : null}
                              </View>

                              <Text style={styles.pickerItemTitle} numberOfLines={2}>
                                {item.title}
                              </Text>

                              {/* Snippet / Context */}
                              {item.editorialContext ? (
                                <Text style={styles.pickerItemSnippet} numberOfLines={2}>
                                  {item.editorialContext}
                                </Text>
                              ) : item.aiSummary ? (
                                <Text style={styles.pickerItemSnippet} numberOfLines={2}>
                                  {item.aiSummary}
                                </Text>
                              ) : item.userNote ? (
                                <Text style={styles.pickerItemSnippet} numberOfLines={2}>
                                  {item.userNote}
                                </Text>
                              ) : null}

                              {/* Tags */}
                              {item.tags && item.tags.length > 0 ? (
                                <View style={styles.pickerTagRow}>
                                  {Array.from(new Set(item.tags)).slice(0, 5).map((t, idx) => (
                                    <Badge
                                      key={`picker-tag-${item.id}-${t}-${idx}`}
                                      label={`#${t}`}
                                      variant="grade"
                                      style={{ marginRight: 4, marginTop: 4 }}
                                    />
                                  ))}
                                </View>
                              ) : null}

                              {/* URL Link */}
                              {item.url ? (
                                <Pressable onPress={() => openExternalUrl(item.url!)} style={{ marginTop: 4 }} accessibilityRole="link">
                                  <Text style={styles.pickerUrlText} numberOfLines={1}>
                                    ↗ {item.url}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>

                          {/* Attach Action Button */}
                          <View style={styles.pickerActionRow}>
                            <Button
                              title="ATTACH"
                              variant="secondary"
                              onPress={() => handleAttachReference(item.id, 'Manually attached reference')}
                              style={styles.compactActionBtn}
                              textStyle={styles.compactActionBtnText}
                            />
                          </View>
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
                        title="ATTACH ALL"
                        variant="primary"
                        onPress={handleAttachAllMatches}
                        style={styles.compactActionBtn}
                        textStyle={styles.compactActionBtnText}
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
                            <Pressable onPress={() => openExternalUrl(item.url!)} accessibilityRole="link">
                              <Text style={styles.urlLink} numberOfLines={1}>
                                ↗ {item.url}
                              </Text>
                            </Pressable>
                          ) : null}

                          <View style={styles.matchedButtonRow}>
                            <Button
                              title="ATTACH"
                              variant="primary"
                              onPress={() =>
                                handleAttachReference(
                                  result.inspirationId,
                                  result.reason,
                                  result.confidence
                                )
                              }
                              style={styles.compactActionBtn}
                              textStyle={styles.compactActionBtnText}
                            />
                            <Button
                              title="DISMISS"
                              variant="text"
                              onPress={() =>
                                setMatchedResults((prev) =>
                                  prev.filter((r) => r.inspirationId !== result.inspirationId)
                                )
                              }
                              style={styles.dismissBtn}
                              textStyle={styles.dismissBtnText}
                            />
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}

                {/* ATTACHED INSPIRATIONS SECTION HEADER & BATCH ACTIONS */}
                <View style={styles.refSectionHeaderRow}>
                  <Text style={styles.sectionHeading}>
                    INSPIRATIONS ({uniqueLinks.length})
                  </Text>
                  {uniqueLinks.length > 0 && !selectRefsMode && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Button
                        title="SELECT MANY"
                        variant="secondary"
                        onPress={() => setSelectRefsMode(true)}
                        style={{ height: 28, paddingHorizontal: 10 }}
                      />
                      <Button
                        title="SELECT ALL"
                        variant="secondary"
                        onPress={() => {
                          setSelectRefsMode(true);
                          setSelectedRefIds(uniqueLinks.map((l) => l.inspirationId || l.id));
                        }}
                        style={{ height: 28, paddingHorizontal: 10 }}
                      />
                    </View>
                  )}
                </View>

                {/* MULTI-SELECT BAR FOR REFERENCES */}
                {selectRefsMode && uniqueLinks.length > 0 && (
                  <View style={styles.refSelectionBar}>
                    <Text style={styles.refSelectionCount}>
                      {selectedRefIds.length} OF {uniqueLinks.length} SELECTED
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                      <Button
                        title={selectedRefIds.length === uniqueLinks.length ? 'DESELECT ALL' : 'SELECT ALL'}
                        variant="secondary"
                        onPress={handleToggleSelectAllRef}
                        style={{ height: 32, paddingHorizontal: 10 }}
                      />
                      <Button
                        title={deletingRefs ? 'DELETING...' : `DELETE (${selectedRefIds.length})`}
                        onPress={handleDeleteSelectedReferences}
                        disabled={selectedRefIds.length === 0 || deletingRefs}
                        style={{
                          height: 32,
                          paddingHorizontal: 12,
                          backgroundColor: colors.statusErrorText || '#E03131',
                          borderWidth: 0,
                          opacity: selectedRefIds.length === 0 ? 0.4 : 1,
                        }}
                      />
                      <Button
                        title="CANCEL"
                        variant="text"
                        onPress={() => {
                          setSelectRefsMode(false);
                          setSelectedRefIds([]);
                        }}
                        style={{ height: 32, paddingHorizontal: 8 }}
                      />
                    </View>
                  </View>
                )}

                {/* ATTACHED INSPIRATIONS LIST */}
                {uniqueLinks.length === 0 ? (
                  <Card style={styles.emptyLinksCard}>
                    <Text style={styles.emptyLinksTitle}>NO INSPIRATIONS ATTACHED YET</Text>
                    <Text style={styles.emptyLinksText}>
                      Tap &ldquo;⚡ SCAN DUMP&rdquo; above to automatically match inspirations from your saved items, or &ldquo;+ BROWSE DUMP&rdquo; to attach manually.
                    </Text>
                  </Card>
                ) : (
                  uniqueLinks.map((link) => {
                    const item = bankMap[link.inspirationId];
                    const isSelected = selectedRefIds.includes(link.inspirationId);
                    return (
                      <Card
                        key={link.inspirationId || link.id}
                        onPress={selectRefsMode ? () => toggleSelectRef(link.inspirationId) : undefined}
                        style={[styles.linkCard, selectRefsMode && isSelected && styles.linkCardSelected]}
                      >
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
                                {Array.from(new Set(item.tags))
                                  .filter((t) => !isPlatformTag(t, item?.sourcePlatform))
                                  .slice(0, 4)
                                  .map((t, idx) => (
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

                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
                            {item?.remotePreviewImageUrl ? (
                              <Image
                                source={{ uri: item.remotePreviewImageUrl }}
                                style={styles.attachedThumb}
                                resizeMode="cover"
                              />
                            ) : null}
                            {selectRefsMode && (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  toggleSelectRef(link.inspirationId);
                                }}
                                hitSlop={8}
                                style={[
                                  styles.selectCheckbox,
                                  isSelected && styles.selectCheckboxActive,
                                ]}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isSelected }}
                                accessibilityLabel={isSelected ? 'Deselect reference' : 'Select reference'}
                              >
                                {isSelected && <Text style={styles.selectCheckboxCheck}>✓</Text>}
                              </Pressable>
                            )}
                          </View>
                        </View>

                        {item?.url ? (
                          <Pressable onPress={() => openExternalUrl(item.url!)} accessibilityRole="link">
                            <Text style={styles.urlLink} numberOfLines={1}>
                              ↗ {item.url}
                            </Text>
                          </Pressable>
                        ) : null}

                        {!selectRefsMode && (
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
                              title="✕ DELETE"
                              variant="text"
                              onPress={() => handleDetachReference(link.inspirationId)}
                              style={{ height: 28, paddingHorizontal: 4 }}
                            />
                          </View>
                        )}
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
                      {getShortModelName(selectedModel)} ▾
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
                    <View style={{ flex: 1, marginRight: spacing.xs }}>
                      <Text style={styles.thoughtBannerLabel}>THOUGHT SUMMARY</Text>
                      <Text style={styles.thoughtBannerText} numberOfLines={1} ellipsizeMode="tail">
                        &ldquo;{ideaChat?.title || project.title}&rdquo;
                      </Text>
                    </View>
                    <Button
                      title="OPEN CHAT →"
                      variant="primary"
                      onPress={handleOpenFullChat}
                      style={styles.thoughtBannerBtn}
                      textStyle={styles.thoughtBannerBtnText}
                    />
                  </View>

                  {loadingSummary ? (
                    <View style={styles.thinkingIndicator}>
                      <ActivityIndicator size="small" color={colors.ink} />
                      <Text style={styles.thinkingText} numberOfLines={2}>
                        SYNTHESIZING TRAIN OF THOUGHT ({getShortModelName(selectedModel)})...
                      </Text>
                    </View>
                  ) : chatMessages.length === 0 ? (
                    <Pressable
                      style={styles.emptyThoughtBox}
                      onPress={handleOpenFullChat}
                    >
                      <Text style={styles.emptyThoughtHeading}>START A THOUGHT</Text>
                      <Text style={styles.emptyThoughtText}>
                        Brainstorm angles, critique directions, or synthesize your saved inspirations using {getShortModelName(selectedModel)}. Tap to open full chat.
                      </Text>
                      <Button
                        title="OPEN CHAT"
                        variant="primary"
                        onPress={handleOpenFullChat}
                        style={{ marginTop: spacing.sm, alignSelf: 'center', height: 30, paddingHorizontal: 12 }}
                        textStyle={styles.thoughtActionBtnText}
                      />
                    </Pressable>
                  ) : (
                    <View style={styles.thoughtSummaryWrapper}>
                      <View style={styles.thoughtSummaryQuoteBox}>
                        <Text style={styles.thoughtSummaryQuoteText} selectable>
                          {thoughtSummary || 'Exploring creative angles and conceptual directions for this idea.'}
                        </Text>
                      </View>

                      <View style={styles.thoughtSummaryMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                          <Badge
                            label={`${chatMessages.length} MSGS`}
                            variant="grade"
                            style={{ paddingVertical: 1, paddingHorizontal: 5 }}
                          />
                          <Badge
                            label={getShortModelName(selectedModel)}
                            variant="outline"
                            style={{ paddingVertical: 1, paddingHorizontal: 5 }}
                          />
                          <Text style={styles.thoughtSummaryMetaNote} numberOfLines={1}>
                            {ideaChat?.summaryUpdatedAt
                              ? `Updated ${new Date(ideaChat.summaryUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Up to date'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={handleRefreshSummary}
                          hitSlop={8}
                          style={styles.thoughtSummaryRefreshBtn}
                        >
                          <Text style={styles.thoughtSummaryRefreshText}>↻ RE-SYNC</Text>
                        </Pressable>
                      </View>

                      {/* SUMMARY ACTIONS */}
                      <View style={styles.thoughtSummaryActionsRow}>
                        <Button
                          title="OPEN CHAT →"
                          variant="primary"
                          onPress={handleOpenFullChat}
                          style={styles.thoughtActionBtn}
                          textStyle={styles.thoughtActionBtnText}
                        />
                        <Button
                          title="+ TO NOTES"
                          variant="secondary"
                          onPress={() => handleAddThoughtToNotes(thoughtSummary)}
                          style={styles.thoughtActionBtn}
                          textStyle={styles.thoughtActionBtnText}
                        />
                        <Button
                          title="SET AS BRIEF"
                          variant="secondary"
                          onPress={() => handleSetThoughtAsBrief(thoughtSummary)}
                          style={styles.thoughtActionBtn}
                          textStyle={styles.thoughtActionBtnText}
                        />
                      </View>
                    </View>
                  )}
                </Card>
              </View>
            )}

            {/* LINK TRAIN OF THOUGHT MODAL */}
            <Modal visible={showLinkChatModal} animationType="slide" transparent>
              <SafeAreaView style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <TopNav
                    title="rut"
                    subtitle="Link Thought"
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
                      Attach any of your existing thoughts to &ldquo;{project.title}&rdquo;, or spin up a new dedicated stream.
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
                      YOUR EXISTING THOUGHTS ({availableChats.length})
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
                                    router.push(`/(app)/thought/${c.id}`);
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
                      Select the model used for Thought synthesis and inspiration retrieval. Your choice is saved as your default model preference.
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
                      Export &ldquo;{project.title}&rdquo; as comprehensive research context, including concept brief, specifications, attached dump references, and trains of thought summaries.
                    </Text>

                    {/* OPTION 1: COPY & DOWNLOAD MARKDOWN */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.exportOptionTitle}>📋 MARKDOWN FILE & CONTEXT</Text>
                            {copiedMarkdown && (
                              <Badge label="COPIED ✓" variant="inverse" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                          <Text style={styles.exportOptionDesc}>
                            Compiles complete structured Markdown context for AI prompts (Claude, ChatGPT, Gemini), Obsidian, or developer docs with trains of thought summaries.
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Button
                            title={copiedMarkdown ? 'COPIED ✓' : 'COPY ⎘'}
                            variant={copiedMarkdown ? 'primary' : 'secondary'}
                            onPress={handleCopyMarkdown}
                            style={styles.exportModalOptionBtn}
                            textStyle={styles.exportModalOptionBtnText}
                          />
                          <Button
                            title={downloadingMarkdown ? 'DOWNLOADING...' : 'DOWNLOAD .MD ⤓'}
                            variant="secondary"
                            onPress={handleDownloadMarkdown}
                            loading={downloadingMarkdown}
                            style={styles.exportModalOptionBtn}
                            textStyle={styles.exportModalOptionBtnText}
                          />
                        </View>
                      </View>
                    </Card>

                    {/* OPTION 2: EXPORT AS PDF */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={styles.exportOptionTitle}>📄 EXPORT AS PDF</Text>
                          <Text style={styles.exportOptionDesc}>
                            Generates an editorial print-ready PDF document with rendered markdown typography, metadata badges, visual citations, and thought summaries.
                          </Text>
                        </View>
                        <Button
                          title={exportingPDF ? 'GENERATING...' : 'PRINT / PDF ↗'}
                          variant="primary"
                          onPress={handleExportPDF}
                          loading={exportingPDF}
                          style={styles.exportModalOptionBtn}
                          textStyle={styles.exportModalOptionBtnText}
                        />
                      </View>
                    </Card>

                    {/* OPTION 3: EXPORT AS DOC */}
                    <Card style={styles.exportOptionCard}>
                      <View style={styles.exportOptionHeader}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={styles.exportOptionTitle}>📝 EXPORT AS DOC</Text>
                          <Text style={styles.exportOptionDesc}>
                            Downloads a Microsoft Word and Google Docs compatible (.doc) file with formatted typography and thought summaries.
                          </Text>
                        </View>
                        <Button
                          title={exportingDoc ? 'PREPARING...' : 'DOWNLOAD .DOC ⤓'}
                          variant="secondary"
                          onPress={handleExportDoc}
                          loading={exportingDoc}
                          style={styles.exportModalOptionBtn}
                          textStyle={styles.exportModalOptionBtnText}
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
                              chatMessages,
                              getExportOptions()
                            )}
                          </Text>
                        </Card>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </SafeAreaView>
            </Modal>
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
  editFullContent: {
    flexGrow: 1,
    padding: spacing.base,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  editHeaderRow: {
    marginBottom: spacing.xs,
  },
  editHeading: {
    ...typography.captionCap,
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 1,
  },
  briefInput: {
    minHeight: 84,
    maxHeight: 160,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
  notesSectionContainer: {
    marginVertical: spacing.xs,
  },
  notesInputContainer: {
    marginVertical: 0,
  },
  notesInput: {
    minHeight: 84,
    maxHeight: 160,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
  charCountText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  editBottomBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
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
  pickerHeaderRow: {
    marginBottom: spacing.sm,
  },
  pickerTitle: {
    ...typography.captionCap,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginTop: spacing.xs,
  },
  pickerSearchInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: colors.hairlineGrade,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    color: colors.ink,
    fontSize: 13,
  },
  pickerSearchClearBtn: {
    position: 'absolute',
    right: 8,
    padding: 6,
  },
  pickerSearchClearText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerEmptySearchBox: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmptySearchText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  pickerItemCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairlineGrade,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  pickerItemMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickerThumb: {
    width: 64,
    height: 64,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairlineGrade,
    marginRight: spacing.sm,
  },
  pickerThumbPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairlineGrade,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerThumbPlaceholderText: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.inkSoft,
  },
  pickerItemMetaCol: {
    flex: 1,
  },
  pickerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pickerDateText: {
    ...typography.captionSm,
    fontSize: 10,
    color: colors.inkSoft,
  },
  pickerItemTitle: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  pickerItemSnippet: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 16,
    marginBottom: 4,
  },
  pickerTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  pickerUrlText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  pickerActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
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
  linkCardSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.surfaceGrade,
  },
  refSelectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairlineGrade,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  refSelectionCount: {
    ...typography.captionCap,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  refSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  refSelectBarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  selectCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  selectCheckboxActive: {
    backgroundColor: colors.ink,
  },
  selectCheckboxCheck: {
    color: colors.onInk,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
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
    padding: spacing.sm,
    overflow: 'hidden',
  },
  thoughtBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  thoughtBannerLabel: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '800',
    color: colors.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  thoughtBannerText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    flex: 1,
  },
  thoughtBannerBtn: {
    height: 26,
    paddingHorizontal: 8,
  },
  thoughtBannerBtnText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  thoughtBannerAction: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '800',
    color: colors.ink,
    marginLeft: spacing.xs,
  },
  thoughtSummaryWrapper: {
    gap: spacing.xs,
  },
  thoughtSummaryQuoteBox: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
    padding: spacing.sm,
  },
  thoughtSummaryQuoteText: {
    ...typography.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  thoughtSummaryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  thoughtSummaryMetaNote: {
    ...typography.captionSm,
    fontSize: 10,
    color: colors.inkSoft,
  },
  thoughtSummaryRefreshBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  thoughtSummaryRefreshText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
  },
  thoughtSummaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  thoughtActionBtn: {
    flex: 1,
    minWidth: 88,
    height: 30,
    paddingHorizontal: 6,
  },
  thoughtActionBtnText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
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
  chatCitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 4,
  },
  chatCitationsTitle: {
    ...typography.captionCap,
    fontSize: 8,
    color: colors.inkSoft,
  },
  chatCitationsToggle: {
    ...typography.captionCap,
    fontSize: 8,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.5,
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
    flex: 1,
    flexShrink: 1,
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
    width: '100%',
    marginBottom: spacing.xs,
  },
  thoughtsEqualBtn: {
    flex: 1,
    height: 30,
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
    letterSpacing: 0.4,
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
    width: '100%',
  },
  studioTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  studioTabLabelActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  tabContent: {
    marginBottom: spacing.base,
  },
  referencesToolbar: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
    marginBottom: spacing.sm,
  },
  referencesHalfBtn: {
    flex: 1,
    height: 38,
    paddingHorizontal: 8,
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
  exportTopNavBtn: {
    height: 24,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportTopNavText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  exportModalOptionBtn: {
    height: 26,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModalOptionBtnText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  compactActionBtn: {
    height: 24,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactActionBtnText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  dismissBtn: {
    height: 24,
    paddingHorizontal: 8,
    marginLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 12,
    color: colors.inkSoft,
  },
});
