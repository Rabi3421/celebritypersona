import test from "node:test";
import assert from "node:assert/strict";
import { withUniquePieceIds } from "@/lib/piece-ids";

const ids = () => { let n = 0; return () => `new-${++n}`; };

test("a piece id another look already uses is replaced; the lead follows it", () => {
  const look = { leadPieceId: "p1", items: [{ id: "p1", name: "Saree" }, { id: "p2", name: "Earrings" }] };
  const { look: out, changed } = withUniquePieceIds(look, new Set(["p1"]), ids());
  assert.equal(changed, 1);
  assert.deepEqual(out.items.map((i) => i.id), ["new-1", "p2"]);
  assert.equal(out.leadPieceId, "new-1");
});

test("ids no one else uses are kept, and nothing changes", () => {
  const look = { leadPieceId: "a", items: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
  const { look: out, changed } = withUniquePieceIds(look, new Set(["zzz"]), ids());
  assert.equal(changed, 0);
  assert.deepEqual(out, look);
});

test("an id repeated inside one look is made unique too; empty ids are left for the save to fill", () => {
  const look = { items: [{ id: "x", name: "A" }, { id: "x", name: "B" }, { id: "", name: "C" }] };
  const { look: out } = withUniquePieceIds(look, new Set(), ids());
  assert.deepEqual(out.items.map((i) => i.id), ["x", "new-1", ""]);
  assert.equal("leadPieceId" in out, false);
});
