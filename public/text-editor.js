/* Accessible list editing for plain-text document fields; no HTML is stored. */
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
  function mount(root = document) {
    root
      .querySelectorAll("#product-form textarea, #invoice-form textarea")
      .forEach((field) => {
        if (field.dataset.documentEditor) return;
        field.dataset.documentEditor = "true";
        const wrapper = document.createElement("div");
        wrapper.className = "document-text-editor";
        field.before(wrapper);
        wrapper.append(field);
        const toolbar = document.createElement("div");
        toolbar.className = "document-edit-toolbar";
        toolbar.setAttribute("role", "group");
        const fieldLabel =
          document.querySelector(`label[for="${field.id}"]`)?.textContent ||
          "Document";
        toolbar.setAttribute("aria-label", fieldLabel + " editing");
        wrapper.prepend(toolbar);
        const history = [{ value: field.value, start: 0, end: 0 }];
        let position = 0,
          restoring = false;
        const snapshot = () => ({
          value: field.value,
          start: field.selectionStart,
          end: field.selectionEnd,
        });
        field.addEventListener("input", () => {
          if (restoring) return;
          history.splice(position + 1);
          history.push(snapshot());
          if (history.length > 60) history.shift();
          position = history.length - 1;
        });
        const restore = (state) => {
          if (field.maxLength > 0 && state.value.length > field.maxLength)
            return;
          field.value = state.value;
          field.focus();
          field.setSelectionRange(state.start, state.end);
          field.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const undo = (step) => {
          const target = position + step;
          if (target < 0 || target >= history.length) return;
          position = target;
          restoring = true;
          restore(history[position]);
          restoring = false;
        };
        const apply = (action) => {
          if (field.readOnly || field.disabled) return;
          history[position] = snapshot();
          restore(
            transform(
              field.value,
              field.selectionStart,
              field.selectionEnd,
              action,
            ),
          );
        };
        for (const [action, label, title] of [
          ["bullets", "• Bullets", "Toggle bullet points on selected lines"],
          ["numbers", "1. List", "Toggle a numbered list on selected lines"],
          ["indent", "Indent", "Indent selected lines (Tab)"],
          ["outdent", "Outdent", "Reduce indentation (Shift+Tab)"],
          ["undo", "Undo", "Undo (Ctrl/Cmd+Z)"],
          ["redo", "Redo", "Redo (Ctrl/Cmd+Shift+Z)"],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.title = title;
          button.setAttribute("aria-label", title);
          button.disabled = field.readOnly || field.disabled;
          button.addEventListener("mousedown", (e) => e.preventDefault());
          button.addEventListener("click", () =>
            action === "undo"
              ? undo(-1)
              : action === "redo"
                ? undo(1)
                : apply(action),
          );
          toolbar.append(button);
        }
        field.addEventListener("keydown", (event) => {
          if (field.readOnly || field.disabled) return;
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "z"
          ) {
            event.preventDefault();
            undo(event.shiftKey ? 1 : -1);
            return;
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "y"
          ) {
            event.preventDefault();
            undo(1);
            return;
          }
          if (
            event.key === "Tab" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            apply(event.shiftKey ? "outdent" : "indent");
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            const result = continuation(
              field.value,
              field.selectionStart,
              field.selectionEnd,
            );
            if (result) {
              event.preventDefault();
              history[position] = snapshot();
              restore(result);
            }
          }
          if (event.key === "Escape") field.blur();
        });
        const hint = document.createElement("p");
        hint.className = "editor-help";
        hint.textContent =
          "Select lines to format. Enter continues a list; Enter on an empty point ends it. Tab indents; Shift+Tab outdents. Esc, then Tab moves to the next field.";
        hint.id = field.id + "-editing-help";
        field.setAttribute("aria-describedby", hint.id);
        wrapper.append(hint);
      });
  }
  globalThis.documentEditing = { transform, continuation, mount };
})();
