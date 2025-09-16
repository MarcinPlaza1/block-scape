import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  Users,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage, CollabParticipant } from '@/hooks/useCollabClient';

interface SessionChatProps {
  messages: ChatMessage[];
  participants: CollabParticipant[];
  isConnected: boolean;
  onSendMessage: (message: string) => void;
  onSetTyping: (isTyping: boolean) => void;
  onLoadHistory: (cursor?: string) => Promise<boolean>;
  className?: string;
}

const SessionChat: React.FC<SessionChatProps> = ({
  messages,
  participants,
  isConnected,
  onSendMessage,
  onSetTyping,
  onLoadHistory,
  className
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    onSetTyping(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      onSetTyping(false);
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !isConnected) return;
    
    onSendMessage(newMessage.trim());
    setNewMessage('');
    
    // Stop typing
    onSetTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingHistory || !hasMoreHistory || messages.length === 0) return;
    
    setIsLoadingHistory(true);
    try {
      const hasMore = await onLoadHistory(messages[0]?.createdAt);
      setHasMoreHistory(hasMore);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
    setIsLoadingHistory(false);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageTypeStyle = (type: string) => {
    switch (type) {
      case 'system':
        return 'text-xs text-muted-foreground italic text-center bg-muted/20 rounded px-2 py-1';
      case 'join':
        return 'text-xs text-success text-center bg-success/10 rounded px-2 py-1';
      case 'leave':
        return 'text-xs text-muted-foreground text-center bg-muted/20 rounded px-2 py-1';
      default:
        return '';
    }
  };

  const onlineCount = participants.filter(p => p.isOnline).length;

  if (isMinimized) {
    return (
      <div className={cn('fixed bottom-4 right-4 z-50', className)}>
        <Button
          onClick={() => setIsMinimized(false)}
          variant="default"
          size="lg"
          className="rounded-full shadow-lg"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Chat ({messages.length})
          {onlineCount > 1 && (
            <Badge variant="secondary" className="ml-2">
              {onlineCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn(
      'fixed bottom-4 right-4 z-50 bg-card/95 backdrop-blur-sm border-border shadow-xl',
      isExpanded ? 'w-96 h-96' : 'w-80 h-80',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Chat</span>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {onlineCount}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="px-3 py-2 bg-warning/10 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-warning">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnecting...
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
        <div className="space-y-3">
          {/* Load more button */}
          {hasMoreHistory && messages.length > 0 && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Load more messages
              </Button>
            </div>
          )}

          {messages.map((message, index) => {
            const isSystemMessage = message.type !== 'text';

            if (isSystemMessage) {
              return (
                <div key={message.id} className={getMessageTypeStyle(message.type)}>
                  {message.content}
                </div>
              );
            }

            return (
              <div key={message.id} className="flex gap-2 group">
                <Avatar className="h-6 w-6 mt-0.5">
                  {message.user?.avatarUrl ? (
                    <AvatarImage src={message.user.avatarUrl} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {message.authorName[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium truncate">
                      {message.authorName}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 text-sm"
            maxLength={500}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newMessage.trim() || !isConnected}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default SessionChat;
