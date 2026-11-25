import test from "node:test";
import assert from "node:assert/strict";
import { sharedConnection } from "@/lib/mongo-connection";

test("a good connection is made once and reused", async () => {
  let calls = 0;
  const get = sharedConnection(async () => ({ id: ++calls }));
  const [a, b] = await Promise.all([get(), get()]);
  assert.equal(a, b);
  assert.equal((await get()).id, 1);
  assert.equal(calls, 1);
});

test("a failed attempt is forgotten: the next request connects again", async () => {
  let calls = 0;
  const get = sharedConnection(async () => {
    calls++;
    if (calls === 1) throw new Error("Server selection timed out");
    return { ok: true };
  });
  await assert.rejects(get(), /timed out/);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(await get(), { ok: true });
  assert.equal(calls, 2);
});

test("development keeps the connection across reloads, and drops a failed one", async () => {
  let remembered;
  const remember = (p) => (remembered = p);
  const failing = sharedConnection(() => Promise.reject(new Error("down")), remember);
  await assert.rejects(failing(), /down/);
  await new Promise((r) => setImmediate(r));
  assert.equal(remembered, undefined);
  const reused = Promise.resolve("kept");
  const next = sharedConnection(() => Promise.resolve("new"), remember, reused);
  assert.equal(await next(), "kept");
});
