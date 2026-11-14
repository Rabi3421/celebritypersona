// The live outfit-form snapshot: no re-render loop, and no lost edits (lib/form-snapshot-watch.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { changeGate, onlyTextareaText } from "../lib/form-snapshot-watch.ts";

const textarea = { nodeName: "TEXTAREA", parentNode: { nodeName: "DIV" } };
const textNodeInTextarea = { nodeName: "#text", parentNode: textarea };
const hiddenInput = { nodeName: "INPUT", parentNode: { nodeName: "DIV" } };
const pieceRow = { nodeName: "DIV", parentNode: { nodeName: "FORM" } };

/**
 * A model of the provider: an observer callback, a reader of the form and a
 * widget that, every time a snapshot is published, re-renders and writes its
 * textarea's default text back into the DOM — exactly what React 19 does.
 */
function simulate({ gate, ignoreTextarea, form, cycles = 200 }) {
  let renders = 0;
  const queue = [];
  const publish = (snapshot) => {
    renders++;
    // The re-render writes the description textarea → one mutation record.
    queue.push([{ target: textNodeInTextarea }]);
    return snapshot;
  };
  const gated = gate ? changeGate(publish) : (next) => (publish(next), true);
  const onMutations = (records) => {
    if (ignoreTextarea && onlyTextareaText(records)) return;
    gated(form());
  };
  gated(form()); // the first read on mount
  for (let i = 0; i < cycles && queue.length; i++) onMutations(queue.shift());
  return renders;
}

test("render loop: before the fix, a saved description re-renders without end; after it, once", () => {
  const form = () => ({ seoDescription: "A saved description", items: [{ name: "Gown" }] });
  assert.equal(simulate({ gate: false, ignoreTextarea: false, form }), 201, "the old code renders on every cycle — a loop");
  assert.equal(simulate({ gate: true, ignoreTextarea: false, form }), 1, "the content gate alone breaks the loop");
  assert.equal(simulate({ gate: true, ignoreTextarea: true, form }), 1, "and the textarea filter means the form is not even re-read");
});

test("edits still publish: changed content always gets through, identical content never does", () => {
  const published = [];
  const gate = changeGate((s) => published.push(s));
  assert.equal(gate({ title: "A" }), true);
  assert.equal(gate({ title: "A" }), false, "an identical reading is skipped");
  assert.equal(gate({ title: "AB" }), true, "a typed character is a new snapshot");
  assert.equal(gate({ title: "AB", photos: ["1", "2"] }), true, "a photo added by the editor (hidden inputs) is new");
  assert.equal(gate({ title: "AB", photos: ["2", "1"] }), true, "reordering is new");
  assert.equal(gate({ title: "A" }), true, "going back to an earlier value is still a change from the last one");
  assert.deepEqual(published.map((s) => s.title), ["A", "AB", "AB", "AB", "A"]);
});

test("which DOM changes are edits: only React's own textarea text writes are ignored", () => {
  assert.equal(onlyTextareaText([{ target: textarea }]), true);
  assert.equal(onlyTextareaText([{ target: textNodeInTextarea }, { target: textarea }]), true);
  assert.equal(onlyTextareaText([{ target: hiddenInput }]), false, "the photo editor's hidden inputs are edits");
  assert.equal(onlyTextareaText([{ target: pieceRow }]), false, "an added or removed piece row is an edit");
  assert.equal(onlyTextareaText([{ target: textarea }, { target: hiddenInput }]), false, "a mixed batch is read");
  assert.equal(onlyTextareaText([]), false);
});

test("a real change arriving with the loop's noise is still published", () => {
  let content = { seoDescription: "Saved", photos: ["1", "2"] };
  const renders = [];
  const gate = changeGate((s) => renders.push(s));
  const onMutations = (records) => {
    if (onlyTextareaText(records)) return;
    gate(content);
  };
  gate(content);
  onMutations([{ target: textNodeInTextarea }]); // React's write: ignored
  content = { ...content, photos: ["2", "1"] }; // the editor reorders photos (hidden inputs change)
  onMutations([{ target: textNodeInTextarea }, { target: hiddenInput }]);
  assert.equal(renders.length, 2);
  assert.deepEqual(renders[1].photos, ["2", "1"]);
});
