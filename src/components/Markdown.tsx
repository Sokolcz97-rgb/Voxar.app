import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-headings:font-display prose-headings:tracking-wide
      prose-a:text-primary hover:prose-a:text-primary-glow
      prose-code:text-primary prose-code:bg-secondary/60 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-secondary/60 prose-pre:border prose-pre:border-border
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
      prose-strong:text-foreground prose-hr:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
