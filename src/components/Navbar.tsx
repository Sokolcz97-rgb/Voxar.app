import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
  Radio,
  Target,
  LogIn,
  Download,
  ShoppingBag,
  Eraser,
} from "lucide-react";
import { BackgroundRemoverDialog } from "@/components/BackgroundRemoverDialog";
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

type NavItem = {
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
  const [bgRemoverOpen, setBgRemoverOpen] = useState(false);

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

  const primaryNav: NavItem[] = [
    { to: "/forum", label: t("nav.forum"), icon: MessageCircle },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/servery", label: "Servery", icon: Server },
    { to: "/novinky", label: "Novinky", icon: Newspaper },
    { to: "/live", label: "Live Now", icon: Radio },
    { to: "/kontrakty", label: "Bounty Board", icon: Target },
    { to: "/obchod", label: "Obchod", icon: ShoppingBag },
    ...navPages.map((p) => ({ to: `/${p.slug}`, label: p.nav_label, icon: ChevronRight })),
  ];

  const secondaryNav: NavItem[] = user
    ? [
        { to: "/messages", label: t("nav.messages"), icon: MessageSquare, badge: unreadMessages },
        { to: "/desktop", label: "Ke stažení", icon: Download },
      ]
    : [{ to: "/desktop", label: "Ke stažení", icon: Download }];

  const profileMenuItems: NavItem[] = user
    ? [
        { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { to: "/tickets", label: t("nav.tickets"), icon: LifeBuoy, badge: openTickets },
        ...(isAdmin || isEditor ? [{ to: "/admin", label: t("nav.admin"), icon: Shield, primary: true }] : []),
      ]
    : [];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const allMobileItems = [...primaryNav, ...secondaryNav, ...profileMenuItems];

  const compactNavCount = 3;

  return (
    <header className="web-nav sticky top-0 z-50">
      <div className="container flex h-16 items-center gap-2 lg:gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-1.5 shrink-0" aria-label={settings.site_name || "StudioVoxario"}>
          <span className="font-display font-black text-sm sm:text-base tracking-[0.12em] uppercase text-primary">
            {settings.site_name || "StudioVoxario"}
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-0.5 md:gap-1 ml-1 lg:ml-2 min-w-0 flex-nowrap" aria-label="Hlavní navigace">
          {primaryNav.map((item, idx) => (
            <Link
              key={item.to}
              to={item.to}
              data-active={isActive(item.to)}
              className={cn(
                "web-navlink px-2 py-1.5 text-xs lg:text-sm font-medium text-muted-foreground leading-relaxed whitespace-nowrap",
                idx >= compactNavCount && "hidden lg:flex"
              )}
            >
              {item.label}
            </Link>
          ))}

          {primaryNav.length > compactNavCount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="web-navlink px-2 py-1.5 text-xs lg:text-sm font-medium text-muted-foreground leading-relaxed whitespace-nowrap hover:text-primary lg:hidden">
                  Více
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[10rem] p-1">
                {primaryNav.slice(compactNavCount).map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="cursor-pointer">
                    <Link
                      to={item.to}
                      data-active={isActive(item.to)}
                      className="web-navlink flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground leading-relaxed"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <GlobalSearch />

          <button
            onClick={() => window.dispatchEvent(new Event("shortcuts:open"))}
            aria-label={t("shortcuts.title")}
            className="hidden xl:flex h-9 w-9 items-center justify-center border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            <Link
              to="/desktop"
              data-active={isActive("/desktop")}
              className="web-navlink relative px-2 py-1.5 text-xs lg:text-sm font-medium text-muted-foreground whitespace-nowrap"
              aria-label="Ke stažení"
            >
              <span className="hidden lg:inline">Ke stažení</span>
              <Download className="h-4 w-4 lg:hidden" />
            </Link>
          </div>

          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          {/* Account */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label={displayName} className="relative rounded-full border border-primary/30 hover:border-primary/70 transition-colors">
                  <UserAvatar url={avatarUrl} name={displayName} userId={user?.id} className="h-9 w-9" />
                  {(unreadMessages > 0 || openTickets > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <UserAvatar url={avatarUrl} name={displayName} userId={user?.id} className="h-10 w-10 border-primary/30" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/60" />
                <div className="p-1">
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-3 px-3 py-2.5 cursor-pointer">
                    <UserIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{t("nav.profile")}</span>
                  </DropdownMenuItem>
                  {profileMenuItems.map((item) => (
                    <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)} className="gap-3 px-3 py-2.5 cursor-pointer">
                      <item.icon className={`h-4 w-4 ${item.primary ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="flex-1 text-sm">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                          {item.badge}
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setBgRemoverOpen(true);
                    }}
                    className="gap-3 px-3 py-2.5 cursor-pointer"
                  >
                    <Eraser className="h-4 w-4 text-primary" />
                    <span className="text-sm">Odstranit pozadí z obrázku</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="bg-border/60" />
                <div className="p-1">
                  <DropdownMenuItem onClick={handleSignOut} className="gap-3 px-3 py-2.5 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">{t("nav.signOut")}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="web-cut hidden sm:inline-flex text-xs px-3 py-1.5">
              <Link to="/auth">
                <LogIn className="h-4 w-4 mr-1.5" />
                {t("nav.signIn")}
              </Link>
            </Button>
          )}

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden min-h-11 min-w-11" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-0 flex flex-col rounded-none">
              <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left">
                <SheetTitle className="font-display tracking-[0.18em]">{settings.site_name}</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-2" aria-label="Mobilní navigace">
                {allMobileItems.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 px-3 py-3 min-h-11 border-b border-border/40 hover:bg-primary/10 transition-colors"
                    >
                      <item.icon className={`h-4 w-4 ${item.primary ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`flex-1 text-sm font-medium leading-relaxed ${item.primary ? "text-primary" : ""}`}>
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
              <div className="p-3 border-t border-border/60 flex items-center gap-2">
                <LanguageSwitcher />
                {user ? (
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={handleSignOut} className="flex-1 justify-start gap-2 text-destructive">
                      <LogOut className="h-4 w-4" />
                      {t("nav.signOut")}
                    </Button>
                  </SheetClose>
                ) : (
                  <SheetClose asChild>
                    <Button asChild className="flex-1 web-cut">
                      <Link to="/auth">
                        <LogIn className="h-4 w-4 mr-1.5" />
                        {t("nav.signIn")}
                      </Link>
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <BackgroundRemoverDialog open={bgRemoverOpen} onOpenChange={setBgRemoverOpen} />
    </header>
  );

}
