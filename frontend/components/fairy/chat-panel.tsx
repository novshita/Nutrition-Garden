"use client";

import { useState, type FormEvent } from "react";
import { MemorySuggestion } from "@/components/fairy/memory-suggestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { MAX_CHAT_MESSAGE, trimHistory, validateMessage, type ChatTurn } from "@/lib/ai";
import type { ChatResponse, Memory } from "@/lib/types/api";

type Message = ChatTurn & { id: string; suggestions?: Memory[] };

const STARTERS = ["What could I eat tonight?", "What's my workout today?", "How is my week going?"];

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const problem = validateMessage(text, MAX_CHAT_MESSAGE);
    if (problem) {
      setError(problem);
      return;
    }
    const message = text.trim();
    setBusy(true);
    setError(null);
    try {
      // The fairy keeps no memory between messages, so the recent conversation goes back with each one.
      const history = trimHistory(messages.map(({ role, content }) => ({ role, content })));
      const response = await api<ChatResponse>("/ai/chat", { method: "POST", body: { message, history } });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: message },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          suggestions: response.memory_suggestions,
        },
      ]);
      setText("");
    } catch (caught) {
      // Keep what they wrote so they can try again.
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat with your fairy</CardTitle>
        <CardDescription>
          Ask about food, your day or your plan. She&apos;s a friendly companion, not a coach or a doctor.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <Button key={starter} type="button" size="sm" variant="outline" onClick={() => setText(starter)}>
                {starter}
              </Button>
            ))}
          </div>
        )}

        <ul className="flex flex-col gap-3" aria-live="polite">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {message.role === "assistant" && "🧚 "}
                {message.content}
              </p>
              {message.suggestions?.map((memory) => (
                <MemorySuggestion key={memory.id} memory={memory} />
              ))}
            </li>
          ))}
        </ul>

        <form onSubmit={send} className="flex flex-col gap-2" noValidate>
          <Label htmlFor="chat-message">Your message</Label>
          <div className="flex gap-2">
            <Input
              id="chat-message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say hello…"
              maxLength={MAX_CHAT_MESSAGE}
            />
            <Button type="submit" disabled={busy}>
              {busy ? "…" : "Send"}
            </Button>
          </div>
          <p role="alert" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
