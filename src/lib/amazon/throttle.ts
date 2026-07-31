// Token-bucket style serialisation + retry with exponential backoff.
type Task<T> = () => Promise<T>;

const CAPACITY = 1;
const REFILL_MS = 1100;

const queues = new Map<string, Task<unknown>[]>();
const inflight = new Map<string, number>();

function scheduleDrain(op: string) {
  setTimeout(() => void drain(op), REFILL_MS);
}

async function drain(op: string) {
  const q = queues.get(op);
  if (!q || q.length === 0) return;
  const running = inflight.get(op) ?? 0;
  if (running >= CAPACITY) return;
  const task = q.shift();
  if (!task) return;
  inflight.set(op, running + 1);
  try {
    await task();
  } finally {
    inflight.set(op, (inflight.get(op) ?? 1) - 1);
    if (q.length > 0) scheduleDrain(op);
  }
}

export function throttled<T>(op: string, fn: Task<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const q = queues.get(op) ?? [];
    q.push(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    });
    queues.set(op, q);
    void drain(op);
  });
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e as { retryable?: boolean }).retryable) throw e;
      const backoff = Math.min(4000, 250 * 2 ** i) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}
