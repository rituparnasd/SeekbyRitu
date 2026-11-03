import test from "node:test";
import assert from "node:assert/strict";
import "../public/text-editor.js";
const { transform, continuation } = globalThis.documentEditing;
test("document list editing preserves unselected text, supports numbering, indentation and toggling", () => {
  const input = "Introduction\nFirst item\nSecond item\nClosing";
  const start = input.indexOf("First"),
    end = input.indexOf("Closing");
  const bullets = transform(input, start, end, "bullets");
  assert.equal(
    bullets.value,
    "Introduction\n• First item\n• Second item\nClosing",
  );
  const numbered = transform(
    bullets.value,
    bullets.start,
    bullets.end,
    "numbers",
  );
  assert.equal(
    numbered.value,
    "Introduction\n1. First item\n2. Second item\nClosing",
  );
  const indented = transform(
    numbered.value,
    numbered.start,
    numbered.end,
    "indent",
  );
  assert.equal(
    indented.value,
    "Introduction\n  1. First item\n  2. Second item\nClosing",
  );
  const out = transform(
    indented.value,
    indented.start,
    indented.end,
    "outdent",
  );
  assert.equal(out.value, numbered.value);
  assert.equal(
    transform(out.value, out.start, out.end, "numbers").value,
    input,
  );
  assert.equal(transform("\nText", 0, 0, "bullets").start, 0);
});
test("Enter continues bullets and numbers, exits empty points and leaves normal paragraphs alone", () => {
  assert.equal(continuation("• First", 7, 7).value, "• First\n• ");
  assert.equal(continuation("  9. Point", 10, 10).value, "  9. Point\n  10. ");
  assert.equal(continuation("• First\n• ", 10, 10).value, "• First\n");
  assert.equal(continuation("Plain text", 10, 10), null);
});
