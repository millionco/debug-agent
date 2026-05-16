export interface ParsedSseEvent {
  event: string;
  data: string;
}

export const parseSseStream = async function* (
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseEvent, void, void> {
  const reader = stream.getReader();
  const textDecoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let currentDataLines: string[] = [];

  const flushEvent = (): ParsedSseEvent | null => {
    if (currentDataLines.length === 0) {
      currentEvent = "message";
      return null;
    }
    const data = currentDataLines.join("\n");
    const result: ParsedSseEvent = { event: currentEvent, data };
    currentEvent = "message";
    currentDataLines = [];
    return result;
  };

  try {
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      buffer += textDecoder.decode(chunk, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        let rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);

        if (rawLine === "") {
          const flushed = flushEvent();
          if (flushed) yield flushed;
        } else if (rawLine.startsWith(":")) {
          // ignore SSE comment lines
        } else if (rawLine.startsWith("event:")) {
          currentEvent = rawLine.slice(6).trim();
        } else if (rawLine.startsWith("data:")) {
          const dataPiece = rawLine.startsWith("data: ") ? rawLine.slice(6) : rawLine.slice(5);
          currentDataLines.push(dataPiece);
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
};
