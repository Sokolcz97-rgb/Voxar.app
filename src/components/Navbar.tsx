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
  Wrench,
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
  History,
  MessageCircle,
  Radio,
  Target,
  LogIn,
  Download,
  ShoppingBag,
  Eraser,
  Sparkles,
  Globe,
  ShieldCheck,
  Swords,
  Users,
  ChevronDown,
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
    { to: "/obchod", label: "Obchod", icon: ShoppingBag },
    { to: "/forum", label: t("nav.forum"), icon: MessageCircle },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/servery", label: "Servery", icon: Server },
    { to: "/novinky", label: "Novinky", icon: Newspaper },
    { to: "/verze", label: "Verze", icon: History },
    { to: "/live", label: "Live Now", icon: Radio },
    { to: "/kontrakty", label: "Bounty Board", icon: Target },
    ...navPages.map((p) => ({ to: `/${p.slug}`, label: p.nav_label, icon: ChevronRight })),
  ];

  const secondaryNav: NavItem[] = user
    ? [
        ...(isAdmin ? [{ to: "/ai", label: "Voxario Tools", icon: Wrench, primary: true }] : []),
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

  // Hlavní navigace seskupená podle toho, co platforma nabízí.
  type MenuEntry = { to: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; external?: boolean };
  const navGroups: { label: string; items: MenuEntry[] }[] = [
    {
      label: "Platforma",
      items: [
        { to: "/app", label: "Voxar.app", desc: "Komunita, hlas, události a obchod v jednom okně", icon: Sparkles },
        { to: "/browser", label: "VoxarioBrowser", desc: "Herní prohlížeč s ochranou soukromí", icon: Globe },
        { to: "/desktop", label: "VoxarioProtect", desc: "Posílení Windows Defenderu a hlídání systému", icon: ShieldCheck },
        { to: "/ashes", label: "Ashes of Eryon", desc: "Temné fantasy RPG – roadmapa a první test", icon: Swords },
        { to: "/desktop", label: "Ke stažení", desc: "Ověřené instalátory pro Windows", icon: Download },
      ],
    },
    {
      label: "Komunita",
      items: [
        { to: "/forum", label: t("nav.forum"), desc: "Diskuze, návody a nápady", icon: MessageCircle },
        { to: "/live", label: "Live", desc: "Kdo právě streamuje", icon: Radio },
        { to: "/leaderboard", label: t("nav.leaderboard"), desc: "Nejaktivnější hráči", icon: Trophy },
        { to: "/servery", label: "Servery", desc: "Herní servery komunity", icon: Server },
        { to: "/kontrakty", label: "Bounty Board", desc: "Kontrakty a odměny", icon: Target },
        ...navPages.map((page) => ({ to: `/${page.slug}`, label: page.nav_label, desc: "Stránka komunity", icon: ChevronRight })),
      ],
    },
    {
      label: "Novinky",
      items: [
        { to: "/novinky", label: "Novinky", desc: "Co je nového na platformě", icon: Newspaper },
        { to: "/verze", label: "Historie verzí", desc: "Transparentní seznam změn", icon: History },
      ],
    },
  ];
  const groupActive = (items: MenuEntry[]) => items.some((item) => isActive(item.to));

  const navLinkBase =
    "web-navlink px-1.5 py-1.5 text-sm lg:text-base font-medium text-muted-foreground leading-relaxed whitespace-nowrap";

  return (
    <header className="holo-nav sticky top-0 z-50">
      <div className="container flex h-[68px] items-center gap-2 lg:gap-4">
        <Link to="/" className="holo-brand flex items-center gap-2.5 shrink-0" aria-label={settings.site_name || "StudioVoxario"}>
          <img src="/vox/brand/voxar-logo.webp" alt="" className="h-9 w-9 object-contain" />
          <span className="hidden sm:flex flex-col leading-none">
            <span className="font-display font-bold text-[15px] tracking-[0.2em] uppercase">
              <span className="text-primary">Studio</span>Voxario
            </span>
            <span className="mt-1 text-[9.5px] tracking-[0.32em] uppercase text-muted-foreground">Herní platforma</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2 min-w-0" aria-label="Hlavní navigace">
          {navGroups.map((group) => (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger asChild>
                <button className="holo-navlink" data-active={groupActive(group.items)}>
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={10} className="holo-mega w-[340px] p-2">
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.label} asChild className="cursor-pointer rounded-lg p-0 focus:bg-transparent">
                    <Link to={item.to} className="holo-mega-item">
                      <span className="holo-mega-icon"><item.icon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="block text-xs text-muted-foreground truncate">{item.desc}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          <Link to="/obchod" className="holo-navlink" data-active={isActive("/obchod")}>Obchod</Link>
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <GlobalSearch />

          <button
            onClick={() => window.dispatchEvent(new Event("shortcuts:open"))}
            aria-label={t("shortcuts.title")}
            className="hidden xl:flex h-9 w-9 items-center justify-center border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {isAdmin && (
              <Link
                to="/ai"
                data-active={isActive("/ai")}
                className={cn(navLinkBase, "relative text-primary")}
                aria-label="Voxario Tools"
              >
                <span className="hidden xl:inline">Voxario Tools</span>
                <Wrench className="h-4 w-4 xl:hidden" />
              </Link>
            )}
            <Link to="/desktop" className="holo-nav-cta" aria-label="Ke stažení">
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">Ke stažení</span>
            </Link>
          </div>

          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

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
            <Button asChild size="sm" className="holo-btn-primary hidden sm:inline-flex h-10 px-4 rounded-[10px]">
              <Link to="/auth" aria-label={t("nav.signIn")}>
                <LogIn className="h-4 w-4" />
                <span>{t("nav.signIn")}</span>
              </Link>
            </Button>
          )}

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