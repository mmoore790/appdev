import React from 'react';
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
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/messages/conversations'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <Link href="/messages">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100"
        title="Messages"
      >
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}

