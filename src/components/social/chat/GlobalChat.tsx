import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { friendsApi, type Friend } from '@/shared/api/friends';
import { getAuthToken } from '@/shared/api/client';
import { toast } from '@/hooks/use-toast';
import { 
  MessageCircle, 
  Send, 
  Users, 
  Circle, 
  Loader2, 
  Smile,
  MoreHorizontal,
  Settings
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
}

type OnlineActivity = { sessionId: string; role: string } | { gameId: string; type: string } | null;

interface OnlineFriend extends Friend {
  isOnline: boolean;
  activity?: OnlineActivity;
}

export function GlobalChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showOnlineFriends, setShowOnlineFriends] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // WebSocket connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const baseUrl = import.meta.env.VITE_WS_URL || 'http://localhost:9000';
    const socket = io(`${baseUrl}/app`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Global Chat] Connected');
      setIsConnected(true);
      
      // Join global chat room
      socket.emit('join_global_chat');
      
      // Request online friends
      socket.emit('get_online_friends');
    });

    socket.on('disconnect', () => {
      console.log('[Global Chat] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Global Chat] Connection error:', error.message);
      setIsConnected(false);
    });

    // Global chat messages
    socket.on('global_chat_message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    // Global chat history
    socket.on('global_chat_history', (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages);
    });

    // User joined global chat
    socket.on('global_chat_user_joined', (data: { userId: string; userName: string; timestamp: number }) => {
      const systemMessage: ChatMessage = {
        id: `system_${data.timestamp}`,
        userId: 'system',
        userName: 'System',
        content: `${data.userName} dołączył do chatu`,
        timestamp: new Date(data.timestamp).toISOString(),
        isSystem: true
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    // User left global chat
    socket.on('global_chat_user_left', (data: { userId: string; userName: string; timestamp: number }) => {
      const systemMessage: ChatMessage = {
        id: `system_${data.timestamp}`,
        userId: 'system',
        userName: 'System',
        content: `${data.userName} opuścił chat`,
        timestamp: new Date(data.timestamp).toISOString(),
        isSystem: true
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    // Online friends updates
    socket.on('online_friends_list', (data: { friends: any[] }) => {
      const friendsMap: Record<string, OnlineFriend> = {};
      
      // Convert to map for easy lookup
      data.friends.forEach(friend => {
        friendsMap[friend.userId] = {
          id: friend.userId,
          name: friend.userName || 'Unknown',
          avatarUrl: friend.userAvatar,
          friendshipId: '',
          createdAt: '',
          isOnline: friend.isOnline,
          activity: friend.activity
        };
      });

      // Update online friends list
      setOnlineFriends(Object.values(friendsMap));
    });

    // Friend status changes
    socket.on('friend_status_changed', (data: { userId: string; userName: string; isOnline: boolean }) => {
      setOnlineFriends(prev => {
        const existing = prev.find(f => f.id === data.userId);
        if (existing) {
          return prev.map(f => 
            f.id === data.userId 
              ? { ...f, isOnline: data.isOnline }
              : f
          );
        } else if (data.isOnline) {
          // Add new online friend
          return [...prev, {
            id: data.userId,
            name: data.userName,
            avatarUrl: undefined,
            friendshipId: '',
            createdAt: '',
            isOnline: true
          }];
        }
        return prev;
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load friends and their online status
      const [friendsData, onlineStatus] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getOnlineStatus()
      ]);

      // Combine friends with online status
      const friendsWithStatus: OnlineFriend[] = friendsData.friends.map(friend => ({
        ...friend,
        isOnline: onlineStatus.onlineFriends[friend.id]?.isOnline || false,
        activity: onlineStatus.onlineFriends[friend.id]?.activity
      }));

      setOnlineFriends(friendsWithStatus);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !socketRef.current || !isConnected || isSending) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      // Send message via WebSocket
      socketRef.current.emit('global_chat_message', {
        content: messageContent
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się wysłać wiadomości',
        variant: 'destructive',
      });
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onlineCount = onlineFriends.filter(f => f.isOnline).length;

  return (
    <Card className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-border shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat Globalny
            {isConnected && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                Online
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlineFriends(!showOnlineFriends)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Users className="h-4 w-4" />
              {onlineCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {onlineCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Online Friends Panel */}
        {showOnlineFriends && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Znajomi online ({onlineCount})
              </span>
            </div>
            <ScrollArea className="h-20">
              <div className="flex gap-2">
                {isLoading ? (
                  <div className="flex items-center justify-center w-full py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : onlineFriends.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Brak znajomych online
                  </div>
                ) : (
                  onlineFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                      title={`${friend.name} - ${friend.isOnline ? 'Online' : 'Offline'}`}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage 
                            src={friend.avatarUrl || '/avatar-default.svg'} 
                            alt={friend.name}
                          />
                          <AvatarFallback className="text-xs">
                            {friend.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <Circle
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${
                            friend.isOnline 
                              ? 'fill-green-500 text-green-500' 
                              : 'fill-gray-400 text-gray-400'
                          }`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[60px] group-hover:text-foreground transition-colors">
                        {friend.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="mt-3" />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-2">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Brak wiadomości</p>
                  <p className="text-xs mt-1">Napisz pierwszą wiadomość!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.isSystem ? 'justify-center' : ''}`}
                  >
                    {!message.isSystem && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage 
                          src={message.userAvatar || '/avatar-default.svg'} 
                          alt={message.userName}
                        />
                        <AvatarFallback className="text-xs">
                          {message.userName[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`flex-1 min-w-0 ${message.isSystem ? 'text-center' : ''}`}>
                      {!message.isSystem && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {message.userName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString('pl-PL', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`text-sm ${
                        message.isSystem 
                          ? 'text-muted-foreground italic' 
                          : 'text-foreground'
                      }`}>
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={isConnected ? "Napisz wiadomość..." : "Łączenie z chatem..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected || isSending}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || !isConnected || isSending}
                size="sm"
                className="shrink-0"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {!isConnected && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                <span>Rozłączony z chatem</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
