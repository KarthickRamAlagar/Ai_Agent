"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.output },
      ]);

      // Auto-scroll to bottom after response
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error("Chat error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main>
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/Banner1.png"
          alt="Banner"
          fill
          className="object-cover z-[-1]"
        />
      </div>

      <div className="absolute inset-0 px-4 w-full h-screen flex flex-col gap-5 items-center">
        <h1 className="text-4xl font-Kanit md:text-5xl font-bold mt-10 text-center bg-gradient-to-r from-pink-500 via-red-500 to-yellow-400 bg-clip-text text-transparent">
          Karthick RamAlagar&rsquo;s AI Portfolio Agent
        </h1>

        {/* Chat Box */}
        <section
          ref={chatRef}
          className="w-full flex-1 overflow-y-auto bg-black/40 rounded-xl p-4 max-h-[70vh]"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xl text-gray-200">Ask me Anything</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-3xl w-fit max-w-[80%] break-words p-3 px-4 text-gray-200 text-lg mb-4 ${
                  message.role === "user"
                    ? "bg-blue-600 ml-auto rounded-br-none"
                    : "bg-orange-700 mr-auto rounded-bl-none"
                }`}
              >
                <b>{message.role === "user" ? "You:" : "Karthick:"}</b>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-300 underline hover:text-yellow-400"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-white">
                        {children}
                      </strong>
                    ),
                    li: ({ children }) => (
                      <li className="list-disc ml-5">{children}</li>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-right text-gray-300 italic">
              Thinking... 🤔
            </div>
          )}
        </section>

        {/* Input */}
        <form className="w-full flex gap-2 mb-4" onSubmit={sendMessage}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            type="text"
            placeholder="Ask me about anything"
            className="py-3 px-5 flex-1 rounded-xl text-white text-lg border-2 border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl px-6 disabled:bg-blue-400"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
