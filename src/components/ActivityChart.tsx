import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Point = { date: string; label: string; threads: number; posts: number; dms: number };

const DAYS = 30;

const config = {
  threads: { label: "Threads", color: "hsl(var(--primary))" },
  posts: { label: "Posts", color: "hsl(var(--accent))" },
  dms: { label: "DMs", color: "hsl(var(--secondary-foreground))" },
};

export const ActivityChart = ({ userId }: { userId: string }) => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - (DAYS - 1));
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    (async () => {
      const [threadsRes, postsRes, dmsRes] = await Promise.all([
        supabase
          .from("forum_threads")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sinceIso),
        supabase
          .from("forum_posts")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", sinceIso),
        supabase
          .from("messages")
          .select("created_at")
          .eq("sender_id", userId)
          .gte("created_at", sinceIso),
      ]);

      if (cancelled) return;

      const buckets: Record<string, Point> = {};
      const locale = i18n.language === "cs" ? "cs-CZ" : "en-US";
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = {
          date: key,
          label: d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
          threads: 0,
          posts: 0,
          dms: 0,
        };
      }

      const bump = (rows: { created_at: string }[] | null, key: "threads" | "posts" | "dms") => {
        (rows ?? []).forEach((r) => {
          const k = r.created_at.slice(0, 10);
          if (buckets[k]) buckets[k][key] += 1;
        });
      };
      bump(threadsRes.data, "threads");
      bump(postsRes.data, "posts");
      bump(dmsRes.data, "dms");

      setData(Object.values(buckets));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, i18n.language]);

  const localizedConfig = useMemo(
    () => ({
      threads: { ...config.threads, label: t("dashboard.stats.threads") },
      posts: { ...config.posts, label: t("dashboard.stats.posts") },
      dms: { ...config.dms, label: t("dashboard.stats.dms") },
    }),
    [t],
  );

  return (
    <Card className="glass border-border p-6 mb-10">
      <h3 className="font-display text-lg font-bold mb-4">{t("dashboard.activity30d")}</h3>
      <ChartContainer config={localizedConfig} className="h-[260px] w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="g-threads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-posts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-dms" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--secondary-foreground))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--secondary-foreground))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="threads"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#g-threads)"
          />
          <Area
            type="monotone"
            dataKey="posts"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            fill="url(#g-posts)"
          />
          <Area
            type="monotone"
            dataKey="dms"
            stroke="hsl(var(--secondary-foreground))"
            strokeWidth={2}
            fill="url(#g-dms)"
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  );
};
