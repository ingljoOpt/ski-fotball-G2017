import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ text }: { text: string }) {
  return <div className="markdown-content">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      img: ({ alt }) => <span>[Bilde vises ikke{alt ? `: ${alt}` : ""}]</span>,
    }}>{text}</ReactMarkdown>
  </div>;
}
