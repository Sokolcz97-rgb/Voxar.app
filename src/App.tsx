import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { InlineEditorProvider } from "@/contexts/InlineEditorContext";
import { InlineEditorChrome } from "@/components/pageBuilder/InlineEditorChrome";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import Admin from "./pages/Admin.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminModeration from "./pages/AdminModeration.tsx";
import AdminPages from "./pages/AdminPages.tsx";
import DynamicPage from "./pages/DynamicPage.tsx";
import Forum from "./pages/Forum.tsx";
import ForumCategory from "./pages/ForumCategory.tsx";
import ForumThread from "./pages/ForumThread.tsx";
import Messages from "./pages/Messages.tsx";
import Tickets from "./pages/Tickets.tsx";
import TicketDetail from "./pages/TicketDetail.tsx";
import NotFound from "./pages/NotFound.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Servers from "./pages/Servers.tsx";
import AdminGames from "./pages/AdminGames.tsx";
import AdminRoles from "./pages/AdminRoles.tsx";
import AdminDiscord from "./pages/AdminDiscord.tsx";
import { AIHelper } from "@/components/AIHelper";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

const queryClient = new QueryClient();

const AppRoutes = () => {
  useGlobalShortcuts();
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<PublicProfile />} />
      <Route path="/admin" element={<ProtectedRoute requireEditor><Admin /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute requireEditor><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/moderation" element={<ProtectedRoute requireEditor><AdminModeration /></ProtectedRoute>} />
      <Route path="/admin/pages" element={<ProtectedRoute requireEditor><AdminPages /></ProtectedRoute>} />
      <Route path="/forum" element={<Forum />} />
      <Route path="/forum/:slug" element={<ForumCategory />} />
      <Route path="/forum/:slug/:threadSlug" element={<ForumThread />} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
      <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/servery" element={<Servers />} />
      <Route path="/admin/games" element={<ProtectedRoute requireEditor><AdminGames /></ProtectedRoute>} />
      <Route path="/admin/roles" element={<ProtectedRoute requireEditor><AdminRoles /></ProtectedRoute>} />
      <Route path="/admin/discord" element={<ProtectedRoute requireEditor><AdminDiscord /></ProtectedRoute>} />
      <Route path="/:slug" element={<DynamicPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PresenceProvider>
            <InlineEditorProvider>
              <AppRoutes />
              <InlineEditorChrome />
              <AIHelper />
              <ShortcutsHelp />
            </InlineEditorProvider>
          </PresenceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
