'use client';

import { useState, useCallback, useRef } from 'react';

interface UseStreamingTextOptions {
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for streaming AI text responses via Server-Sent Events or fetch ReadableStream.
 * Falls back to simulated typewriter effect if no real stream is available.
 */
export function useStreamingText(options: UseStreamingTextOptions = {}) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /** Stream from a fetch endpoint that returns text/event-stream */
  const streamFromUrl = useCallback(async (url: string, body: object) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setText('');
    setIsStreaming(true);
    setIsDone(false);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE: each line is "data: <text>\n"
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const token = line.slice(6);
            if (token === '[DONE]') break;
            accumulated += token;
            setText(accumulated);
          }
        }
      }

      setIsDone(true);
      options.onComplete?.(accumulated);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        options.onError?.(err as Error);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  /**
   * Simulate streaming with typewriter effect for demo/offline use.
   * Reveals the full text character by character with natural pacing.
   */
  const simulateStream = useCallback(async (fullText: string, delayMs = 18) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setText('');
    setIsStreaming(true);
    setIsDone(false);

    const words = fullText.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      if (abort.signal.aborted) break;
      accumulated += (i === 0 ? '' : ' ') + words[i];
      setText(accumulated);
      // Variable delay for more natural feel — longer at punctuation
      const word = words[i];
      const pause = word.endsWith('.') || word.endsWith('\n') ? delayMs * 4
        : word.endsWith(',') || word.endsWith(':') ? delayMs * 2
        : delayMs;
      await new Promise((r) => setTimeout(r, pause));
    }

    if (!abort.signal.aborted) {
      setIsDone(true);
      options.onComplete?.(accumulated);
    }
    setIsStreaming(false);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setIsStreaming(false);
    setIsDone(false);
  }, []);

  return { text, isStreaming, isDone, streamFromUrl, simulateStream, stop, reset };
}
