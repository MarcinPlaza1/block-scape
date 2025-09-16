import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { privateChatApi, type Conversation, type PrivateMessage, type OnlineFriend } from '@/shared/api/privateChat';
import { getAuthToken } from '@/shared/api/client';
import { useAuthStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { 
  MessageCircle, 
  Send, 
  Users, 
  Circle, 
  Loader2,
  Plus,
  Search,
  MoreHorizontal
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export function PrivateChat() {
  const authUserId = useAuthStore(s => s.user?.id) as string | undefined;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [friends, setFriends] = useState<OnlineFriend[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, { isOnline: boolean; activity?: any }>>({});
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
      console.log('[Private Chat] Connected');
      
      // Join private chat room
      socket.emit('join_private_chat');
    });

    socket.on('disconnect', () => {
      console.log('[Private Chat] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[Private Chat] Connection error:', error.message);
    });

    // Private message events
    socket.on('private_message', (message: PrivateMessage & { conversationId?: string }) => {
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message]);
      }
      
      // Update conversation list
      setConversations(prev => prev.map(conv => 
        conv.id === (message.conversationId || (message as any).sender?.conversationId)
          ? { ...conv, lastMessage: message, updatedAt: new Date().toISOString() }
          : conv
      ));
    });

    // Online friends updates
    socket.on('online_friends_list', (data: { friends: any[] }) => {
      const friendsMap: Record<string, OnlineFriend> = {};
      
      data.friends.forEach(friend => {
        friendsMap[friend.userId] = {
          id: friend.userId,
          name: friend.userName || 'Unknown',
          avatarUrl: friend.userAvatar,
          isOnline: friend.isOnline,
          activity: friend.activity
        };
      });

      setOnlineStatus(friendsMap);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [selectedConversation]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      const [conversationsData, friendsData, onlineStatusData] = await Promise.all([
        privateChatApi.getConversations(),
        privateChatApi.getFriends(),
        privateChatApi.getOnlineStatus()
      ]);

      setConversations(conversationsData.conversations);
      
      // Combine friends with online status
      const friendsWithStatus: OnlineFriend[] = friendsData.friends.map(friend => ({
        ...friend,
        isOnline: onlineStatusData.onlineFriends[friend.id]?.isOnline || false,
        activity: onlineStatusData.onlineFriends[friend.id]?.activity
      }));

      setFriends(friendsWithStatus);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować danych chatu',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
    
    try {
      const messagesData = await privateChatApi.getMessages(conversation.id);
      setMessages(messagesData.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować wiadomości',
        variant: 'destructive',
      });
    }
  };

  const startConversation = async (friend: OnlineFriend) => {
    try {
      const conversationData = await privateChatApi.createConversation(friend.id);
      const newConversation: Conversation = {
        id: conversationData.conversation.id,
        otherUser: conversationData.conversation.otherUser,
        lastMessage: undefined,
        updatedAt: conversationData.conversation.createdAt,
        unreadCount: 0
      };
      
      setConversations(prev => [newConversation, ...prev]);
      setSelectedConversation(newConversation);
      setMessages([]);
      setShowFriendsList(false);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się rozpocząć rozmowy',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const messageData = await privateChatApi.sendMessage(selectedConversation.id, messageContent);
      
      // Add message to current conversation
      setMessages(prev => [...prev, messageData.message]);
      
      // Update conversation list
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, lastMessage: messageData.message, updatedAt: new Date().toISOString() }
          : conv
      ));

      // Send via WebSocket for real-time delivery
      if (socketRef.current) {
        socketRef.current.emit('private_message', {
          conversationId: selectedConversation.id,
          content: messageContent
        });
      }
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się wysłać wiadomości',
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

  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineFriends = friends.filter(f => f.isOnline);
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <Card className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-border shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Wiadomości
            {totalUnreadCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {totalUnreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFriendsList(!showFriendsList)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Users className="h-4 w-4" />
              {onlineFriends.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {onlineFriends.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFriendsList(!showFriendsList)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Friends List Panel */}
        {showFriendsList && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Znajomi ({friends.length})
              </span>
            </div>
            
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Szukaj znajomych..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-7 pr-2.5 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="h-8 w-8 p-0"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
            
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    {searchQuery ? 'Nie znaleziono znajomych' : 'Brak znajomych'}
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                      onClick={() => startConversation(friend)}
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                          {friend.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {friend.isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <Separator className="mt-3" />
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex min-h-0">
          {/* Conversations List */}
          <div className="w-1/3 border-r border-border/50 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Brak rozmów</p>
                    <p className="text-xs mt-1">Rozpocznij rozmowę ze znajomym!</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id
                          ? 'bg-primary/10 border-primary/20'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => selectConversation(conversation)}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={conversation.otherUser.avatarUrl || '/avatar-default.svg'} 
                            alt={conversation.otherUser.name}
                          />
                          <AvatarFallback>
                            {conversation.otherUser.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {onlineStatus[conversation.otherUser.id]?.isOnline && (
                          <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conversation.otherUser.name}</p>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.lastMessage.senderId === authUserId ? 'Ty: ' : ''}
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={selectedConversation.otherUser.avatarUrl || '/avatar-default.svg'} 
                      alt={selectedConversation.otherUser.name}
                    />
                    <AvatarFallback>
                      {selectedConversation.otherUser.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedConversation.otherUser.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {onlineStatus[selectedConversation.otherUser.id]?.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
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
                          className={`flex gap-3 ${
                            message.senderId === authUserId ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.senderId !== authUserId && (
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage 
                                src={message.sender.avatarUrl || '/avatar-default.svg'} 
                                alt={message.sender.name}
                              />
                              <AvatarFallback className="text-xs">
                                {message.sender.name[0]}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[70%] ${message.senderId === authUserId ? 'order-first' : ''}`}>
                            <div className={`rounded-lg px-3 py-2 ${
                              message.senderId === authUserId
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(message.createdAt).toLocaleTimeString('pl-PL', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
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
                      placeholder="Napisz wiadomość..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending}
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
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Wybierz rozmowę</p>
                  <p className="text-sm mt-1">lub rozpocznij nową ze znajomym</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
