import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { CosmeticsProvider } from "@/contexts/CosmeticsContext";
import { InlineEditorProvider } from "@/contexts/InlineEditorContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { InlineEditorChrome } from "@/components/pageBuilder/InlineEditorChrome";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import Admin from "./pages/Admin.tsx";
import AdminUsersRoles from "./pages/AdminUsersRoles.tsx";
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

import AdminDiscord from "./pages/AdminDiscord.tsx";
import AdminSiteSettings from "./pages/AdminSiteSettings.tsx";
import AdminStreams from "./pages/AdminStreams.tsx";
import AdminChatBot from "./pages/AdminChatBot.tsx";
import DashboardBot from "./pages/DashboardBot.tsx";
import DashboardBotGuilds from "./pages/DashboardBotGuilds.tsx";
import Novinky from "./pages/Novinky.tsx";
import AdminNovinky from "./pages/AdminNovinky.tsx";
import AdminForumCategories from "./pages/AdminForumCategories.tsx";
import AdminStats from "./pages/AdminStats.tsx";
import DiscordOAuthComplete from "./pages/DiscordOAuthComplete.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import ShopPage from "./pages/Shop.tsx";
import BusinessTerms from "./pages/BusinessTerms.tsx";
import Orders from "./pages/Orders.tsx";
import CreateOrder from "./pages/CreateOrder.tsx";
import MyOrders from "./pages/MyOrders.tsx";
import AdminOrderModels from "./pages/AdminOrderModels.tsx";
import LiveNow from "./pages/LiveNow.tsx";
import BountyBoard from "./pages/BountyBoard.tsx";
import { LiveNowHud } from "@/components/LiveNowHud";
import { LfgHud } from "@/components/LfgHud";
import MyForms from "./pages/MyForms.tsx";
import FormEditor from "./pages/FormEditor.tsx";
import FormResults from "./pages/FormResults.tsx";
import PublicForm from "./pages/PublicForm.tsx";
import DownloadDesktop from "./pages/DownloadDesktop.tsx";
import AdminDownloadCodes from "./pages/AdminDownloadCodes.tsx";
import AdminConsole from "./pages/AdminConsole.tsx";
import AdminCosmetics from "./pages/AdminCosmetics.tsx";
import AdminPurchases from "./pages/AdminPurchases.tsx";
import AdminBadges from "./pages/AdminBadges.tsx";
import AppShell from "./pages/app/AppShell.tsx";
import { AIHelper } from "@/components/AIHelper";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { VoiceCallProvider } from "@/contexts/VoiceCallContext";
import { useLocation } from "react-router-dom";
import { DesktopRouteGuard } from "@/components/DesktopRouteGuard";
import { AppAccessGate } from "@/components/vox/AppAccessGate";
import { AIHelperHolo } from "@/components/vox/AIHelperHolo";
import { SystemUpdateAlert } from "@/components/SystemUpdateAlert";


const queryClient = new QueryClient();

const AppRoutes = () => {
  useGlobalShortcuts();
  return (
    <>
      <DesktopRouteGuard />

    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/discord-oauth-complete" element={<DiscordOAuthComplete />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/bot" element={<ProtectedRoute><DashboardBot /></ProtectedRoute>} />
      <Route path="/dashboard/bot/guilds" element={<ProtectedRoute><DashboardBotGuilds /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<PublicProfile />} />
      <Route path="/admin" element={<ProtectedRoute requireEditor><Admin /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute requireEditor><AdminUsersRoles /></ProtectedRoute>} />
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
      {/* /admin/roles je alias - přesměrováno na sjednocenou stránku /admin/users */}
      <Route path="/admin/roles" element={<Navigate to="/admin/users" replace />} />
      <Route path="/admin/discord" element={<ProtectedRoute requireEditor><AdminDiscord /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute requireEditor><AdminSiteSettings /></ProtectedRoute>} />
      <Route path="/admin/streams" element={<ProtectedRoute requireEditor><AdminStreams /></ProtectedRoute>} />
      <Route path="/admin/chat-bot" element={<ProtectedRoute requireEditor><AdminChatBot /></ProtectedRoute>} />
      <Route path="/admin/novinky" element={<ProtectedRoute requireEditor><AdminNovinky /></ProtectedRoute>} />
      <Route path="/admin/forum-categories" element={<ProtectedRoute requireEditor><AdminForumCategories /></ProtectedRoute>} />
      <Route path="/admin/stats" element={<ProtectedRoute requireEditor><AdminStats /></ProtectedRoute>} />
      <Route path="/novinky" element={<Novinky />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/obchod" element={<ShopPage />} />
      <Route path="/obchodni-podminky" element={<BusinessTerms />} />
      <Route path="/zakazky" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/objednat" element={<ProtectedRoute><CreateOrder /></ProtectedRoute>} />
      <Route path="/profile/zakazky" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
      <Route path="/admin/order-models" element={<ProtectedRoute requireEditor><AdminOrderModels /></ProtectedRoute>} />
      <Route path="/live" element={<LiveNow />} />
      <Route path="/kontrakty" element={<BountyBoard />} />
      <Route path="/profile/formulare" element={<ProtectedRoute><MyForms /></ProtectedRoute>} />
      <Route path="/profile/formulare/:id/edit" element={<ProtectedRoute><FormEditor /></ProtectedRoute>} />
      <Route path="/profile/formulare/:id/vysledky" element={<ProtectedRoute><FormResults /></ProtectedRoute>} />
      <Route path="/f/:slug" element={<PublicForm />} />
      <Route path="/desktop" element={<DownloadDesktop />} />
      <Route path="/admin/download-codes" element={<ProtectedRoute requireEditor><AdminDownloadCodes /></ProtectedRoute>} />
      <Route path="/admin/badges" element={<ProtectedRoute requireEditor><AdminBadges /></ProtectedRoute>} />
      <Route path="/admin/nakupy" element={<ProtectedRoute requireEditor><AdminPurchases /></ProtectedRoute>} />
      <Route path="/admin/cosmetics" element={<ProtectedRoute requireEditor><AdminCosmetics /></ProtectedRoute>} />
      <Route path="/admin/console" element={<ProtectedRoute requireEditor><AdminConsole /></ProtectedRoute>} />
      <Route path="/app" element={<AppAccessGate><AppShell /></AppAccessGate>} />
      <Route path="/:slug" element={<DynamicPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
};


/** Root-level AI layer: a sibling of the router layout, never nested in app grids. */
const RootAIHelper = () => {
  const { pathname } = useLocation();
  if (pathname === "/app" || pathname.startsWith("/app/")) return <AIHelperHolo />;
  return <AIHelper />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SiteSettingsProvider>
            <CosmeticsProvider>
            <PresenceProvider>
              <VoiceCallProvider>
              <InlineEditorProvider>
                <AppRoutes />
                <InlineEditorChrome />
                 <RootAIHelper />
                <ShortcutsHelp />
                <LiveNowHud />
                <LfgHud />
                <SystemUpdateAlert />

              </InlineEditorProvider>
              </VoiceCallProvider>
            </PresenceProvider>
            </CosmeticsProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
