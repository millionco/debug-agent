import { useEffect, useRef, useState } from "react";

interface Message {
  text: string;
  sender: "user" | "bot";
  timestamp: number;
}

const BOT_REPLIES = [
  "Got it, thanks!",
  "Interesting, tell me more.",
  "That makes sense.",
  "I'll look into that.",
  "Thanks for letting me know!",
];

const pickBotReply = () => BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

export const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addBotReply = () => {
    setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        { text: pickBotReply(), sender: "bot", timestamp: Date.now() },
      ]);
    }, 800);
  };

  const handleSendFromButton = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setMessages((previous) => [
      ...previous,
      { text: trimmed, sender: "user", timestamp: Date.now() },
    ]);
    setInputValue("");
    addBotReply();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
      if (event.key === "Enter" && modifierPressed) {
        event.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        setMessages((previous) => [
          ...previous,
          { text: trimmed, sender: "user", timestamp: Date.now() },
        ]);
        setInputValue("");
        addBotReply();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Chat</h1>
        <div className="shortcut-hint">
          <kbd className="kbd">{isMac ? "⌘" : "Ctrl"}</kbd>
          <span>+</span>
          <kbd className="kbd">Enter</kbd>
          <span>to send</span>
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="messages-empty">Send a message to start chatting</div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.sender === "user" ? "message-sent" : "message-received"}`}
          >
            {message.text}
            <div className="message-timestamp">{formatTime(message.timestamp)}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              handleSendFromButton();
            }
          }}
          placeholder="Type a message..."
        />
        <button
          className="send-button"
          onClick={handleSendFromButton}
          disabled={!inputValue.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};
