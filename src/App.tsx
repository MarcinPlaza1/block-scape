import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SandboxEditor from "./pages/SandboxEditor";
import Login from "./pages/Login";
import UserGames from "./pages/UserGames";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import News from "./pages/News";
import NewsDetail from "@/pages/NewsDetail";
import Play from "./pages/Play";
import { useAuthStore } from "@/lib/store";
import { initThemeFromStorage } from "@/lib/theme";

const queryClient = new QueryClient();

const App = () => {
  const fetchMe = useAuthStore(s => s.fetchMe);

  useEffect(() => {
    initThemeFromStorage();
    // Attempt to restore session if token exists
    fetchMe().catch(() => {});
  }, [fetchMe]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/editor/:projectName" element={<SandboxEditor />} />
            <Route path="/play/:id" element={<Play />} />
            <Route path="/login" element={<Login />} />
            <Route path="/games" element={<UserGames />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/profile" element={<Profile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
