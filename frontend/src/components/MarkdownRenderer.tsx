import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function MarkdownRenderer({text}:{text:string}) {
 return <ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml components={{
 table:({children})=><div className="markdown-table" tabIndex={0} aria-label="Scrollable answer table"><table>{children}</table></div>,
 a:({href,children})=>href?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>
 }}>{text}</ReactMarkdown>;
}
