import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
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
  Menu,
  Trophy,
  Server,
  Newspaper,
  MessageCircle,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProfile(data ?? null);
    })();
    const ch = supabase
      .channel(`profile-nav-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, (payload) => {
        const p = payload.new as { display_name: string | null; avatar_url: string | null };
        setProfile({ display_name: p.display_name, avatar_url: p.avatar_url });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const displayName =
    profile?.display_name ||
    (user?.user_metadata?.display_name as string) ||
    (user?.user_metadata?.username as string) ||
    user?.email?.split("@")[0] ||
    "Uživatel";
  const email = user?.email ?? "";
  const avatarUrl = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || "";

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
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
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

          {/* Mobile hamburger menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-foreground"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[85vw] max-w-sm bg-card/95 backdrop-blur-xl border-l border-primary/20 p-0 flex flex-col"
            >
              <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
                <SheetTitle className="font-display tracking-[0.18em] text-glow-intense">
                  {settings.site_name}
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {[
                  { to: "/forum", label: t("nav.forum"), icon: MessageCircle },
                  { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
                  { to: "/servery", label: "Servery", icon: Server },
                  { to: "/novinky", label: "Novinky", icon: Newspaper },
                  ...navPages.map((p) => ({
                    to: `/${p.slug}`,
                    label: p.nav_label,
                    icon: ChevronRight,
                  })),
                  ...(user
                    ? [
                        {
                          to: "/messages",
                          label: t("nav.messages"),
                          icon: MessageSquare,
                          badge: unreadMessages,
                        },
                        {
                          to: "/tickets",
                          label: t("nav.tickets"),
                          icon: LifeBuoy,
                          badge: openTickets,
                        },
                        {
                          to: "/dashboard",
                          label: t("nav.dashboard"),
                          icon: LayoutDashboard,
                        },
                        {
                          to: "/profile",
                          label: t("nav.profile"),
                          icon: UserIcon,
                        },
                        {
                          to: "/profile",
                          label: t("nav.profileSettings"),
                          icon: Settings,
                        },
                      ]
                    : []),
                  ...(isAdmin || isEditor
                    ? [{ to: "/admin", label: t("nav.admin"), icon: Shield, primary: true }]
                    : []),
                ].map((item: any) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-primary/10 transition-colors"
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                          item.primary
                            ? "bg-primary/20 border-primary/40"
                            : "bg-primary/10 border-primary/20"
                        }`}
                      >
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          item.primary ? "text-primary" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge > 0 && (
                        <span className="h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              {user && (
                <div className="p-3 border-t border-border/60">
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      onClick={handleSignOut}
                      className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("nav.signOut")}
                    </Button>
                  </SheetClose>
                </div>
              )}
              {!user && (
                <div className="p-3 border-t border-border/60">
                  <SheetClose asChild>
                    <Button asChild variant="default" className="w-full">
                      <Link to="/auth">{t("nav.signIn")}</Link>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex relative">
                <Link to="/messages">
                  {t("nav.messages")}
                  <NotifBadge count={unreadMessages} />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
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
