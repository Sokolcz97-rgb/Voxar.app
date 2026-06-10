import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotifBadge } from "@/components/NotifBadge";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/UserAvatar";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavPages } from "@/hooks/usePages";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import {
  LogOut,
  Shield,
  User as UserIcon,
  Gamepad2,
  MessageSquare,
  LifeBuoy,
  Keyboard,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, isAdmin, isEditor, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { unreadMessages, openTickets } = useNotifications();
  const navPages = useNavPages();
  const { settings } = useSiteSettings();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName =
    (user?.user_metadata?.display_name as string) ||
    (user?.user_metadata?.username as string) ||
    user?.email?.split("@")[0] ||
    "Uživatel";
  const email = user?.email ?? "";
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-primary/20 shadow-[0_4px_30px_-10px_hsl(var(--primary)/0.4)]">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name}
                className="h-8 w-8 object-contain transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
              />
            ) : (
              <>
                <Gamepad2 className="h-8 w-8 text-primary transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                <div className="absolute inset-0 blur-xl bg-primary/50 -z-10" />
              </>
            )}
          </div>
          <span
            className="font-display font-black text-lg sm:text-xl tracking-[0.18em] text-glow-intense glitch"
            data-text={settings.site_name}
          >
            {settings.site_name}
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <GlobalSearch />
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
            onClick={() => window.dispatchEvent(new Event("shortcuts:open"))}
            aria-label={t("shortcuts.title")}
            title={t("shortcuts.title")}
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/forum">{t("nav.forum")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link to="/leaderboard">{t("nav.leaderboard")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link to="/servery">Servery</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link to="/novinky">Novinky</Link>
          </Button>
          {navPages.map((p) => (
            <Button key={p.slug} variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link to={`/${p.slug}`}>{p.nav_label}</Link>
            </Button>
          ))}
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex relative">
                <Link to="/messages">
                  {t("nav.messages")}
                  <NotifBadge count={unreadMessages} />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/dashboard">{t("nav.dashboard")}</Link>
              </Button>
              <LanguageSwitcher />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full border border-border relative hover:border-primary/40 transition-colors"
                  >
                    <UserAvatar url={avatarUrl} name={displayName} className="h-8 w-8" />
                    {(unreadMessages > 0 || openTickets > 0) && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 bg-card/95 backdrop-blur-xl border-border/80 p-0 overflow-hidden"
                >
                  {/* Header */}
                  <div className="relative px-4 pt-5 pb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                      <UserAvatar url={avatarUrl} name={displayName} className="h-11 w-11 border-primary/30" />
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-sm truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{email}</p>
                      </div>
                    </div>
                    {(isAdmin || isEditor) && (
                      <div className="relative mt-3 flex gap-2">
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-primary">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        )}
                        {isEditor && !isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-primary">
                            <Shield className="h-3 w-3" /> Editor
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-border/60" />

                  {/* Main links */}
                  <div className="p-1.5 space-y-0.5">
                    <DropdownMenuItem
                      onClick={() => navigate("/profile")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="flex-1 text-sm font-medium">{t("nav.profile")}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/messages")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20 relative">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        {unreadMessages > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {unreadMessages}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium">{t("nav.messages")}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/tickets")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20 relative">
                        <LifeBuoy className="h-4 w-4 text-primary" />
                        {openTickets > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {openTickets}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium">{t("nav.tickets")}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                      </div>
                      <span className="flex-1 text-sm font-medium">{t("nav.dashboard")}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                  </div>

                  {(isAdmin || isEditor) && (
                    <>
                      <DropdownMenuSeparator className="bg-border/60" />
                      <div className="p-1.5">
                        <DropdownMenuItem
                          onClick={() => navigate("/admin")}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                            <Shield className="h-4 w-4 text-primary" />
                          </div>
                          <span className="flex-1 text-sm font-medium text-primary">{t("nav.admin")}</span>
                          <ChevronRight className="h-4 w-4 text-primary" />
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-border/60" />

                  {/* Sign out */}
                  <div className="p-1.5">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 border border-destructive/20 group-hover:bg-destructive/20 transition-colors">
                        <LogOut className="h-4 w-4 text-destructive" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-destructive">{t("nav.signOut")}</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Button variant="default" size="sm" asChild className="bg-primary text-primary-foreground hover:bg-primary-glow shadow-[var(--glow-soft)]">
                <Link to="/auth">{t("nav.signIn")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
