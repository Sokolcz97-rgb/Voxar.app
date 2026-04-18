import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const AccountSettings = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [changing, setChanging] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast({ title: t("account.pwTooShort"), variant: "destructive" });
      return;
    }
    if (pw !== pw2) {
      toast({ title: t("account.pwMismatch"), variant: "destructive" });
      return;
    }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setChanging(false);
    if (error) {
      toast({ title: t("account.pwFailed"), description: error.message, variant: "destructive" });
      return;
    }
    setPw(""); setPw2("");
    toast({ title: t("account.pwChanged") });
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-account");
    if (error || (data as { error?: string })?.error) {
      setDeleting(false);
      toast({
        title: t("account.deleteFailed"),
        description: error?.message || (data as { error?: string })?.error,
        variant: "destructive",
      });
      return;
    }
    await signOut();
    toast({ title: t("account.deleted") });
    navigate("/");
  };

  return (
    <div className="pt-4 border-t border-border space-y-6">
      <div>
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />{t("account.changePassword")}
        </h3>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pw">{t("account.newPassword")}</Label>
            <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">{t("account.confirmPassword")}</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={changing || !pw || !pw2} variant="outline" className="border-border">
            {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("account.savePassword")}
          </Button>
        </form>
      </div>

      <div>
        <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />{t("account.dangerZone")}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{t("account.deleteDesc")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{t("account.deleteAccount")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("account.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("account.confirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("account.typeToConfirm")}</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== "DELETE" || deleting}
                onClick={(e) => { e.preventDefault(); deleteAccount(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("account.deleteAccount")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
