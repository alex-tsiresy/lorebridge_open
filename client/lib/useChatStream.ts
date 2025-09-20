import { useRef } from "react";

interface UseChatStreamOptions {
  onToken: (token: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
  onChunk?: (chunk: any) => void; // Optional: for advanced UI (tool/citation)
}

export function useChatStream(options: UseChatStreamOptions) {
  const controllerRef = useRef<AbortController | null>(null);

  const startStream = async (messages: { role: string; content: string }[], model: string = "gpt-4o-search-preview") => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          // Split on newlines (in case multiple JSONs in one chunk)
          let lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || ""; // Last line may be incomplete
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              options.onChunk && options.onChunk(chunk);
              // Extract assistant content
              const delta = chunk.choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                options.onToken(delta);
              }
              // Optionally: handle tool/citation outputs here
            } catch (err) {
              // Ignore JSON parse errors for incomplete lines
            }
          }
        }
        done = doneReading;
      }
      options.onDone && options.onDone();
    } catch (err: any) {
      if (err.name === "AbortError") return;
      options.onError && options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const cancelStream = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  };

  return { startStream, cancelStream };
}

export type { UseChatStreamOptions }; 