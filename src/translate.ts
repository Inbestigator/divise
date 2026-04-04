export async function* iterateStream<T>(stream: ReadableStream<T>): AsyncIterable<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* iterateWebSocket<T>(ws: WebSocket): AsyncIterable<T> {
  const queue: T[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  ws.addEventListener("message", (event) => {
    queue.push(event.data);
    resolve?.();
  });

  ws.addEventListener("close", () => {
    done = true;
    resolve?.();
  });

  ws.addEventListener("error", () => {
    done = true;
    resolve?.();
  });

  while (!done) {
    if (queue.length > 0) {
      yield queue.shift() as T;
      continue;
    }
    await new Promise<void>((r) => (resolve = r));
  }
}
