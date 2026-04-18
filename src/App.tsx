import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminModeration from "./pages/AdminModeration.tsx";
import Forum from "./pages/Forum.tsx";
import ForumCategory from "./pages/ForumCategory.tsx";
import ForumThread from "./pages/ForumThread.tsx";
import Messages from "./pages/Messages.tsx";
import Tickets from "./pages/Tickets.tsx";
import TicketDetail from "./pages/TicketDetail.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AIHelper } from "@/components/AIHelper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireEditor><Admin /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireEditor><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/moderation" element={<ProtectedRoute requireEditor><AdminModeration /></ProtectedRoute>} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/:slug" element={<ForumCategory />} />
            <Route path="/forum/:slug/:threadSlug" element={<ForumThread />} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
            <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIHelper />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
