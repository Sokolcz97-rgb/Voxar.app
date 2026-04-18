import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { Block } from "./types";

const alignClass = (a: string) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
const flexAlign = (a: string) =>
  a === "center" ? "justify-center" : a === "right" ? "justify-end" : "justify-start";

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
      return (
        <p className={`text-base text-foreground/90 leading-relaxed whitespace-pre-wrap ${alignClass(block.align)}`}>
          {block.text}
        </p>
      );
    case "image":
      return (
        <img
          src={block.src}
          alt={block.alt}
          loading="lazy"
          className={`max-w-full h-auto mx-auto ${block.rounded ? "rounded-xl" : ""}`}
        />
      );
    case "button": {
      const isExternal = /^https?:\/\//.test(block.href);
      return (
        <div className={`flex ${flexAlign(block.align)}`}>
          <Button asChild variant={block.variant}>
            {isExternal ? (
              <a href={block.href} target="_blank" rel="noopener noreferrer">{block.label}</a>
            ) : (
              <Link to={block.href || "#"}>{block.label}</Link>
            )}
          </Button>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: `${block.height}px` }} aria-hidden />;
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
