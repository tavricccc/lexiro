import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Renders the small Markdown subset the AI prompts actually ask for: headings,
 * paragraphs, bullet and numbered lists, bold, italic and inline code.
 *
 * It builds React elements rather than HTML, so model output can never inject
 * markup, and it keeps the app free of a Markdown dependency it would otherwise
 * use in exactly one place.
 */
export function Markdown({
  className,
  content,
}: {
  className?: string;
  content: string;
}) {
  return (
    <div className={cn("markdown-body", className)}>
      {renderBlocks(content)}
    </div>
  );
}

function renderBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/gu, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>{renderInline(paragraph.join(" "))}</p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => (
      <li key={index}>{renderInline(item)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`l-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`l-${blocks.length}`}>{items}</ul>
      ),
    );
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/u);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = renderInline(heading[2]);
      const key = `h-${blocks.length}`;
      blocks.push(
        level === 1 ? (
          <h1 key={key}>{text}</h1>
        ) : level === 2 ? (
          <h2 key={key}>{text}</h2>
        ) : level === 3 ? (
          <h3 key={key}>{text}</h3>
        ) : (
          <h4 key={key}>{text}</h4>
        ),
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/u);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/u);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { items: [], ordered };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/gu;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_PATTERN).filter(Boolean).map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**"))
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={index}>{token.slice(1, -1)}</code>;
    if (token.startsWith("*") && token.endsWith("*"))
      return <em key={index}>{token.slice(1, -1)}</em>;
    return <span key={index}>{token}</span>;
  });
}
