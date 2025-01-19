// components/ChatWindow.tsx
"use client";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useChat } from "ai/react";
import { useRef, useState, ReactElement } from "react";
import type { FormEvent } from "react";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "./IntermediateStep";


interface ChatWindowProps {
  endpoint: string;
  emptyStateComponent: ReactElement;
  placeholder?: string;
  titleText?: string;
  emoji?: string;
  showIntermediateStepsToggle?: boolean;
  walletAddress?: string;
}

export function ChatWindow({
  endpoint,
  emptyStateComponent,
  placeholder = "Ask Jenna about Solana...",
  titleText = "JENNA AI",
  emoji = "🤖",
  showIntermediateStepsToggle = true,
  walletAddress,
}: ChatWindowProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(false);
  const [intermediateStepsLoading, setIntermediateStepsLoading] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chatEndpointIsLoading,
    setMessages,
  } = useChat({
    api: endpoint,
    onResponse(response) {
      // Handle response headers for sources if needed
      const sourcesHeader = response.headers.get("x-sources");
      if (sourcesHeader) {
        // Process sources if needed
      }
    },
    body: {
      walletAddress, // Include wallet address in requests
    },
    onError: (e) => {
      toast(e.message, {
        theme: "dark",
      });
    },
  });

  const processMarketCommand = async (input: string) => {
    try {
      if (input.toLowerCase().includes("price")) {
        const tokenSymbol = input.split(" ").pop()?.toUpperCase();
        if (tokenSymbol) {
          const price = await getTokenPrice(tokenSymbol);
          return `Current price of ${tokenSymbol}: $${price}`;
        }
      }
      if (input.toLowerCase().includes("trending")) {
        const trending = await getBirdeyeTrending();
        return `Trending tokens:\n${trending.map((t: any) => 
          `${t.symbol}: $${t.price}`).join("\n")}`;
      }
      return null;
    } catch (error) {
      console.error("Market command error:", error);
      return null;
    }
  };

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      // First check for market commands
      const marketResponse = await processMarketCommand(input);
      if (marketResponse) {
        setMessages([
          ...messages,
          { id: messages.length.toString(), role: "user", content: input },
          { id: (messages.length + 1).toString(), role: "assistant", content: marketResponse },
        ]);
        setInput("");
        return;
      }

      // Otherwise, proceed with normal chat processing
      if (messageContainerRef.current) {
        messageContainerRef.current.classList.add("grow");
      }

      if (chatEndpointIsLoading || intermediateStepsLoading) return;

      if (!showIntermediateSteps) {
        handleSubmit(e);
      } else {
        setIntermediateStepsLoading(true);
        // Process with intermediate steps...
        // Add your intermediate steps logic here
        setIntermediateStepsLoading(false);
      }
    } catch (error) {
      toast((error as Error).message, {
        theme: "dark",
      });
    }
  }

  return (
    <div className="flex flex-col items-center p-4 md:p-8 rounded grow overflow-hidden border">
      <h2 className="text-2xl font-bold mb-4">
        {emoji} {titleText}
      </h2>

      {/* Messages Container */}
      <div
        className="flex flex-col-reverse w-full mb-4 overflow-auto transition-[flex-grow] ease-in-out"
        ref={messageContainerRef}
      >
        {messages.length === 0 ? (
          emptyStateComponent
        ) : (
          [...messages].reverse().map((m) => (
            m.role === "system" ? (
              <IntermediateStep key={m.id} message={m} />
            ) : (
              <ChatMessageBubble
                key={m.id}
                message={m}
                aiEmoji={emoji}
                sources={[]}
              />
            )
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="flex w-full flex-col">
        {showIntermediateStepsToggle && (
          <div className="flex mb-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                className="mr-2"
                checked={showIntermediateSteps}
                onChange={(e) => setShowIntermediateSteps(e.target.checked)}
              />
              Show intermediate steps
            </label>
          </div>
        )}

        <div className="flex w-full">
          <input
            className="grow mr-4 p-4 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={input}
            placeholder={placeholder}
            onChange={handleInputChange}
          />
          <button
            type="submit"
            className="px-6 py-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            disabled={chatEndpointIsLoading || intermediateStepsLoading}
          >
            {(chatEndpointIsLoading || intermediateStepsLoading) ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>

      <ToastContainer />
    </div>
  );
}

function getTokenPrice(tokenSymbol: string) {
    throw new Error("Function not implemented.");
}


async function getBirdeyeTrending(): Promise<any[]> {
    throw new Error("Function not implemented.");
}
