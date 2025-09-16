import { useState, useEffect } from 'react';
import { friendsApi, type Friend, type FriendRequest } from '@/shared/api/friends';
import { useFriendsSocket } from '@/hooks/useFriendsSocket';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, UserX, Check, X, Search, Send, Loader2, Circle } from 'lucide-react';

export function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; avatarUrl?: string }>>([]);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, { isOnline: boolean; activity?: any }>>({});
  
  // WebSocket integration
  const { 
    sendFriendRequest: wsSendRequest, 
    acceptFriendRequest: wsAcceptRequest,
    removeFriend: wsRemoveFriend,
    getOnlineFriends
  } = useFriendsSocket({
    onFriendRequestReceived: () => {
      // Reload requests when new request is received
      loadData();
    },
    onFriendRequestAccepted: () => {
      // Reload friends when request is accepted
      loadData();
    },
    onFriendRemoved: () => {
      // Reload friends when removed
      loadData();
    },
    onFriendStatusChanged: (notification) => {
      // Update online status in real-time
      if (notification.userId) {
        setOnlineStatus(prev => ({
          ...prev,
          [notification.userId!]: { isOnline: notification.isOnline || false }
        }));
      }
    },
    onOnlineFriendsList: (onlineFriends) => {
      // Update online status from list
      const statusMap: Record<string, { isOnline: boolean; activity?: any }> = {};
      onlineFriends.forEach(friend => {
        statusMap[friend.userId] = {
          isOnline: friend.isOnline,
          activity: friend.activity
        };
      });
      setOnlineStatus(statusMap);
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Load friends and requests
  useEffect(() => {
    loadData();
  }, []);

  // Poll for online status
  useEffect(() => {
    const interval = setInterval(() => {
      loadOnlineStatus();
      getOnlineFriends(); // Get real-time updates via WebSocket
    }, 30000); // Every 30 seconds
    loadOnlineStatus();
    getOnlineFriends(); // Initial request
    return () => clearInterval(interval);
  }, [friends]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [friendsData, requestsData] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getRequests(),
      ]);
      setFriends(friendsData.friends);
      setSentRequests(requestsData.sent);
      setReceivedRequests(requestsData.received);
    } catch (error) {
      console.error('Failed to load friends data:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować listy znajomych',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOnlineStatus = async () => {
    try {
      const status = await friendsApi.getOnlineStatus();
      setOnlineStatus(status.onlineFriends);
    } catch (error) {
      console.error('Failed to load online status:', error);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await friendsApi.searchUsers(searchQuery);
      setSearchResults(results.users);
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się wyszukać użytkowników',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedUser) return;

    try {
      setSendingRequest(true);
      const result = await friendsApi.sendRequest(selectedUser.id, requestMessage);
      
      if (result.friendId) {
        // Auto-accepted (mutual request)
        toast({
          title: 'Nowy znajomy!',
          description: `Ty i ${selectedUser.name} jesteście teraz znajomymi!`,
        });
        await loadData();
      } else {
        // Request sent
        toast({
          title: 'Zaproszenie wysłane',
          description: `Zaproszenie zostało wysłane do ${selectedUser.name}`,
        });
        setSentRequests([...sentRequests, result.request]);
        // Send WebSocket notification
        wsSendRequest(selectedUser.id);
      }
      
      setShowAddFriend(false);
      setSelectedUser(null);
      setRequestMessage('');
      setSearchQuery('');
      setSearchResults([]);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się wysłać zaproszenia',
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      await friendsApi.acceptRequest(request.id);
      toast({
        title: 'Zaproszenie przyjęte',
        description: `${request.user.name} został dodany do znajomych`,
      });
      // Send WebSocket notification
      wsAcceptRequest(request.user.id);
      await loadData();
    } catch (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się przyjąć zaproszenia',
        variant: 'destructive',
      });
    }
  };

  const handleRejectRequest = async (request: FriendRequest) => {
    try {
      await friendsApi.rejectRequest(request.id);
      toast({
        title: 'Zaproszenie odrzucone',
        description: `Zaproszenie od ${request.user.name} zostało odrzucone`,
      });
      setReceivedRequests(receivedRequests.filter(r => r.id !== request.id));
    } catch (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się odrzucić zaproszenia',
        variant: 'destructive',
      });
    }
  };

  const handleCancelRequest = async (request: FriendRequest) => {
    try {
      await friendsApi.cancelRequest(request.id);
      toast({
        title: 'Zaproszenie anulowane',
        description: `Zaproszenie do ${request.user.name} zostało anulowane`,
      });
      setSentRequests(sentRequests.filter(r => r.id !== request.id));
    } catch (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się anulować zaproszenia',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFriend = async (friend: Friend) => {
    if (!confirm(`Czy na pewno chcesz usunąć ${friend.name} ze znajomych?`)) {
      return;
    }

    try {
      await friendsApi.removeFriend(friend.id);
      toast({
        title: 'Znajomy usunięty',
        description: `${friend.name} został usunięty ze znajomych`,
      });
      // Send WebSocket notification
      wsRemoveFriend(friend.id);
      setFriends(friends.filter(f => f.id !== friend.id));
    } catch (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć znajomego',
        variant: 'destructive',
      });
    }
  };

  const requestsCount = receivedRequests.length;

  return (
    <Card className="w-full h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="font-semibold">Znajomi</h2>
          {requestsCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {requestsCount}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddFriend(true)}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Dodaj
        </Button>
      </div>

      <Tabs defaultValue="friends" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            Znajomi ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="received" className="relative">
            Otrzymane
            {requestsCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
              >
                {requestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">
            Wysłane ({sentRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nie masz jeszcze żadnych znajomych</p>
                  <p className="text-sm mt-1">Znajdź użytkowników i wyślij im zaproszenie!</p>
                </div>
              ) : (
                friends.map((friend) => {
                  const isOnline = onlineStatus[friend.id]?.isOnline || false;
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="relative">
                        <Avatar>
                          <img 
                            src={friend.avatarUrl || '/avatar-default.svg'} 
                            alt={friend.name}
                            className="w-10 h-10 rounded-full"
                          />
                        </Avatar>
                        <Circle
                          className={`absolute bottom-0 right-0 h-3 w-3 ${
                            isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{friend.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveFriend(friend)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="received" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {receivedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Brak otrzymanych zaproszeń</p>
                </div>
              ) : (
                receivedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                  >
                    <Avatar>
                      <img 
                        src={request.user.avatarUrl || '/avatar-default.svg'} 
                        alt={request.user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.user.name}</p>
                      {request.message && (
                        <p className="text-xs text-muted-foreground truncate">
                          "{request.message}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleAcceptRequest(request)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleRejectRequest(request)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="sent" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Brak wysłanych zaproszeń</p>
                </div>
              ) : (
                sentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Avatar>
                      <img 
                        src={request.user.avatarUrl || '/avatar-default.svg'} 
                        alt={request.user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.user.name}</p>
                      <p className="text-xs text-muted-foreground">Oczekuje</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelRequest(request)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Add Friend Dialog */}
      <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj znajomego</DialogTitle>
            <DialogDescription>
              Wyszukaj użytkownika po nazwie lub emailu
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Wyszukaj użytkownika..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 pl-7 pr-2.5 text-sm"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-8 w-8 p-0">
                {isSearching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-secondary/50'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <Avatar className="h-8 w-8">
                        <img 
                          src={user.avatarUrl || '/avatar-default.svg'} 
                          alt={user.name}
                        />
                      </Avatar>
                      <p className="flex-1 font-medium">{user.name}</p>
                      {selectedUser?.id === user.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="message">Wiadomość (opcjonalna)</Label>
                  <Textarea
                    id="message"
                    placeholder="Cześć! Chciałbym dodać Cię do znajomych..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleSendRequest} 
                  disabled={sendingRequest}
                  className="w-full"
                >
                  {sendingRequest ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Wyślij zaproszenie
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
