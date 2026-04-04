/** biome-ignore-all lint/suspicious/noExplicitAny: Irrelevant */

type KeyOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
type Discriminant<T> = KeyOfType<T, PropertyKey>;
type Grouped<T, D extends Discriminant<T>> = { [K in T[D] & PropertyKey]: Extract<T, Record<D, K>>[] };
type CallbackMap<T, D extends Discriminant<T>> = Partial<{
  [K in T[D] & PropertyKey]: (value: Extract<T, Record<D, K>>) => void;
}>;
type StreamGrouped<T, D extends Discriminant<T>> = { [K in PropertyKey]: AsyncGenerator<Extract<T, Record<D, K>>> };

export default function divise<const T extends object, D extends Discriminant<T>>(
  input: Iterable<T>,
  discriminant: D,
): Grouped<T, D>;

export default function divise<const T extends object, D extends Discriminant<T>>(
  input: Iterable<T> | AsyncIterable<T>,
  discriminant: D,
  callbacks: CallbackMap<T, D>,
): void;

export default function divise<const T extends object, D extends Discriminant<T>>(
  input: AsyncIterable<T>,
  discriminant: D,
): StreamGrouped<T, D>;

export default function divise<T extends Record<PropertyKey, PropertyKey>>(
  input: Iterable<T> | AsyncIterable<T>,
  discriminant: PropertyKey,
  third?: any,
) {
  if (isAsyncIterable(input)) {
    const queues = new Map<PropertyKey, any[]>();
    const resolvers = new Map<PropertyKey, ((v: IteratorResult<any>) => void)[]>();
    const result: Record<PropertyKey, AsyncGenerator<any>> = {};

    (async () => {
      for await (const item of input) {
        const key = item?.[discriminant];
        if (key == null) continue;

        if (!queues.has(key)) {
          queues.set(key, []);
          resolvers.set(key, []);

          result[key] = (async function* () {
            const q = queues.get(key);
            const r = resolvers.get(key);
            if (!q || !r) return;

            while (true) {
              if (q.length) {
                yield q.shift();
                continue;
              }
              const next = await new Promise<IteratorResult<any>>((res) => r.push(res));
              if (next.done) return;
              yield next.value;
            }
          })();
        }

        const q = queues.get(key);
        const r = resolvers.get(key);
        if (!q || !r) continue;

        if (r.length) r.shift()?.({ value: item, done: false });
        else q.push(item);
      }

      for (const r of resolvers.values()) {
        for (const fn of r) {
          fn({ value: undefined, done: true });
        }
      }
    })();

    return new Proxy(result, {
      get(target, prop) {
        if (!(prop in target)) return (async function* () {})();
        return target[prop];
      },
    });
  }

  if (isIterable(input)) {
    if (isCallbackMap(third)) {
      for (const item of input) {
        const key = item?.[discriminant];
        if (key != null) third[key]?.(item);
      }
      return;
    }

    const result: Record<PropertyKey, unknown[]> = {};
    for (const item of input) {
      const key = item?.[discriminant];
      if (key == null) continue;
      result[key] ??= [];
      result[key].push(item);
    }
    return result;
  }

  throw new TypeError("Unsupported input");
}

function isIterable(obj: any): obj is Iterable<any> {
  return obj && typeof obj[Symbol.iterator] === "function";
}

function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
  return obj && typeof obj[Symbol.asyncIterator] === "function";
}

function isCallbackMap(obj: any): obj is Record<PropertyKey, CallableFunction> {
  return obj && typeof obj === "object" && !Array.isArray(obj);
}

export * from "./translate.ts";
