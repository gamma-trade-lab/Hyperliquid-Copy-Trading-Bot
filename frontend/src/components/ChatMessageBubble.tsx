// components/ChatMessageBubble.tsx
import { Message } from "ai";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageBubbleProps {
  message: Message;
  aiEmoji?: string;
  sources?: any[];
}

export function ChatMessageBubble({ message, aiEmoji = "🤖", sources = [] }: ChatMessageBubbleProps) {
  const [formattedContent, setFormattedContent] = useState(message.content);

  useEffect(() => {
    // Process any special content formatting if needed
    let content = message.content;
    
    // Handle code blocks
    content = content.replace(/```(.*?)```/, (match, code) => {
      return `\n\`\`\`\n${code.trim()}\n\`\`\`\n`;
    });

    // Handle market data
    if (content.includes("$") && !content.includes("```")) {
      content = content.replace(/\$[\d.]+/g, (match) => `**${match}**`);
    }

    setFormattedContent(content);
  }, [message.content]);

  return (
    <div
      className={`${
        message.role === "user" ? "flex-row-reverse" : "flex-row"
      } flex gap-2 mb-4`}
    >
      <div
        className={`${
          message.role === "user"
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 text-gray-900 rounded-bl-none"
        } rounded-2xl px-4 py-2 max-w-[80%] overflow-hidden`}
      >
        {message.role === "assistant" && (
          <div className="mb-1 text-sm opacity-50">
            {aiEmoji} JENNA AI
          </div>
        )}
        
        <div className="prose max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              pre: ({ children }) => (
                <pre className="bg-gray-800 text-gray-100 rounded p-2 overflow-x-auto">
                  {children}
                </pre>
              ),
              code: ({ children }) => (
                <code className="bg-gray-800 text-gray-100 rounded px-1">
                  {children}
                </code>
              ),
            }}
          >
            {formattedContent}
          </ReactMarkdown>
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-2 text-sm opacity-50">
            Sources:
            <ul className="list-disc list-inside">
              {sources.map((source, i) => (
                <li key={i}>{source.title || source.url}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}