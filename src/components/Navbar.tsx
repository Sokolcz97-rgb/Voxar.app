import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, User as UserIcon, Gamepad2, MessageSquare, LifeBuoy } from "lucide-react";
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <Gamepad2 className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 blur-lg bg-primary/40 -z-10" />
          </div>
          <span className="font-display font-bold text-lg tracking-widest text-glow">
            NEONHUB
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/forum">Fórum</Link>
          </Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/messages">Zprávy</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              {(isAdmin || isEditor) && (
                <Button variant="outline" size="sm" asChild className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
                  <Link to="/admin"><Shield className="h-4 w-4 mr-1" />Admin</Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full border border-border">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-md">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="h-4 w-4 mr-2" />Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/messages")} className="sm:hidden">
                    <MessageSquare className="h-4 w-4 mr-2" />Zprávy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/tickets")}>
                    <LifeBuoy className="h-4 w-4 mr-2" />Tickety
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />Odhlásit se
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="default" size="sm" asChild className="bg-primary text-primary-foreground hover:bg-primary-glow shadow-[var(--glow-soft)]">
              <Link to="/auth">Přihlásit</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
