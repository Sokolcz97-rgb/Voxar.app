import { Link, useLocation, useNavigate } from "react-router-dom";
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
  LogIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type RailItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  primary?: boolean;
};

export function Navbar() {
  const { user, isAdmin, isEditor, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const primaryRail: RailItem[] = [
    { to: "/forum", label: t("nav.forum"), icon: MessageCircle },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/servery", label: "Servery", icon: Server },
    { to: "/novinky", label: "Novinky", icon: Newspaper },
    ...navPages.map((p) => ({ to: `/${p.slug}`, label: p.nav_label, icon: ChevronRight })),
  ];

  const userRail: RailItem[] = user
    ? [{ to: "/messages", label: t("nav.messages"), icon: MessageSquare, badge: unreadMessages }]
    : [];

  const profileMenuItems: RailItem[] = user
    ? [
        { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { to: "/tickets", label: t("nav.tickets"), icon: LifeBuoy, badge: openTickets },
        ...(isAdmin || isEditor ? [{ to: "/admin", label: t("nav.admin"), icon: Shield, primary: true }] : []),
      ]
    : [];

  const adminRail: RailItem[] = [];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const RailLink = ({ item }: { item: RailItem }) => {
    const active = isActive(item.to);
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <Link
            to={item.to}
            aria-label={item.label}
            className={`rail-link-flat relative group flex h-9 w-full items-center gap-3 rounded-xl px-3 transition-all ${
              active ? "ring-1 ring-primary/70 shadow-[0_0_18px_hsl(var(--primary)/0.45)]" : ""
            } ${item.primary ? "ring-1 ring-primary/60" : ""}`}
          >
            <div className="rail-icon-flat flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
              <item.icon className={`h-4 w-4 ${active || item.primary ? "text-primary" : ""}`} />
            </div>
            <span className={`text-sm font-medium truncate ${active || item.primary ? "text-primary" : ""}`}>
              {item.label}
            </span>
            {item.badge && item.badge > 0 ? (
              <span className="ml-auto h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {item.badge}
              </span>
            ) : null}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-display tracking-wider">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      {/* =========================== DESKTOP: vertical glass pill rail =========================== */}
      <aside
        className="desktop-glass-rail hidden lg:flex fixed left-3 top-1/2 -translate-y-1/2 z-50 w-[188px] max-h-[88vh] flex-col items-stretch
                   rounded-[2.25rem] glass-strong border border-primary/30
                   shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6),inset_0_1px_0_hsl(var(--primary)/0.15)]
                   overflow-hidden"
        aria-label="Hlavní navigace"
      >
        {/* scanline texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, hsl(var(--primary)/0.05) 4px, transparent 5px)",
          }}
        />
        {/* edge glow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/70 to-transparent shadow-[0_0_12px_hsl(var(--primary)/0.9)]" />

        {/* Logo */}
        <Link to="/" className="relative mt-4 mb-3 flex items-center justify-center group" aria-label={settings.site_name}>
          <div className="faceted-plate bevel-3d p-2 rounded-xl">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name}
                className="h-7 w-7 object-contain transition-transform group-hover:scale-110 drop-shadow-[0_0_10px_hsl(var(--primary)/0.9)]"
              />
            ) : (
              <Gamepad2 className="h-7 w-7 text-primary transition-transform group-hover:scale-110 drop-shadow-[0_0_10px_hsl(var(--primary)/0.9)]" />
            )}
          </div>
        </Link>

        <div className="relative w-10 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mb-3" />

        {/* Scrollable rail */}
        <nav className="relative flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-stretch gap-1.5 px-2 pb-3">
          {primaryRail.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}

          {userRail.length > 0 && (
            <div className="my-1 mx-2 h-px bg-border/60" />
          )}
          {userRail.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}

          {adminRail.length > 0 && (
            <div className="my-1 mx-2 h-px bg-border/60" />
          )}
          {adminRail.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </nav>

        {/* Footer cluster */}
        <div className="relative w-full flex flex-col items-center gap-2 px-2 py-3 border-t border-border/50">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new Event("shortcuts:open"))}
                aria-label={t("shortcuts.title")}
                className="flex h-10 w-10 items-center justify-center rounded-xl icon-cube-3d"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("shortcuts.title")}</TooltipContent>
          </Tooltip>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-cube-3d">
            <LanguageSwitcher />
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={displayName}
                  className="relative rounded-full border border-primary/40 hover:border-primary transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.45)]"
                >
                  <UserAvatar url={avatarUrl} name={displayName} className="h-10 w-10" />
                  {(unreadMessages > 0 || openTickets > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                className="w-72 bg-card/95 backdrop-blur-xl border-border/80 p-0 overflow-hidden ml-2"
              >
                <div className="relative px-4 pt-5 pb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                  <div className="relative flex items-center gap-3">
                    <UserAvatar url={avatarUrl} name={displayName} className="h-11 w-11 border-primary/30" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-sm truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{email}</p>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/60" />
                <div className="p-1.5 space-y-0.5">
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                  >
                    <div className="flex h-9 w-9 items-center justify-center icon-cube-3d">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{t("nav.profile")}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                  >
                    <div className="flex h-9 w-9 items-center justify-center icon-cube-3d">
                      <Settings className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{t("nav.profileSettings")}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="bg-border/60" />
                <div className="p-1.5 space-y-0.5">
                  {profileMenuItems.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center icon-cube-3d ${item.primary ? "ring-1 ring-primary/60" : ""}`}>
                        <item.icon className={`h-4 w-4 ${item.primary ? "text-primary" : ""}`} />
                      </div>
                      <span className={`flex-1 text-sm font-medium ${item.primary ? "text-primary" : ""}`}>{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                          {item.badge}
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator className="bg-border/60" />
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
          ) : (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <Link
                  to="/auth"
                  aria-label={t("nav.signIn")}
                  className="flex h-10 w-10 items-center justify-center rounded-xl icon-cube-3d ring-1 ring-primary/60"
                >
                  <LogIn className="h-4 w-4 text-primary" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t("nav.signIn")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* =========================== MOBILE: glass top bar =========================== */}
      <header className="lg:hidden sticky top-0 z-50 glass-strong border-b border-primary/30 shadow-[0_4px_30px_-10px_hsl(var(--primary)/0.5)] relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, hsl(var(--primary)/0.05) 4px, transparent 5px)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent shadow-[0_0_12px_hsl(var(--primary)/0.9)]" />
        <div className="container flex h-16 items-center justify-between relative">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative faceted-plate bevel-3d px-2 py-1.5">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings.site_name}
                  className="h-7 w-7 object-contain drop-shadow-[0_0_10px_hsl(var(--primary)/0.9)]"
                />
              ) : (
                <Gamepad2 className="h-7 w-7 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.9)]" />
              )}
            </div>
            <span
              className="font-display font-black text-lg tracking-[0.22em] text-glow-intense glitch"
              data-text={settings.site_name}
            >
              {settings.site_name}
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <GlobalSearch />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground" aria-label="Menu">
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
                  {[...primaryRail, ...userRail, ...adminRail, ...profileMenuItems].map((item) => (
                    <SheetClose asChild key={item.to}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-primary/10 transition-colors"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center icon-cube-3d ${
                            item.primary ? "ring-1 ring-primary/60" : ""
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className={`flex-1 text-sm font-medium ${item.primary ? "text-primary" : ""}`}>
                          {item.label}
                        </span>
                        {item.badge && item.badge > 0 ? (
                          <span className="h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                            {item.badge}
                          </span>
                        ) : null}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                {user ? (
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
                ) : (
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

            {user && (
              <Link to="/profile" className="ml-1 rounded-full border border-border" aria-label={displayName}>
                <UserAvatar url={avatarUrl} name={displayName} className="h-8 w-8" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hidden span to keep NotifBadge import referenced if needed elsewhere */}
      <span className="hidden"><NotifBadge count={0} /></span>
    </TooltipProvider>
  );
}
