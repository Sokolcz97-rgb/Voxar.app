import { useTranslation } from "react-i18next";
import { Ban } from "lucide-react";
import { Card } from "@/components/ui/card";

export const BannedNotice = () => {
  const { t } = useTranslation();
  return (
    <Card className="glass border-destructive/50 p-4 flex items-start gap-3 bg-destructive/5">
      <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <div className="font-display font-bold text-destructive">{t("banned.title")}</div>
        <p className="text-sm text-muted-foreground mt-1">{t("banned.desc")}</p>
      </div>
    </Card>
  );
};
