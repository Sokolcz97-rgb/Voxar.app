import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotifBadge } from "@/components/NotifBadge";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavPages } from "@/hooks/usePages";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { LogOut, Shield, User as UserIcon, Gamepad2, MessageSquare, LifeBuoy, Keyboard } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name}
                className="h-7 w-7 object-contain transition-transform group-hover:scale-110"
              />
            ) : (
              <>
                <Gamepad2 className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 blur-lg bg-primary/40 -z-10" />
              </>
            )}
          </div>
          <span className="font-display font-bold text-lg tracking-widest text-glow">
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
              {(isAdmin || isEditor) && (
                <Button variant="outline" size="sm" asChild className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
                  <Link to="/admin"><Shield className="h-4 w-4 mr-1" />{t("nav.admin")}</Link>
                </Button>
              )}
              <LanguageSwitcher />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full border border-border relative">
                    <UserIcon className="h-4 w-4" />
                    <NotifBadge count={unreadMessages + openTickets} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-md">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="h-4 w-4 mr-2" />{t("nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/messages")} className="sm:hidden">
                    <MessageSquare className="h-4 w-4 mr-2" />{t("nav.messages")}
                    {unreadMessages > 0 && (
                      <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-1.5 rounded-full">{unreadMessages}</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/tickets")}>
                    <LifeBuoy className="h-4 w-4 mr-2" />{t("nav.tickets")}
                    {openTickets > 0 && (
                      <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-1.5 rounded-full">{openTickets}</span>
                    )}
                  </DropdownMenuItem>
                  {(isAdmin || isEditor) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="text-primary">
                        <Shield className="h-4 w-4 mr-2" />{t("nav.admin")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />{t("nav.signOut")}
                  </DropdownMenuItem>
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
