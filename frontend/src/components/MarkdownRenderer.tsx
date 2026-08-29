import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Lightweight, zero-dependency Markdown formatter for chat messages and AI outputs.
 * Parses and auto-renders:
 * - **bold text** -> <strong className="font-bold">
 * - *italic text* -> <em className="italic">
 * - `inline code` -> <code className="...">
 * - Bullet lists (- or *)
 * - Paragraph / newline breaks
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  isUser = false 
}) => {
  if (!content) return null;

  const renderInline = (text: string, lineKey: string | number) => {
    // Match `inline code`, **bold text**, or *italic text*
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Inline code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const codeText = part.slice(1, -1);
        return (
          <code
            key={`${lineKey}-code-${index}`}
            className={`font-mono text-[11px] px-1.5 py-0.5 rounded border inline-block my-0.5 ${
              isUser
                ? 'bg-sky-700/80 text-white border-sky-500/50'
                : 'bg-slate-100 text-sky-800 border-slate-200 font-semibold'
            }`}
          >
            {codeText}
          </code>
        );
      }

      // Bold text: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const boldText = part.slice(2, -2);
        return (
          <strong
            key={`${lineKey}-bold-${index}`}
            className={`font-bold ${isUser ? 'text-white font-extrabold' : 'text-slate-900 font-bold'}`}
          >
            {boldText}
          </strong>
        );
      }

      // Italic text: *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        const italicText = part.slice(1, -1);
        return (
          <em
            key={`${lineKey}-italic-${index}`}
            className="italic opacity-90"
          >
            {italicText}
          </em>
        );
      }

      return <span key={`${lineKey}-text-${index}`}>{part}</span>;
    });
  };

  const lines = content.split('\n');

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }

        // Bullet point list item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.slice(2);
          return (
            <div key={lineIdx} className="flex items-start space-x-2 pl-1.5">
              <span className={`text-xs select-none leading-relaxed ${isUser ? 'text-sky-200' : 'text-sky-600 font-bold'}`}>
                •
              </span>
              <div className="flex-1 leading-relaxed">
                {renderInline(bulletText, lineIdx)}
              </div>
            </div>
          );
        }

        return (
          <div key={lineIdx} className="leading-relaxed">
            {renderInline(line, lineIdx)}
          </div>
        );
      })}
    </div>
  );
};
