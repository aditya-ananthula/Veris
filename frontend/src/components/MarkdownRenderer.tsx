import type { ReactNode } from 'react';

/** Lightweight, dependency-free Markdown renderer.
 * Preserves code, math, quotes, lists, links, headings, bold/italic without
 * brittle string replacements. Renders unknown content as escaped text. */
export function MarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;
  const blocks = splitBlocks(text);
  return (
    <>
      {blocks.map((block, i) => renderBlock(block, i))}
    </>
  );
}

function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inCode = false;
  const lines = text.split('\n');
  for (const line of lines) {
    if (/^```/.test(line)) {
      inCode = !inCode;
      current.push(line);
      continue;
    }
    if (inCode) {
      current.push(line);
      continue;
    }
    if (line.trim() === '') {
      if (current.length) { blocks.push(current.join('\n')); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

function renderBlock(block: string, key: number): ReactNode {
  const b = block.trim();
  if (!b) return null;

  // Fenced code block
  if (/^```/.test(b)) {
    const lines = b.split('\n');
    const lang = lines[0].slice(3).trim();
    const code = lines.slice(1, -1).join('\n');
    return (
      <div key={key} className="my-2 overflow-auto rounded-lg border border-slate-700/50 bg-slate-950 p-3 text-left">
        <pre className="m-0 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre break-all"><code>{escapeHtml(code)}</code></pre>
        {lang && <span className="mt-1 block text-[10px] text-slate-500 font-mono">{escapeHtml(lang)}</span>}
      </div>
    );
  }

  // Horizontal rule
  if (/^---$|^___$|^\*\*\*$/.test(b)) return <hr key={key} className="my-3 border-slate-700/50" />;

  // Heading
  const h = b.match(/^(#{1,3})\s+(.*)/);
  if (h) {
    const level = h[1].length;
    const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
    const cls = level === 1 ? 'text-slate-100 font-semibold text-[15px] mb-1' : level === 2 ? 'text-slate-200 font-medium text-[13.5px] mb-1' : 'text-slate-300 font-medium text-[12.5px] mb-1';
    return (<Tag key={key} className={cls}>{renderInline(h[2])}</Tag>);
  }

  // Blockquote
  if (/^>\s/.test(b)) {
    const inner = b.replace(/^>\s*/g, '');
    return (
      <div key={key} className="my-2 border-l-2 border-slate-600 pl-3 ml-1 italic text-slate-400">{renderInline(inner)}</div>
    );
  }

  // List block (consecutive list items)
  if (/^([*\-]|\d+\.)\s/.test(b)) {
    const items = b.split('\n').map((line) => {
      const m = line.match(/^([*\-]|\d+\.)\s+(.*)/s);
      return m ? renderInline(m[2]) : <span key={line}>{renderInline(line)}</span>;
    });
    const tag = /^\d+\./.test(b.split('\n')[0]) ? 'ol' : 'ul';
    const Tag = tag as 'ol' | 'ul';
    return (<Tag key={key} className={`my-2 pl-5 list-${tag === 'ol' ? 'decimal' : 'disc'} space-y-1 text-slate-200 text-sm`}>{items.map((it, i) => (<li key={i}>{it}</li>))}</Tag>);
  }

  // Paragraph
  return (<p key={key} className="my-2 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{renderInline(b)}</p>);
}

type Repl = (m: string, g1?: string, g2?: string) => ReactNode;
const INLINE_TOKENS: [RegExp, Repl][] = [
  [/\$\$([\s\S]*?)\$\$/g, (m) => (<span key={m} className="font-mono text-cyan-200">{escapeHtml(m)}</span>)],
  [/\$([^\s$][\s\S]*?[^\s$])\$/g, (m) => (<span key={m} className="font-mono text-cyan-200">{escapeHtml(m.slice(1, -1))}</span>)],
  [/`([^`]+)`/g, (m) => (<code key={m} className="font-mono text-cyan-300 bg-slate-800/50 px-1 py-0.5 rounded">{escapeHtml(m.slice(1, -1))}</code>)],
  [/\*\*([\s\S]+?)\*\*/g, (m) => (<strong key={m} className="text-slate-100">{renderInline(m.slice(2, -2))}</strong>)],
  [/\*([\s\S]+?)\*/g, (m) => (<em key={m} className="text-slate-300">{renderInline(m.slice(1, -1))}</em>)],
  [/\[([^\]]+)\]\(([^)]+)\)/g, (m, g1, g2) => (<a key={m} href={g2 ?? ''} target="_blank" rel="noopener noreferrer" className="text-accent-400 underline underline-offset-2 hover:text-accent-300">{renderInline(g1 ?? '')}</a>)],
];

function renderInline(text: string): ReactNode {
  let parts: Array<string | ReactNode> = [text];
  for (const [regex, repl] of INLINE_TOKENS) {
    const next: Array<string | ReactNode> = [];
    for (const part of parts) {
      if (typeof part !== 'string') { next.push(part); continue; }
      let last = 0;
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((match = regex.exec(part)) !== null) {
        next.push(part.slice(last, match.index));
        next.push(repl(match[0], match[1], match[2]));
        last = match.index + match[0].length;
      }
      next.push(part.slice(last));
    }
    parts = next;
  }
  return parts.map((p) => typeof p === 'string' ? escapeText(p) : p);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
