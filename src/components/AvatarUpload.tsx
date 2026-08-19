import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { BackgroundRemoverDialog } from "@/components/BackgroundRemoverDialog";

interface Props {
  userId: string;
  avatarUrl: string | null;
  fallback: string;
  onChange: (url: string | null) => void;
}

export function AvatarUpload({ userId, avatarUrl, fallback, onChange }: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("avatar.notImage"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("avatar.tooLarge"));
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
    setUploading(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    onChange(url);
    toast.success(t("avatar.uploaded"));
  };

  const remove = async () => {
    setUploading(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", userId);
    setUploading(false);
    if (error) return toast.error(error.message);
    onChange(null);
    toast.success(t("avatar.removed"));
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar className="h-20 w-20 border-2 border-primary/40 shadow-[var(--glow-soft)]">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="avatar" />}
          <AvatarFallback className="bg-primary/10 text-primary font-display font-bold text-xl">
            {fallback}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="border-primary/40 text-primary hover:bg-primary/10"
        >
          <Camera className="h-4 w-4 mr-2" /> {t("avatar.upload")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setBgOpen(true)}
          disabled={uploading}
          className="border-primary/40 text-primary hover:bg-primary/10"
        >
          <Eraser className="h-4 w-4 mr-2" /> Odstranit pozadí
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={uploading}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" /> {t("avatar.remove")}
          </Button>
        )}
      </div>
      <BackgroundRemoverDialog open={bgOpen} onOpenChange={setBgOpen} onApply={(file) => upload(file)} />
    </div>
  );
}

