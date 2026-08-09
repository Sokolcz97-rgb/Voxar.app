import DOMPurify from "isomorphic-dompurify";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import type { Block } from "./types";
import { Shortcode } from "./shortcodes";

const alignClass = (a: string) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
const flexAlign = (a: string) =>
  a === "center" ? "justify-center" : a === "right" ? "justify-end" : "justify-start";

const sanitizeConfig = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "src", "title", "referrerpolicy"],
};

const youtubeId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};
const vimeoId = (url: string) => {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
};

function VideoEmbed({ url, ratio }: { url: string; ratio: string }) {
  const ratioClass = ratio === "4:3" ? "aspect-[4/3]" : ratio === "1:1" ? "aspect-square" : "aspect-video";
  const yt = youtubeId(url);
  const vm = vimeoId(url);
  if (yt) {
    return (
      <div className={`${ratioClass} w-full rounded-lg overflow-hidden border border-border`}>
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`}
          title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  if (vm) {
    return (
      <div className={`${ratioClass} w-full rounded-lg overflow-hidden border border-border`}>
        <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vm}`} title="Vimeo"
          allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return (
      <video className={`${ratioClass} w-full rounded-lg border border-border bg-black`} src={url} controls />
    );
  }
  return <div className="p-4 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive">
    Nepodporovaná URL videa: {url}
  </div>;
}

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const cls = `font-display font-black ${alignClass(block.align)} ${
        block.level === 1 ? "text-4xl md:text-6xl" : block.level === 2 ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"
      }`;
      if (block.level === 1) return <h1 className={cls}>{block.text}</h1>;
      if (block.level === 2) return <h2 className={cls}>{block.text}</h2>;
      return <h3 className={cls}>{block.text}</h3>;
    }
    case "text":
      return <p className={`text-base text-foreground/90 leading-relaxed whitespace-pre-wrap ${alignClass(block.align)}`}>{block.text}</p>;
    case "image":
      return <img decoding="async" src={block.src} alt={block.alt} loading="lazy" className={`max-w-full h-auto mx-auto ${block.rounded ? "rounded-xl" : ""}`} />;
    case "button": {
      const isExternal = /^https?:\/\//.test(block.href);
      return (
        <div className={`flex ${flexAlign(block.align)}`}>
          <Button asChild variant={block.variant}>
            {isExternal
              ? <a href={block.href} target="_blank" rel="noopener noreferrer">{block.label}</a>
              : <Link to={block.href || "#"}>{block.label}</Link>}
          </Button>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: `${block.height}px` }} aria-hidden />;
    case "divider": {
      if (block.style === "glow") {
        return <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_10px_hsl(var(--primary))]" />;
      }
      const border = block.style === "dashed" ? "border-dashed" : "border-solid";
      return <hr className={`border-t ${border} border-border`} />;
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-5 py-2 italic">
          <p className="text-lg text-foreground/90">"{block.text}"</p>
          {block.author && <footer className="text-sm text-muted-foreground mt-2 not-italic">— {block.author}</footer>}
        </blockquote>
      );
    case "video":
      return <VideoEmbed url={block.url} ratio={block.ratio} />;
    case "html": {
      const safe = DOMPurify.sanitize(block.html, sanitizeConfig);
      return <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safe }} />;
    }
    case "shortcode":
      return <Shortcode code={block.code} />;
    case "accordion":
      return (
        <Accordion type="single" collapsible className="w-full">
          {block.items.map((it) => (
            <AccordionItem key={it.id} value={it.id}>
              <AccordionTrigger>{it.title}</AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap">{it.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    case "cards": {
      const cols = block.columns === 2 ? "md:grid-cols-2" : block.columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
      return (
        <div className={`grid grid-cols-1 ${cols} gap-4`}>
          {block.items.map((it) => {
            const Icon = (Icons as any)[it.icon] || Icons.Sparkles;
            return (
              <Card key={it.id} className="glass border-border p-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg">{it.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{it.text}</p>
              </Card>
            );
          })}
        </div>
      );
    }
    case "section": {
      const bg =
        block.background === "primary" ? "bg-primary/10" :
        block.background === "accent" ? "bg-accent/10" :
        block.background === "muted" ? "bg-muted/40" :
        block.background === "gradient" ? "bg-gradient-to-br from-primary/15 via-background to-accent/15" :
        "";
      return (
        <section className={`rounded-xl ${bg}`} style={{ paddingTop: block.paddingY, paddingBottom: block.paddingY }}>
          <div className="container max-w-4xl px-6">
            <div className="flex flex-col gap-6">
              {block.children.map((b) => <BlockRenderer key={b.id} block={b} />)}
            </div>
          </div>
        </section>
      );
    }
    case "columns2":
    case "columns3": {
      const cols = block.type === "columns2" ? "md:grid-cols-2" : "md:grid-cols-3";
      return (
        <div className={`grid grid-cols-1 ${cols} gap-6`}>
          {block.columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-4">
              {col.map((b) => <BlockRenderer key={b.id} block={b} />)}
            </div>
          ))}
        </div>
      );
    }
  }
}

export function BlocksRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((b) => <BlockRenderer key={b.id} block={b} />)}
    </div>
  );
}
