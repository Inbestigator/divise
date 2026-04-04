# Divise

Divise, (from the French word for split) will extract related iterator values into a discriminated map.

## Examples

```ts
const events = divise(
  [
    { type: "read", key: "blocks" },
    { type: "write", key: "blocks", value: 32 },
  ],
  "type",
);
console.log(events.read.length);
```

```ts
// Sample socket messages:
// { type: "connect" }
// { type: "message", content: "foo" }
const socketEvents = divise(iterateWebSocket(ws), "type");
for await (const message of socketEvents.message) {
  console.log(message);
}
```
