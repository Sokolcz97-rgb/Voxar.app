import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type SEOProps = {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
};

const SITE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const JSONLD_ID = "seo-jsonld";

export function SEO({
  title,
  description,
  image,
  type = "website",
  jsonLd,
  noindex,
}: SEOProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    const safeTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = safeTitle;

    if (description) {
      const safeDesc =
        description.length > 160 ? description.slice(0, 157) + "…" : description;
      setMeta("name", "description", safeDesc);
      setMeta("property", "og:description", safeDesc);
      setMeta("name", "twitter:description", safeDesc);
    }

    setMeta("property", "og:title", safeTitle);
    setMeta("property", "og:type", type);
    setMeta("name", "twitter:title", safeTitle);
    setMeta("name", "twitter:card", "summary_large_image");

    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }

    const url = `${SITE_ORIGIN}${pathname}`;
    setMeta("property", "og:url", url);
    setLink("canonical", url);

    setMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow",
    );

    // JSON-LD
    const existing = document.getElementById(JSONLD_ID);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = JSONLD_ID;
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, image, type, jsonLd, noindex, pathname]);

  return null;
}
