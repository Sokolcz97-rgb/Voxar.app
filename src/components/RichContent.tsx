import DOMPurify from "dompurify";
import { useMemo } from "react";
import { Markdown } from "@/components/Markdown";

interface Props {
  content: string;
  className?: string;
}

// Detect TipTap/HTML content (starts with a tag) vs legacy markdown/plaintext.
const looksLikeHtml = (s: string) => /^\s*<(?:p|h[1-6]|ul|ol|blockquote|pre|figure|img|video|a|div|span|strong|em|u)\b/i.test(s);

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p","br","strong","em","u","s","a","img","video","source",
    "h1","h2","h3","ul","ol","li","blockquote","pre","code","hr","span","div","figure","figcaption",
  ],
  ALLOWED_ATTR: [
    "href","target","rel","src","alt","title","controls","poster","type",
    "class","style","data-attachment","data-name","data-mime","data-size","download",
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/|\/)/i,
};

export function RichContent({ content, className }: Props) {
  const html = useMemo(() => {
    if (!content) return "";
    if (!looksLikeHtml(content)) return null;
    return DOMPurify.sanitize(content, PURIFY_CONFIG) as string;
  }, [content]);

  if (html === null) {
    return <Markdown content={content} />;
  }

  return (
    <div
      className={className ?? "rich-content prose prose-invert prose-sm max-w-none break-words"}
      // sanitized via DOMPurify above
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
