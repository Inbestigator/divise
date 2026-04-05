/** biome-ignore-all lint/suspicious/noExplicitAny: Irrelevant */
/** biome-ignore-all lint/style/noNonNullAssertion: Keys are set */

type KeyOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
type Discriminant<T> = KeyOfType<T, PropertyKey>;
type CallbackMap<T, D extends Discriminant<T>> = Partial<{
  [K in T[D] & PropertyKey]: (value: Extract<T, Record<D, K>>) => void;
}>;

export default function divise<const T extends object, const D extends Discriminant<T>>(
  input: Iterable<T>,
  discriminant: D,
): { [K in T[D] & PropertyKey]: Extract<T, Record<D, K>>[] };

export default function divise<const T extends object, D extends Discriminant<T>>(
  input: Iterable<T> | AsyncIterable<T>,
  discriminant: D,
  callbacks: CallbackMap<T, D>,
): Promise<void>;

export default function divise<const T extends object, const D extends Discriminant<T>>(
  input: AsyncIterable<T>,
  discriminant: D,
): { [K in T[D] & PropertyKey]: AsyncGenerator<Extract<T, Record<D, K>>> };

export default function divise<T extends Record<PropertyKey, PropertyKey>>(
  input: Iterable<T> | AsyncIterable<T>,
  discriminant: PropertyKey,
  third?: any,
) {
  if (isAsyncIterable(input)) {
    if (isCallbackMap(third)) {
      return (async () => {
        for await (const item of input) {
          const key = item?.[discriminant];
          if (key != null) third[key]?.(item);
        }
      })();
    }
    const queues = new Map<PropertyKey, any[]>();
    const resolvers = new Map<PropertyKey, ((v: IteratorResult<any>) => void)[]>();
    const state = new Map<PropertyKey, { done: boolean }>();

    function ensure(key: PropertyKey) {
      if (!queues.has(key)) {
        queues.set(key, []);
        resolvers.set(key, []);
        state.set(key, { done: false });
      }
    }

    function createGenerator(key: PropertyKey): AsyncGenerator<any> {
      ensure(key);

      return (async function* () {
        const q = queues.get(key)!;
        const r = resolvers.get(key)!;
        const s = state.get(key)!;

        while (true) {
          if (q.length) {
            yield q.shift();
            continue;
          }
          if (s.done) break;

          const next = await new Promise<IteratorResult<any>>((res) => r.push(res));
          if (next.done) break;
          yield next.value;
        }
      })();
    }

    (async () => {
      for await (const item of input) {
        const key = item?.[discriminant];
        if (key == null) continue;

        ensure(key);

        const q = queues.get(key)!;
        const r = resolvers.get(key)!;

        if (r.length) r.shift()?.({ value: item, done: false });
        else q.push(item);
      }

      for (const [key, r] of resolvers.entries()) {
        state.get(key)!.done = true;
        for (const fn of r) {
          fn({ value: undefined, done: true });
        }
      }
    })();

    return new Proxy({}, { get: (_, prop: PropertyKey) => createGenerator(prop) });
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
    return new Proxy(result, { get: (target, prop) => target[prop] ?? [] });
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
