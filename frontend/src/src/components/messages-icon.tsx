import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface Conversation {
  otherUser: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
  };
  lastMessage: any;
  unreadCount: number;
}

export function MessagesIcon() {
  const { data: conversationsData } = useQuery<Conversation[]>({
    queryKey: ['/api/messages/conversations'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Ensure conversations is always an array
  const conversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData],
  );

  const unreadCount = conversations.reduce((sum, conv) => sum + (conv?.unreadCount || 0), 0);

  return (
    <Link href="/messages">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 sm:h-8 sm:w-8 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100 flex-shrink-0"
        title="Messages"
      >
        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[9px] sm:text-[10px] font-bold text-white border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}



