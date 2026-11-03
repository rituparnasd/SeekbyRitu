/* Rich editing with validated text-only formatting snapshots; no HTML is stored. */
(() => {
  const prefix = /^(\s*)(?:[-*•]|\d+[.)])\s+/;
  function transform(value, start, end, action) {
    const first = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const finalPosition =
      end > start && value[end - 1] === "\n" ? end - 1 : end;
    const next = value.indexOf("\n", finalPosition);
    const last = next < 0 ? value.length : next;
    const lines = value.slice(first, last).split("\n");
    const remove =
      action === "bullets"
        ? lines.every((l) => !l.trim() || /^\s*[•*-]\s/.test(l))
        : action === "numbers"
          ? lines.every((l) => !l.trim() || /^\s*\d+[.)]\s/.test(l))
          : false;
    let n = 0;
    const replacement = lines
      .map((line) => {
        if (action === "indent") return line.trim() ? "  " + line : line;
        if (action === "outdent") return line.replace(/^(?: {1,2}|\t)/, "");
        if (!line.trim()) return line;
        const indentation = line.match(/^\s*/)[0];
        const body = line.replace(prefix, "").trimStart();
        if (remove) return indentation + body;
        return indentation + (action === "bullets" ? "• " : `${++n}. `) + body;
      })
      .join("\n");
    return {
      value: value.slice(0, first) + replacement + value.slice(last),
      start: first,
      end: first + replacement.length,
    };
  }
  function continuation(value, start, end) {
    const first = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const before = value.slice(first, start),
      match = before.match(/^(\s*)([•*-]|(\d+)[.)])\s+(.*)$/);
    if (!match) return null;
    if (!match[4].trim())
      return {
        value: value.slice(0, first) + value.slice(end),
        start: first,
        end: first,
      };
    const insert =
      "\n" +
      match[1] +
      (match[3] ? `${Number(match[3]) + 1}. ` : match[2] + " ");
    return {
      value: value.slice(0, start) + insert + value.slice(end),
      start: start + insert.length,
      end: start + insert.length,
    };
  }
  const editors = new WeakMap();
  function mount(root = document, sources = {}) {
    root
      .querySelectorAll("#product-form textarea, #invoice-form textarea")
      .forEach((field) => {
        if (editors.has(field)) return;
        const form = field.closest("form");
        const source =
          form.id === "product-form" ? sources.product : sources.invoice;
        const itemIndex = field.name.match(/^description-(\d+)$/)?.[1];
        const saved =
          itemIndex !== undefined
            ? source?.items?.[itemIndex]?.formatting?.description
            : source?.formatting?.[field.name];
        const wrapper = document.createElement("div");
        wrapper.className = "document-rich-editor";
        const host = document.createElement("div");
        host.className = "document-rich-surface";
        field.before(wrapper);
        wrapper.append(host, field);
        field.hidden = true;
        const Size = Quill.import("attributors/style/size");
        Size.whitelist = documentFormat.sizes;
        Quill.register(Size, true);
        const Parchment = Quill.import("parchment");
        Quill.register(
          new Parchment.StyleAttributor("lineheight", "line-height", {
            scope: Parchment.Scope.BLOCK,
            whitelist: ["1", "1.15", "1.5", "2"],
          }),
          true,
        );
        const Font = Quill.import("formats/font");
        Font.whitelist = ["serif", "monospace", "helvetica", "times"];
        Quill.register(Font, true);
        const icons = Quill.import("ui/icons");
        icons.undo = "↶";
        icons.redo = "↷";
        icons.justify = "Justify";
        const q = new Quill(host, {
          theme: "snow",
          formats: [
            "bold",
            "italic",
            "underline",
            "strike",
            "script",
            "color",
            "background",
            "font",
            "size",
            "header",
            "list",
            "indent",
            "align",
            "lineheight",
          ],
          modules: {
            history: { delay: 500, maxStack: 60, userOnly: true },
            toolbar: {
              container: [
                ["bold", "italic", "underline", "strike"],
                [{ script: "sub" }, { script: "super" }],
                [
                  { font: [false, "serif", "helvetica", "times", "monospace"] },
                  { size: [false, ...documentFormat.sizes] },
                ],
                [
                  {
                    color: [
                      "#071a2b",
                      "#0b3027",
                      "#000000",
                      "#ffffff",
                      "#687772",
                      "#b42318",
                      "#175cd3",
                      "#6941c6",
                      "#b54708",
                    ],
                  },
                  {
                    background: [
                      false,
                      "#ffffff",
                      "#fff3a3",
                      "#dce7e0",
                      "#dbeafe",
                      "#fce7f3",
                    ],
                  },
                ],
                [
                  { header: [false, 1, 2, 3] },
                  { align: ["", "center", "right", "justify"] },
                  "justify",
                  { lineheight: ["1", "1.15", "1.5", "2"] },
                ],
                [
                  { list: "ordered" },
                  { list: "bullet" },
                  { indent: "-1" },
                  { indent: "+1" },
                ],
                ["undo", "redo", "clean"],
              ],
              handlers: {
                justify() {
                  this.quill.format("align", "justify", "user");
                },
                undo() {
                  this.quill.history.undo();
                },
                redo() {
                  this.quill.history.redo();
                },
              },
            },
          },
        });
        const label =
          document.querySelector(`label[for="${field.id}"]`)?.textContent ||
          "Document text";
        q.root.setAttribute("role", "textbox");
        q.root.setAttribute("aria-multiline", "true");
        q.root.setAttribute("aria-label", label);
        try {
          q.setContents(
            saved
              ? documentFormat.normalize(saved, field.value)
              : { ops: [{ insert: field.value + "\n" }] },
            "silent",
          );
        } catch {
          q.setText(field.value, "silent");
        }
        q.history.clear();
        wrapper
          .querySelector(".ql-toolbar")
          .addEventListener("mousedown", () => q.history.cutoff());
        let valid = q.getContents();
        const sync = () => {
          const value = q.getText().replace(/\n$/, "");
          if (field.maxLength > 0 && value.length > field.maxLength) {
            q.setContents(valid, "silent");
            return;
          }
          valid = q.getContents();
          field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
        };
        q.on("text-change", sync);
        editors.set(field, q);
        if (field.readOnly || field.disabled) q.enable(false);
        const names = {
          justify: "Justify",
          bold: "Bold",
          italic: "Italic",
          underline: "Underline",
          strike: "Strikethrough",
          script: "Subscript / Superscript",
          undo: "Undo",
          redo: "Redo",
          clean: "Clear Formatting",
          list: "List",
          indent: "Indent",
          align: "Alignment",
        };
        wrapper.querySelectorAll(".ql-toolbar button").forEach((button) => {
          const key = Array.from(button.classList)
            .find((n) => n.startsWith("ql-"))
            ?.slice(3);
          const name =
            key === "list"
              ? button.value === "ordered"
                ? "Numbered List"
                : "Bulleted List"
              : key === "indent"
                ? button.value === "+1"
                  ? "Increase Indent"
                  : "Decrease Indent"
                : key === "script"
                  ? button.value === "sub"
                    ? "Subscript"
                    : "Superscript"
                  : names[key] || key;
          button.setAttribute("aria-label", name);
          button.setAttribute("title", name);
          button.type = "button";
        });
        const pickerNames = {
          font: "Font Family",
          size: "Font Size",
          header: "Heading",
          align: "Alignment",
          lineheight: "Line Spacing",
          color: "Text Colour",
          background: "Highlight Colour",
        };
        wrapper.querySelectorAll(".ql-picker").forEach((picker) => {
          const type = Object.keys(pickerNames).find((key) =>
            picker.classList.contains("ql-" + key),
          );
          const control = picker.querySelector(".ql-picker-label");
          if (type && control) {
            control.setAttribute("aria-label", pickerNames[type]);
            control.title = pickerNames[type];
          }
          picker
            .querySelectorAll(".ql-picker-item")
            .forEach((item) =>
              item.setAttribute("aria-label", item.dataset.value || "Default"),
            );
        });
        const hint = document.createElement("p");
        hint.className = "editor-help";
        hint.textContent =
          "Select text for bold, italic or font changes. Select paragraphs for alignment, including Justify. Ctrl/Cmd+B or I also works.";
        wrapper.append(hint);
      });
  }
  function capture(form) {
    const formatting = {};
    form.querySelectorAll("textarea").forEach((field) => {
      const editor = editors.get(field);
      if (editor) {
        field.value = editor.getText().replace(/\n$/, "");
        formatting[field.name] = {
          ops: editor.getContents().ops.map((op) => ({
            ...op,
            ...(op.attributes ? { attributes: { ...op.attributes } } : {}),
          })),
        };
      }
    });
    return formatting;
  }
  globalThis.documentEditing = {
    transform,
    continuation,
    mount,
    capture,
    get: (field) => editors.get(field),
  };
})();
