/* A strictly limited text-and-format Delta, shared by browser and server. No HTML or embeds. */
(() => {
  const sizes = [
    "8pt",
    "9pt",
    "10pt",
    "11pt",
    "12pt",
    "14pt",
    "16pt",
    "18pt",
    "20pt",
    "24pt",
    "28pt",
    "32pt",
    "36pt",
    "48pt",
  ];
  const reject = (message) => {
    throw Object.assign(Error(message), { status: 400 });
  };
  const plain = (delta) =>
    delta.ops
      .map((op) => op.insert)
      .join("")
      .replace(/\n$/, "");
  function normalize(delta, text) {
    if (!delta) return undefined;
    if (!Array.isArray(delta.ops) || delta.ops.length > 10000)
      reject("Unsupported document formatting.");
    let length = 0;
    const ops = delta.ops.map((op) => {
      if (typeof op.insert !== "string" || !op.insert.length)
        reject(
          "Document formatting accepts text only. Images and embedded HTML are not supported.",
        );
      length += op.insert.length;
      if (length > 50000) reject("Formatted text is too long.");
      const attributes = {};
      for (const [key, value] of Object.entries(op.attributes || {})) {
        if (
          ["bold", "italic", "underline", "strike"].includes(key) &&
          value === true
        )
          attributes[key] = true;
        else if (
          key === "align" &&
          ["left", "right", "center", "justify"].includes(value)
        )
          attributes[key] = value;
        else if (
          key === "font" &&
          ["serif", "monospace", "helvetica", "times"].includes(value)
        )
          attributes[key] = value;
        else if (
          ["color", "background"].includes(key) &&
          /^#[0-9a-f]{6}$/i.test(value)
        )
          attributes[key] = value;
        else if (key === "script" && ["sub", "super"].includes(value))
          attributes[key] = value;
        else if (
          key === "lineheight" &&
          ["1", "1.15", "1.5", "2"].includes(value)
        )
          attributes[key] = value;
        else if (key === "size" && sizes.includes(value))
          attributes[key] = value;
        else if (key === "header" && [1, 2, 3].includes(value))
          attributes[key] = value;
        else if (key === "list" && ["bullet", "ordered"].includes(value))
          attributes[key] = value;
        else if (
          key === "indent" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 6
        )
          attributes[key] = value;
        else reject("Unsupported document style: " + key);
      }
      return {
        insert: op.insert,
        ...(Object.keys(attributes).length ? { attributes } : {}),
      };
    });
    const result = { ops };
    if (!ops.length || !ops.at(-1).insert.endsWith("\n"))
      reject("Document formatting must end with a paragraph.");
    if (plain(result).trim() !== String(text ?? "").trim())
      reject("Text and formatting differ. Reopen the editor and save again.");
    return result;
  }
  function paragraphs(delta) {
    const output = [];
    let runs = [];
    for (const op of delta.ops) {
      const chunks = op.insert.split("\n");
      chunks.forEach((part, index) => {
        if (part) runs.push({ text: part, ...op.attributes });
        if (index < chunks.length - 1) {
          output.push({ runs, attributes: op.attributes || {} });
          runs = [];
        }
      });
    }
    if (runs.length) output.push({ runs, attributes: {} });
    return output;
  }
  globalThis.documentFormat = { normalize, plain, paragraphs, sizes };
})();
