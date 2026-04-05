import { describe, expect, test } from "bun:test";
import divise from "./index.ts";

type Item = { type: "a"; value: number } | { type: "b"; value: string } | { type: "c"; value: boolean };

const data: Item[] = [
  { type: "a", value: 1 },
  { type: "b", value: "x" },
  { type: "a", value: 2 },
  { type: "c", value: true },
];

describe("sync iterable", () => {
  test("groups items by discriminant", () => {
    const result = divise(data, "type");

    expect(result).toEqual({
      a: [
        { type: "a", value: 1 },
        { type: "a", value: 2 },
      ],
      b: [{ type: "b", value: "x" }],
      c: [{ type: "c", value: true }],
    });
  });

  test("ignores items with null/undefined discriminant", () => {
    const input = [...data, { type: undefined, value: 999 } as unknown as Item];
    const result = divise(input, "type");

    expect(result).not.toHaveProperty("undefined");
  });

  test("returns empty object for empty input", () => {
    const result = divise([] as Item[], "type");
    expect(result).toEqual({} as never);
  });
});

describe("callback mode", () => {
  test("calls callbacks for matching keys", () => {
    const calls: Record<string, Item[]> = { a: [], b: [] };

    divise(data, "type", { a: (v) => calls.a.push(v), b: (v) => calls.b.push(v) });

    expect(calls.a).toEqual([
      { type: "a", value: 1 },
      { type: "a", value: 2 },
    ]);
    expect(calls.b).toEqual([{ type: "b", value: "x" }]);
  });

  test("ignores keys without callbacks", () => {
    const calls: Item[] = [];

    divise(data, "type", { a: (v) => calls.push(v) });

    expect(calls.length).toBe(2);
  });
});

async function* asyncGen(items: Item[]) {
  for (const item of items) {
    await new Promise((r) => setTimeout(r, 1));
    yield item;
  }
}

describe("async iterable", () => {
  test("streams grouped items", async () => {
    const streams = divise(asyncGen(data), "type");
    const results: Record<string, Item[]> = { a: [], b: [], c: [] };

    await Promise.all([
      (async () => {
        for await (const v of streams.a) {
          results.a.push(v);
        }
      })(),
      (async () => {
        for await (const v of streams.b) {
          results.b.push(v);
        }
      })(),
      (async () => {
        for await (const v of streams.c) {
          results.c.push(v);
        }
      })(),
    ]);

    expect(results.a).toEqual([
      { type: "a", value: 1 },
      { type: "a", value: 2 },
    ]);
    expect(results.b).toEqual([{ type: "b", value: "x" }]);
    expect(results.c).toEqual([{ type: "c", value: true }]);
  });

  test("calls callbacks for async keys", async () => {
    const calls: Record<string, Item[]> = { a: [], b: [] };

    await divise(asyncGen(data), "type", { a: (v) => calls.a.push(v), b: (v) => calls.b.push(v) });

    expect(calls.a).toEqual([
      { type: "a", value: 1 },
      { type: "a", value: 2 },
    ]);
    expect(calls.b).toEqual([{ type: "b", value: "x" }]);
  });
});

test("throws for non-iterable input", () => {
  expect(() => divise(123 as unknown as Item[], "type")).toThrow(TypeError);
});
