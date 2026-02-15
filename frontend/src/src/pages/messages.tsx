import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveApiUrl } from '@/lib/api';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  Briefcase, 
  CheckSquare,
  Check,
  X,
  Loader2,
  Search,
  User,
  Plus,
  Users,
  Clock,
  Hash,
  ExternalLink,
  ArrowRight,
  Pencil
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  senderId: number;
  recipientId: number | null;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  attachedJobId: number | null;
  attachedTaskId: number | null;
  attachedImageUrls: string[] | null;
  sender?: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
  };
}

interface Conversation {
  otherUser: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
    businessId?: number;
  };
  lastMessage: Message;
  unreadCount: number;
}

interface GroupConversation {
  thread: {
    id: number;
    name: string | null;
    createdBy: number;
    createdAt: string;
  };
  participants: User[];
  lastMessage: Message;
  unreadCount: number;
}

interface User {
  username?: string;
  id: number;
  fullName: string;
  avatarUrl: string | null;
  businessId?: number;
  role?: string;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserBusinessId, setSelectedUserBusinessId] = useState<number | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskSelectDialogOpen, setTaskSelectDialogOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false);
  const [jobSelectDialogOpen, setJobSelectDialogOpen] = useState(false);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [newMessageUserId, setNewMessageUserId] = useState<number | null>(null);
  const [newMessageJobId, setNewMessageJobId] = useState<number | null>(null);
  const [newMessageTab, setNewMessageTab] = useState<'people' | 'jobs'>('people');
  const [renameGroupDialogOpen, setRenameGroupDialogOpen] = useState(false);
  const [renameGroupName, setRenameGroupName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/messages/conversations'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery<GroupConversation[]>({
    queryKey: ['/api/messages/groups'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Debug logging for groups
  useEffect(() => {
    console.log('[Messages] Groups data:', groups);
    console.log('[Messages] Groups count:', groups.length);
    console.log('[Messages] Groups loading:', groupsLoading);
  }, [groups, groupsLoading]);

  // Fetch users for new message dialog (master gets all users for support chats)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: user?.role === 'master' ? ['/api/master/users'] : ['/api/users'],
  });
  const usersForNewMessage = (users ?? []).filter((u) => u.id !== user?.id && u.role !== 'master');

  // Support info for BoltDown support chat
  const { data: supportInfo } = useQuery<{ masterUser: { id: number; fullName: string; avatarUrl: string | null } | null }>({
    queryKey: ['/api/messages/support-info'],
  });

  // Auto-select BoltDown support when navigating with ?support=true
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('support') === 'true' && supportInfo?.masterUser && user?.role !== 'master') {
      setSelectedUserId(supportInfo.masterUser.id);
      setSelectedUserBusinessId(null);
      setSelectedThreadId(null);
      // Clear the param from URL for cleaner UX
      const url = new URL(window.location.href);
      url.searchParams.delete('support');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [supportInfo?.masterUser, user?.role]);

  // Fetch jobs for attachment
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });

  // Fetch tasks for attachment
  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
  });

  const isMaster = user?.role === 'master';

  // Fetch messages for selected conversation (direct or group)
  const { data: messages = [], isLoading: messagesLoading, error: messagesError, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: selectedThreadId 
      ? ['/api/messages/groups', selectedThreadId]
      : ['/api/messages/conversation', selectedUserId, isMaster ? selectedUserBusinessId : null],
    queryFn: async () => {
      if (selectedThreadId) {
        return apiRequest('GET', `/api/messages/groups/${selectedThreadId}`);
      }
      const url = `/api/messages/conversation/${selectedUserId}${isMaster && selectedUserBusinessId ? `?businessId=${selectedUserBusinessId}` : ''}`;
      return apiRequest('GET', url);
    },
    enabled: (!!selectedUserId || !!selectedThreadId) && (!isMaster || !selectedUserId || !!selectedUserBusinessId || !!selectedThreadId) && !(isMaster && selectedUserId && !selectedUserBusinessId && !selectedThreadId),
    refetchInterval: 10000,
  });

  // Debug logging
  useEffect(() => {
    if (selectedUserId) {
      console.log('[Messages] Selected user ID:', selectedUserId);
      console.log('[Messages] Current user ID:', user?.id);
      console.log('[Messages] Messages data:', messages);
      console.log('[Messages] Messages count:', messages.length);
      console.log('[Messages] Messages loading:', messagesLoading);
      console.log('[Messages] Messages error:', messagesError);
      console.log('[Messages] Query URL:', `/api/messages/conversation/${selectedUserId}`);
    }
  }, [selectedUserId, messages, messagesLoading, messagesError, user?.id]);

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv =>
    conv.otherUser.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter groups by search query
  const filteredGroups = groups.filter(group =>
    (group.thread.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    group.participants.some(p => p.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Mark conversation as read when viewing
  const markAsReadMutation = useMutation({
    mutationFn: ({ userId, businessId }: { userId: number; businessId?: number }) =>
      apiRequest('PUT', `/api/messages/conversation/${userId}/read${isMaster && businessId ? `?businessId=${businessId}` : ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversation', selectedUserId] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[Frontend] Sending message with data:', data);
      console.log('[Frontend] Full data object:', JSON.stringify(data, null, 2));
      try {
        // apiRequest signature: apiRequest(method, url, data) or apiRequest(url, { method, data })
        const response = await apiRequest('POST', '/api/messages', data);
        console.log('[Frontend] Message sent successfully:', response);
        return response;
      } catch (error: any) {
        console.error('[Frontend] Error sending message:', error);
        console.error('[Frontend] Error details:', {
          message: error.message,
          status: error.status,
          details: error.details,
          stack: error.stack,
        });
        throw error;
      }
    },
    onSuccess: async (response, variables) => {
      console.log('[Frontend] Message send success callback');
      setMessageContent('');
      setSelectedJobId(null);
      setSelectedTaskId(null);
      setSelectedImages([]);
      const recipientId = selectedUserId || newMessageUserId;
      
      // If starting a new conversation, select the user first
      if (newMessageUserId && !selectedUserId) {
        setSelectedUserId(newMessageUserId);
        setNewMessageDialogOpen(false);
        setNewMessageUserId(null);
      }
      
      // Invalidate queries (non-blocking - let them refetch in background)
      const threadId = selectedThreadId;
      if (recipientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/conversation', recipientId] });
      }
      if (threadId) {
        queryClient.invalidateQueries({ queryKey: ['/api/messages/groups', threadId] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/groups'] });
      
      // Don't show success toast - it's intrusive for every message
      // The message appearing in the conversation is feedback enough
    },
    onError: (error: any) => {
      console.error('[Frontend] Message send error in onError:', error);
      const errorMessage = error?.message || error?.response?.message || "There was an error sending your message.";
      toast({
        title: "Failed to send message",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Upload images mutation
  const uploadImagesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });
      const response = await fetch(resolveApiUrl('/api/messages/images'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to upload images');
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedImages(prev => [...prev, ...data.imageUrls]);
      setImageUploadDialogOpen(false);
      toast({
        title: "Images uploaded",
        description: `${data.imageUrls.length} image(s) uploaded successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle selecting a conversation
  useEffect(() => {
    if (selectedUserId) {
      markAsReadMutation.mutate({ userId: selectedUserId, businessId: selectedUserBusinessId ?? undefined });
    }
  }, [selectedUserId, selectedUserBusinessId]);

  // Mark group as read when viewing
  const markGroupAsReadMutation = useMutation({
    mutationFn: ({ threadId }: { threadId: number }) =>
      apiRequest('PUT', `/api/messages/groups/${threadId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/groups'] });
    },
  });

  useEffect(() => {
    if (selectedThreadId) {
      markGroupAsReadMutation.mutate({ threadId: selectedThreadId });
    }
  }, [selectedThreadId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    // Determine recipients - check for thread (group), direct user, or new group recipients
    const hasThread = !!selectedThreadId;
    const hasDirectUser = !!(selectedUserId || newMessageUserId);
    const hasNewGroupRecipients = selectedRecipients.length > 0;
    
    console.log('[Frontend] handleSendMessage called:', {
      selectedThreadId,
      selectedUserId,
      newMessageUserId,
      selectedRecipients,
      hasThread,
      hasDirectUser,
      hasNewGroupRecipients,
      messageContent: messageContent.trim(),
      selectedImages: selectedImages.length,
      selectedJobId,
      selectedTaskId,
    });
    
    // Check if we have a valid recipient (thread, direct user, or new group)
    if (!hasThread && !hasDirectUser && !hasNewGroupRecipients) {
      toast({
        title: "No recipient selected",
        description: "Please select at least one recipient or a group to send a message.",
        variant: "destructive",
      });
      return;
    }
    
    if (!messageContent.trim() && selectedImages.length === 0 && !selectedJobId && !selectedTaskId) {
      toast({
        title: "Message required",
        description: "Please enter a message or attach something.",
        variant: "destructive",
      });
      return;
    }

    // Build message data based on what's selected
    const messageData: any = {
      content: messageContent.trim() || '(No text message)',
      attachedJobId: selectedJobId || undefined,
      attachedTaskId: selectedTaskId || undefined,
      attachedImageUrls: selectedImages.length > 0 ? selectedImages : undefined,
    };

    // Set recipient based on selection type
    if (hasThread) {
      // Existing group - use threadId
      messageData.threadId = selectedThreadId;
    } else if (hasDirectUser) {
      // Direct message - use recipientId
      messageData.recipientId = selectedUserId || newMessageUserId;
    } else if (hasNewGroupRecipients) {
      // New group - use recipientIds (will create thread)
      if (selectedRecipients.length === 1) {
        // Single recipient = direct message
        messageData.recipientId = selectedRecipients[0];
      } else {
        // Multiple recipients = new group
        messageData.recipientIds = selectedRecipients;
      }
    }
    
    console.log('[Frontend] Calling sendMessageMutation with:', messageData);
    sendMessageMutation.mutate(messageData);
  };


  const handleStartNewMessage = (userId: number, businessId?: number) => {
    setNewMessageUserId(userId);
    setSelectedUserId(userId);
    setSelectedUserBusinessId(businessId ?? null);
    setSelectedRecipients([]);
    setSelectedThreadId(null);
    setNewMessageDialogOpen(false);
    // If a job was selected, it's already set in selectedJobId
    // Focus on message input after a brief delay
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder="Type your message..."]') as HTMLTextAreaElement;
      textarea?.focus();
    }, 100);
  };

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: (data: { name?: string; participantIds: number[] }) => 
      apiRequest('/api/messages/groups', { method: 'POST', data }),
    onSuccess: async (thread: any) => {
      console.log('Group created successfully:', thread);
      setSelectedThreadId(thread.id);
      setSelectedRecipients([]);
      setSelectedUserId(null);
      setIsGroupMode(false);
      setNewMessageDialogOpen(false);
      // Force refetch groups to get the new group with participants
      await queryClient.invalidateQueries({ queryKey: ['/api/messages/groups'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      await queryClient.refetchQueries({ queryKey: ['/api/messages/groups'] });
      toast({
        title: "Group created",
        description: "Group conversation started successfully",
      });
    },
    onError: (error: any) => {
      console.error('Create group error:', error);
      toast({
        title: "Failed to create group",
        description: error?.message || error?.response?.message || "There was an error creating the group.",
        variant: "destructive",
      });
    },
  });

  // Rename group mutation
  const renameGroupMutation = useMutation({
    mutationFn: ({ threadId, name }: { threadId: number; name: string }) =>
      apiRequest(`/api/messages/groups/${threadId}`, { method: 'PUT', data: { name } }),
    onSuccess: async () => {
      setRenameGroupDialogOpen(false);
      setRenameGroupName('');
      await queryClient.invalidateQueries({ queryKey: ['/api/messages/groups'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      toast({
        title: "Group renamed",
        description: "Group name updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Rename group error:', error);
      toast({
        title: "Failed to rename group",
        description: error?.message || error?.response?.message || "There was an error renaming the group.",
        variant: "destructive",
      });
    },
  });

  const handleCreateGroup = (participantIds: number[]) => {
    if (participantIds.length === 0) {
      toast({
        title: "No participants",
        description: "Please select at least one person to create a group.",
        variant: "destructive",
      });
      return;
    }
    createGroupMutation.mutate({ participantIds });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadImagesMutation.mutate(e.target.files);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedConversation = conversations.find(c => c.otherUser.id === selectedUserId);
  const isBoltDownSupport = supportInfo?.masterUser && selectedUserId === supportInfo.masterUser.id;
  const selectedUser = selectedUserId
    ? (users.find(u => u.id === selectedUserId) ?? selectedConversation?.otherUser ?? (isBoltDownSupport && supportInfo?.masterUser
        ? { id: supportInfo.masterUser.id, fullName: 'BoltDown support', avatarUrl: supportInfo.masterUser.avatarUrl }
        : null))
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Communicate with your team members</p>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Conversations List */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <CardTitle className="text-lg">Conversations</CardTitle>
              </div>
              <Dialog open={newMessageDialogOpen} onOpenChange={(open) => {
                setNewMessageDialogOpen(open);
                if (!open) {
                  setIsGroupMode(false);
                  setSelectedRecipients([]);
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Start New Conversation</DialogTitle>
                    <DialogDescription>
                      Message a team member or start a job discussion
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs value={newMessageTab} onValueChange={(v) => setNewMessageTab(v as 'people' | 'jobs')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="people" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        People
                      </TabsTrigger>
                      <TabsTrigger value="jobs" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Jobs
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="people" className="mt-4">
                      {selectedJobId && (() => {
                        const selectedJob = jobs.find(j => j.id === selectedJobId);
                        return selectedJob ? (
                          <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-primary truncate">{selectedJob.jobId}</p>
                                {selectedJob.description && (
                                  <p className="text-xs text-muted-foreground truncate">{selectedJob.description}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedJobId(null)}
                              className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null;
                      })()}
                      {/* Mode toggle */}
                      <div className="mb-3 flex items-center justify-between gap-2">
                        {!isGroupMode ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsGroupMode(true);
                              setSelectedRecipients([]);
                            }}
                            className="flex-1"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Create Group
                          </Button>
                        ) : (
                          <div className="flex-1 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIsGroupMode(false);
                                setSelectedRecipients([]);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            {selectedRecipients.length > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleCreateGroup(selectedRecipients)}
                                disabled={createGroupMutation.isPending}
                                className="flex-1"
                              >
                                {createGroupMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Users className="h-4 w-4 mr-2" />
                                    Create Group ({selectedRecipients.length})
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {isGroupMode && selectedRecipients.length > 0 && (
                        <div className="mb-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex flex-wrap gap-2">
                            {selectedRecipients.map(recipientId => {
                              const recipient = users.find(u => u.id === recipientId);
                              return recipient ? (
                                <Badge key={recipientId} variant="secondary" className="flex items-center gap-1.5">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(recipient.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{recipient.fullName}</span>
                                  <button
                                    onClick={() => setSelectedRecipients(prev => prev.filter(id => id !== recipientId))}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      <div className="relative mb-3">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search team members..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-1">
                          {usersForNewMessage
                            .filter(u => 
                              !userSearchQuery || 
                              u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase())
                            )
                            .map((userOption) => {
                              // Check if there's a recent conversation
                              const hasRecentConversation = conversations.some(
                                c => c.otherUser.id === userOption.id
                              );
                              const isSelected = selectedRecipients.includes(userOption.id);
                              return (
                      <button
                        key={userOption.id}
                                  onClick={() => {
                                    if (isGroupMode) {
                                      // Group mode: toggle selection
                                      if (isSelected) {
                                        setSelectedRecipients(prev => prev.filter(id => id !== userOption.id));
                                      } else {
                                        setSelectedRecipients(prev => [...prev, userOption.id]);
                                      }
                                    } else {
                                      // Direct message mode: start conversation immediately
                                      handleStartNewMessage(userOption.id, userOption.businessId);
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group",
                                    isSelected && "bg-primary/10 border border-primary/30"
                                  )}
                                >
                                  {/* Checkbox in group mode */}
                                  {isGroupMode && (
                                    <div className={cn(
                                      "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                      isSelected
                                        ? "bg-primary border-primary"
                                        : "border-muted-foreground/30"
                                    )}>
                                      {isSelected && (
                                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                      )}
                                    </div>
                                  )}
                                  <Avatar className={cn(
                                    "h-11 w-11 border-2 transition-colors flex-shrink-0",
                                    isSelected ? "border-primary" : "border-transparent group-hover:border-primary"
                                  )}>
                          <AvatarImage src={userOption.avatarUrl || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                      {getInitials(userOption.fullName)}
                                    </AvatarFallback>
                        </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{userOption.fullName}</p>
                                    {hasRecentConversation && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Recent conversation
                                      </p>
                                    )}
                        </div>
                                  {hasRecentConversation && !isSelected && (
                                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          {usersForNewMessage.filter(u =>
                            !userSearchQuery || u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase())
                          ).length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No team members found
                            </div>
                          )}
                        </div>
                      {selectedRecipients.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">
                              {selectedRecipients.length} {selectedRecipients.length === 1 ? 'person' : 'people'} selected
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Start group conversation
                                if (selectedRecipients.length > 0) {
                                  setSelectedRecipients([]);
                                  setNewMessageDialogOpen(false);
                                  // For now, we'll use the first recipient as selectedUserId
                                  // In a full implementation, we'd create a thread
                                  setSelectedUserId(selectedRecipients[0]);
                                  // Clear the selection
                                }
                              }}
                              disabled={selectedRecipients.length === 0}
                            >
                              Start Group
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedRecipients.map(recipientId => {
                              const recipient = users.find(u => u.id === recipientId);
                              return recipient ? (
                                <Badge key={recipientId} variant="secondary" className="flex items-center gap-1.5">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={recipient.avatarUrl || undefined} />
                                    <AvatarFallback className="text-[10px]">{getInitials(recipient.fullName)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{recipient.fullName}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRecipients(prev => prev.filter(id => id !== recipientId));
                                    }}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="jobs" className="mt-4">
                      <div className="relative mb-3">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search jobs by ID or description..."
                          value={jobSearchQuery}
                          onChange={(e) => setJobSearchQuery(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-1">
                          {jobs
                            .filter(job => 
                              !jobSearchQuery || 
                              job.jobId?.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
                              job.description?.toLowerCase().includes(jobSearchQuery.toLowerCase())
                            )
                            .slice(0, 50) // Limit to recent 50 jobs
                            .map((job) => (
                              <button
                                key={job.id}
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  // Switch to People tab to select who to message about this job
                                  setNewMessageTab('people');
                                  // Keep dialog open so user can select recipient
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group border border-transparent hover:border-primary/20"
                              >
                                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                                  <Briefcase className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-sm text-primary">{job.jobId}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {job.status?.replace(/_/g, ' ')}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {job.description || 'No description'}
                                  </p>
                                  {job.customerName && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Customer: {job.customerName}
                                    </p>
                                  )}
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    ))}
                          {jobs.filter(job => 
                            !jobSearchQuery || 
                            job.jobId?.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
                            job.description?.toLowerCase().includes(jobSearchQuery.toLowerCase())
                          ).length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No jobs found
                  </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {(conversationsLoading || groupsLoading) ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (filteredConversations.length === 0 && filteredGroups.length === 0) ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </div>
              ) : (
                <div className="divide-y">
                  {/* Direct Messages */}
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.otherUser.id}
                      onClick={() => {
                        setSelectedUserId(conv.otherUser.id);
                        setSelectedUserBusinessId(conv.otherUser.businessId ?? null);
                        setSelectedThreadId(null);
                      }}
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                        selectedUserId === conv.otherUser.id && !selectedThreadId && "bg-muted"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={conv.otherUser.avatarUrl || undefined} />
                          <AvatarFallback>{getInitials(conv.otherUser.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium truncate">{conv.otherUser.fullName}</p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                            {conv.lastMessage.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {/* Groups */}
                  {filteredGroups.map((group) => (
                    <button
                      key={group.thread.id}
                      onClick={() => {
                        setSelectedThreadId(group.thread.id);
                        setSelectedUserId(null);
                      }}
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                        selectedThreadId === group.thread.id && !selectedUserId && "bg-muted"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium truncate">
                              {group.thread.name || `${group.participants.length} members`}
                            </p>
                            {group.unreadCount > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {group.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            {group.participants.length > 0 ? (
                              <>
                                {group.participants.slice(0, 3).map(p => p.fullName).join(', ')}
                                {group.participants.length > 3 && ` +${group.participants.length - 3} more`}
                              </>
                            ) : (
                              'No members'
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                            {group.lastMessage.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(group.lastMessage.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="flex-1 flex flex-col">
          {(selectedUserId || selectedThreadId) ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {selectedThreadId ? (
                      // Group conversation
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                    ) : (
                      // Direct message (use selectedConversation.otherUser for BoltDown support - master not in users list)
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={(selectedUser ?? selectedConversation?.otherUser)?.avatarUrl || undefined} />
                        <AvatarFallback>{(selectedUser ?? selectedConversation?.otherUser) ? getInitials((selectedUser ?? selectedConversation?.otherUser)!.fullName) : 'U'}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      {selectedThreadId ? (
                        // Group header
                        <>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg truncate">
                              {(() => {
                                const selectedGroup = groups.find(g => g.thread.id === selectedThreadId);
                                return selectedGroup?.thread.name || `${selectedGroup?.participants.length || 0} members`;
                              })()}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const selectedGroup = groups.find(g => g.thread.id === selectedThreadId);
                                setRenameGroupName(selectedGroup?.thread.name || '');
                                setRenameGroupDialogOpen(true);
                              }}
                              title="Rename group"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {(() => {
                            const selectedGroup = groups.find(g => g.thread.id === selectedThreadId);
                            return selectedGroup && (
                              <>
                                <p className="text-sm text-muted-foreground truncate">
                                  {selectedGroup.participants.length > 0 
                                    ? selectedGroup.participants.map(p => p.fullName).join(', ')
                                    : 'No members'
                                  }
                                </p>
                                {selectedGroup.unreadCount > 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    {selectedGroup.unreadCount} unread message(s)
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        // Direct message header
                        <>
                          <CardTitle className="text-lg truncate">{selectedUser?.fullName ?? selectedConversation?.otherUser?.fullName ?? 'Unknown User'}</CardTitle>
                    {selectedConversation && selectedConversation.unreadCount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.unreadCount} unread message(s)
                      </p>
                    )}
                        </>
                      )}
                      {/* Show job context if there are messages about a job */}
                      {(() => {
                        const jobMessages = messages.filter(m => m.attachedJobId);
                        if (jobMessages.length > 0) {
                          // Get the most recent job mentioned
                          const mostRecentJobId = jobMessages[jobMessages.length - 1].attachedJobId;
                          if (mostRecentJobId) {
                            const job = jobs.find(j => j.id === mostRecentJobId);
                            return job ? (
                              <button
                                onClick={() => navigate(`/workshop/jobs/${mostRecentJobId}`)}
                                className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline group"
                              >
                                <Briefcase className="h-3.5 w-3.5" />
                                <span className="font-medium">{job.jobId}</span>
                                {job.description && (
                                  <span className="text-muted-foreground truncate max-w-[200px]">
                                    - {job.description}
                                  </span>
                                )}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ) : null;
                          }
                        }
                        return null;
                      })()}
                  </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchMessages()}
                    title="Refresh messages"
                    className="flex-shrink-0"
                  >
                    <Loader2 className={cn("h-4 w-4", messagesLoading && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : messagesError ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <p className="text-destructive mb-2">Error loading messages</p>
                      <p className="text-sm">{String(messagesError)}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-center font-medium">No messages yet. Start the conversation!</p>
                      {isBoltDownSupport ? (
                        <div className="mt-3 text-center text-sm space-y-1 max-w-md">
                          <p>This is a direct way to contact BoltDown support for help with your account or the platform.</p>
                          <p>Alternatively, you can email <a href="mailto:support@boltdown.co.uk" className="text-primary hover:underline font-medium">support@boltdown.co.uk</a></p>
                        </div>
                      ) : (
                        <>
                          {selectedUserId && (
                            <p className="text-xs mt-2">Conversation with user ID: {selectedUserId}</p>
                          )}
                          {selectedThreadId && (
                            <p className="text-xs mt-2">Group conversation ID: {selectedThreadId}</p>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {isBoltDownSupport && (
                        <div className="rounded-lg bg-muted/50 border border-muted p-3 text-sm text-muted-foreground">
                          <p>Chat with BoltDown support for help. Alternatively, email <a href="mailto:support@boltdown.co.uk" className="text-primary hover:underline font-medium">support@boltdown.co.uk</a></p>
                        </div>
                      )}
                      {messages.map((message) => {
                        const isOwnMessage = message.senderId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "flex gap-3",
                              isOwnMessage ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isOwnMessage && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={message.sender?.avatarUrl ?? undefined} alt={message.sender?.fullName} />
                                <AvatarFallback>{getInitials(message.sender?.fullName || "U")}</AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              "flex flex-col max-w-[70%]",
                              isOwnMessage ? "items-end" : "items-start"
                            )}>
                              <div className={cn(
                                "rounded-lg px-4 py-2",
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}>
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                {message.attachedImageUrls && message.attachedImageUrls.length > 0 && (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {message.attachedImageUrls.map((url, idx) => (
                                      <img
                                        key={idx}
                                        src={url}
                                        alt={`Attachment ${idx + 1}`}
                                        className="rounded max-w-full h-auto cursor-pointer"
                                        onClick={() => window.open(url, '_blank')}
                                      />
                                    ))}
                                  </div>
                                )}
                                {message.attachedJobId && (() => {
                                  const attachedJob = jobs.find(j => j.id === message.attachedJobId);
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/workshop/jobs/${message.attachedJobId}`);
                                      }}
                                      className="mt-2 flex items-center gap-2 text-xs opacity-90 hover:opacity-100 transition-opacity group cursor-pointer"
                                    >
                                      <Briefcase className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
                                      <span className="font-medium group-hover:text-primary transition-colors">
                                        {attachedJob?.jobId || `Job #${message.attachedJobId}`}
                                      </span>
                                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  );
                                })()}
                                {message.attachedTaskId && (() => {
                                  const attachedTask = tasks.find(t => t.id === message.attachedTaskId);
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Navigate to tasks page - could add task detail view later
                                        navigate('/actions?tab=tasks');
                                      }}
                                      className="mt-2 flex items-center gap-2 text-xs opacity-90 hover:opacity-100 transition-opacity group cursor-pointer"
                                    >
                                      <CheckSquare className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
                                      <span className="font-medium group-hover:text-primary transition-colors">
                                        {attachedTask?.title || `Task #${message.attachedTaskId}`}
                                      </span>
                                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(message.createdAt), 'HH:mm')}
                                {isOwnMessage && message.isRead && ' ✓'}
                              </p>
                            </div>
                            {isOwnMessage && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.fullName} />
                                <AvatarFallback>{getInitials(user?.fullName || "U")}</AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <Separator />
                <div className="p-4 space-y-2">
                  {(selectedJobId || selectedTaskId || selectedImages.length > 0) && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {selectedJobId && (() => {
                        const selectedJob = jobs.find(j => j.id === selectedJobId);
                        return (
                          <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              {selectedJob?.jobId || `Job #${selectedJobId}`}
                            </span>
                            {selectedJob?.description && (
                              <span className="text-xs opacity-75 max-w-[200px] truncate">
                                - {selectedJob.description}
                              </span>
                            )}
                          <button
                            onClick={() => setSelectedJobId(null)}
                              className="ml-1 hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          </Badge>
                        );
                      })()}
                      {selectedTaskId && (() => {
                        const selectedTask = tasks.find(t => t.id === selectedTaskId);
                        const assignedUser = selectedTask?.assignedTo ? users.find(u => u.id === selectedTask.assignedTo) : null;
                        return (
                          <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              {selectedTask?.title || `Task #${selectedTaskId}`}
                            </span>
                            {selectedTask?.status && (
                              <Badge variant="outline" className="text-xs ml-1">
                                {selectedTask.status}
                        </Badge>
                      )}
                            {assignedUser && (
                              <span className="text-xs opacity-75">
                                • {assignedUser.fullName}
                              </span>
                            )}
                          <button
                            onClick={() => setSelectedTaskId(null)}
                              className="ml-1 hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                        );
                      })()}
                      {selectedImages.map((url, idx) => (
                        <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Image {idx + 1}
                          <button
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                      <Dialog open={imageUploadDialogOpen} onOpenChange={setImageUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload Images</DialogTitle>
                            <DialogDescription>
                              Select up to 5 images to attach to your message.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                            <Button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadImagesMutation.isPending}
                            >
                              {uploadImagesMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Choose Images
                                </>
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={jobSelectDialogOpen} onOpenChange={setJobSelectDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" title="Attach job">
                            <Briefcase className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Attach Job to Message</DialogTitle>
                            <DialogDescription>
                              Select a job to discuss in this conversation
                            </DialogDescription>
                          </DialogHeader>
                          <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search jobs by ID, description, or status..."
                              value={jobSearchQuery}
                              onChange={(e) => setJobSearchQuery(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          <ScrollArea className="flex-1 min-h-[300px] max-h-[400px]">
                            <div className="space-y-2">
                              {jobs
                                .filter(job => {
                                  if (!jobSearchQuery) return true;
                                  const query = jobSearchQuery.toLowerCase();
                                  return (
                                    job.jobId?.toLowerCase().includes(query) ||
                                    job.description?.toLowerCase().includes(query) ||
                                    job.status?.toLowerCase().includes(query) ||
                                    job.customerName?.toLowerCase().includes(query)
                                  );
                                })
                                .slice(0, 100) // Limit to 100 results
                                .map((job) => (
                                  <button
                                    key={job.id}
                                    onClick={() => {
                                      setSelectedJobId(job.id);
                                      setJobSelectDialogOpen(false);
                                      setJobSearchQuery('');
                                    }}
                                    className={cn(
                                      "w-full p-4 rounded-lg border text-left hover:bg-muted transition-colors group",
                                      selectedJobId === job.id && "bg-primary/5 border-primary"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
                                          <span className="font-semibold text-primary">{job.jobId}</span>
                                          <Badge 
                                            variant="outline" 
                                            className="text-xs"
                                          >
                                            {job.status?.replace(/_/g, ' ') || 'Unknown'}
                                          </Badge>
                                        </div>
                                        {job.description && (
                                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                            {job.description}
                                          </p>
                                        )}
                                        {job.customerName && (
                                          <p className="text-xs text-muted-foreground">
                                            Customer: {job.customerName}
                                          </p>
                                        )}
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </div>
                                  </button>
                                ))}
                              {jobs.filter(job => {
                                if (!jobSearchQuery) return false;
                                const query = jobSearchQuery.toLowerCase();
                                return (
                                  job.jobId?.toLowerCase().includes(query) ||
                                  job.description?.toLowerCase().includes(query) ||
                                  job.status?.toLowerCase().includes(query) ||
                                  job.customerName?.toLowerCase().includes(query)
                                );
                              }).length === 0 && jobSearchQuery && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  No jobs found matching "{jobSearchQuery}"
                                </div>
                              )}
                              {jobs.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  No jobs available
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={taskSelectDialogOpen} onOpenChange={setTaskSelectDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" title="Attach task">
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Attach Task to Message</DialogTitle>
                            <DialogDescription>
                              Select a task to discuss in this conversation
                            </DialogDescription>
                          </DialogHeader>
                          <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search tasks by title, description, status, priority, or assignee..."
                              value={taskSearchQuery}
                              onChange={(e) => setTaskSearchQuery(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          <ScrollArea className="flex-1 min-h-[300px] max-h-[400px]">
                            <div className="space-y-2">
                              {tasks
                                .filter(task => {
                                  if (!taskSearchQuery) return true;
                                  const query = taskSearchQuery.toLowerCase();
                                  const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                                  return (
                                    task.title?.toLowerCase().includes(query) ||
                                    task.description?.toLowerCase().includes(query) ||
                                    task.status?.toLowerCase().includes(query) ||
                                    task.priority?.toLowerCase().includes(query) ||
                                    assignedUser?.fullName?.toLowerCase().includes(query) ||
                                    assignedUser?.username?.toLowerCase().includes(query)
                                  );
                                })
                                .slice(0, 100) // Limit to 100 results
                                .map((task) => {
                                  const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                                  const priorityColors = {
                                    high: 'text-red-600 bg-red-50 border-red-200',
                                    medium: 'text-amber-600 bg-amber-50 border-amber-200',
                                    low: 'text-blue-600 bg-blue-50 border-blue-200',
                                  };
                                  const priorityColor = priorityColors[task.priority as keyof typeof priorityColors] || 'text-gray-600 bg-gray-50 border-gray-200';
                                  
                                  return (
                                    <button
                                      key={task.id}
                                      onClick={() => {
                                        setSelectedTaskId(task.id);
                                        setTaskSelectDialogOpen(false);
                                        setTaskSearchQuery('');
                                      }}
                                      className={cn(
                                        "w-full p-4 rounded-lg border text-left hover:bg-muted transition-colors group",
                                        selectedTaskId === task.id && "bg-primary/5 border-primary"
                                      )}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="font-semibold text-sm">{task.title}</span>
                                            <Badge 
                                              variant="outline" 
                                              className="text-xs"
                                            >
                                              {task.status?.replace(/_/g, ' ') || 'Unknown'}
                                            </Badge>
                                            {task.priority && (
                                              <Badge 
                                                variant="outline" 
                                                className={cn("text-xs", priorityColor)}
                                              >
                                                {task.priority}
                                              </Badge>
                                            )}
                                          </div>
                                          {task.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                              {task.description}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                            {assignedUser ? (
                                              <div className="flex items-center gap-1.5">
                                                <User className="h-3 w-3" />
                                                <span>{assignedUser.fullName}</span>
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground/60">Unassigned</span>
                                            )}
                                            {task.dueDate && (
                                              <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                                              </div>
                                            )}
                                            {task.relatedJobId && (() => {
                                              const relatedJob = jobs.find(j => j.id === task.relatedJobId);
                                              return relatedJob ? (
                                                <div className="flex items-center gap-1.5">
                                                  <Briefcase className="h-3 w-3" />
                                                  <span>{relatedJob.jobId}</span>
                                                </div>
                                              ) : null;
                                            })()}
                                          </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                      </div>
                                    </button>
                                  );
                                })}
                              {tasks.filter(task => {
                                if (!taskSearchQuery) return false;
                                const query = taskSearchQuery.toLowerCase();
                                const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                                return (
                                  task.title?.toLowerCase().includes(query) ||
                                  task.description?.toLowerCase().includes(query) ||
                                  task.status?.toLowerCase().includes(query) ||
                                  task.priority?.toLowerCase().includes(query) ||
                                  assignedUser?.fullName?.toLowerCase().includes(query) ||
                                  assignedUser?.username?.toLowerCase().includes(query)
                                );
                              }).length === 0 && taskSearchQuery && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  No tasks found matching "{taskSearchQuery}"
                                </div>
                              )}
                              {tasks.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  No tasks available
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Textarea
                      placeholder="Type your message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 min-h-[60px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center p-8 max-w-md">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Start a Conversation</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Click the <strong>"New"</strong> button above to start messaging a team member, or select an existing conversation from the list.
                </p>
                <div className="text-xs text-slate-500 space-y-1 text-left bg-slate-50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">How messaging works:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Message any team member in your business</li>
                    <li>Attach jobs, tasks, or images to your messages</li>
                    <li>See unread message counts in real-time</li>
                    <li>Messages older than 3 months are automatically deleted</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Rename Group Dialog */}
          <Dialog open={renameGroupDialogOpen} onOpenChange={setRenameGroupDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Group</DialogTitle>
                <DialogDescription>
                  Enter a new name for this group conversation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Group name"
                  value={renameGroupName}
                  onChange={(e) => setRenameGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameGroupName.trim() && selectedThreadId) {
                      renameGroupMutation.mutate({
                        threadId: selectedThreadId,
                        name: renameGroupName.trim(),
                      });
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRenameGroupDialogOpen(false);
                      setRenameGroupName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedThreadId && renameGroupName.trim()) {
                        renameGroupMutation.mutate({
                          threadId: selectedThreadId,
                          name: renameGroupName.trim(),
                        });
                      }
                    }}
                    disabled={!renameGroupName.trim() || renameGroupMutation.isPending}
                  >
                    {renameGroupMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Renaming...
                      </>
                    ) : (
                      'Rename'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

