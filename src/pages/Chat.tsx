import { useEffect, useState } from 'react';
import PageTransition from '@/components/ui/PageTransition';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  Globe,
  Lock,
  
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { PrivateChat } from '@/components/chat/PrivateChat';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { usePermissions } from '@/hooks/usePermissions';
import { FriendsList } from '@/components/friends/FriendsList';

// Friends functionality moved into FriendsList component

const Chat = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = usePermissions();
  const [activeTab, setActiveTab] = useState<'global' | 'private'>('global');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + 1 - Global chat
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('global');
      }
      
      // Ctrl/Cmd + 2 - Private messages
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('private');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen p-6">
          <Card className="w-full max-w-md bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Chat i Wiadomości
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Zaloguj się, aby korzystać z czatu i wysyłać wiadomości do znajomych
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                onClick={() => navigate('/login')}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Zaloguj się
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen w-full bg-background">
        <Navbar />
        
        <div className="max-w-6xl mx-auto p-4">
          {/* Minimalist Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold text-foreground">
                  Chat
                </h1>
              </div>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Chat Area */}
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {/* Simple Tab Navigation */}
                  <div className="border-b border-border">
                    <div className="flex">
                      <button
                        onClick={() => setActiveTab('global')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === 'global'
                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Globe className="h-4 w-4 inline mr-2" />
                        Globalny
                      </button>
                      <button
                        onClick={() => setActiveTab('private')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === 'private'
                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Lock className="h-4 w-4 inline mr-2" />
                        Prywatne
                      </button>
                    </div>
                  </div>
                  
                  {/* Chat Content */}
                  <div className="h-[500px]">
                    {activeTab === 'global' ? (
                      <GlobalChat />
                    ) : (
                      <PrivateChat />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar with full Friends functionality */}
            <div className="space-y-4">
              <FriendsList />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Chat;
