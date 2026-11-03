let billingCustomerFilter = "",
  billingPaymentEditor = null;
/* Coach-only catalogue and billing editor. Persisted through dedicated authenticated APIs. */
let billingData = null,
  billingLoading = false,
  billingError = "",
  productEditor = null,
  documentEditor = null;
const billMoney = (cents, currency = "CAD") =>
  `${currency} ${(cents / 100).toFixed(2)}`;
async function refreshBilling() {
  if (billingLoading) return;
  billingLoading = true;
  try {
    billingData = await api("/api/billing");
    billingError = "";
  } catch (e) {
    billingError = e.message;
  } finally {
    billingLoading = false;
    if (["catalogue", "billing"].includes(state.view)) render();
  }
}
function billingPage() {
  if (window.__session.role !== "coach") return "";
  if (!billingData && !billingLoading && !billingError) refreshBilling();
  const isCatalogue = state.view === "catalogue";
  let html = title(
    isCatalogue ? "Products & Services" : "Billing",
    isCatalogue
      ? "Save your offers, prices and default Service Agreements."
      : "Choose a customer and an offer. Customize, preview and issue linked documents.",
  );
  if (!billingData)
    return (
      html +
      `<div class="card">${esc(billingError || "Loading your workspace…")}<button class="btn" id="billing-reload">Reload</button></div>`
    );
  if (isCatalogue) {
    html += `<div class="actions billing-toolbar"><button class="btn primary" id="new-product">Add Product / Service</button></div>`;
    if (productEditor) html += productForm(productEditor);
    html += `<div class="card">${billingData.products.map((p) => `<div class="list-item row"><div><span class="badge">${esc(p.kind)}${p.archived ? " · Archived" : ""}</span><h3>${esc(p.name)}</h3><p class="small muted">${esc(p.description)}</p><strong>${billMoney(Math.round(p.price * 100), p.currency)}</strong><span class="small muted"> · ${p.tax}% tax · Template ${p.approved ? "reviewed" : "draft"}</span></div><div class="actions">${innerCodePackages.all.some((c) => c.id === p.id) ? `<a class="btn subtle" href="/api/package-preview?package=${p.id}&kind=agreement" target="_blank" rel="noopener">Agreement Preview</a><a class="btn subtle" href="/api/package-preview?package=${p.id}&kind=invoice" target="_blank" rel="noopener">Invoice Preview</a>` : ""}<button class="btn subtle" data-product-edit="${p.id}">Edit Defaults</button><button class="btn subtle" data-product-variant="${p.id}">Save As New Variant</button></div></div>`).join("")}</div>`;
  } else {
    html += `<div class="actions billing-toolbar"><button class="btn primary" id="new-invoice">Create Invoice</button></div>`;
    html += `<div class="field"><label for="billing-customer-filter">Show Documents For</label><select id="billing-customer-filter"><option value="">All Customers</option>${[...new Map([...state.leads.map((l) => ({ email: l.email, name: l.first + " " + l.last })), ...billingData.documents.map((d) => d.customer)].map((c) => [c.email, c])).values()].map((c) => `<option value="${esc(c.email)}" ${billingCustomerFilter === c.email ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>`;
    if (documentEditor) html += invoiceForm(documentEditor);
    if (billingPaymentEditor) html += receiptForm(billingPaymentEditor);
    html += `<div class="card"><h2>Document History</h2>${
      billingData.documents
        .filter(
          (d) =>
            !billingCustomerFilter ||
            d.customer.email === billingCustomerFilter,
        )
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(
          (d) =>
            `<div class="list-item"><div class="row"><div><h3>${esc(d.reference || "Draft Invoice")} · ${esc(d.customer.name)}</h3><p class="small muted">${esc(d.items.map((i) => i.name).join(", "))} · ${billMoney(d.total, d.currency)} · ${esc(d.status === "Cancelled" ? "Canceled" : d.status)} · Version ${d.version}${d.revises ? " · Revises " + esc(d.revises) : ""}</p></div><span class="badge ${d.status === "Issued" ? "green" : ""}">${esc(d.status === "Cancelled" ? "Canceled" : d.status)}</span></div><div class="actions"><a class="btn subtle" target="_blank" rel="noopener" href="/api/billing/pdf?id=${d.id}&kind=invoice">Preview Invoice</a>${d.requiresAgreement !== false ? `<a class="btn subtle" target="_blank" rel="noopener" href="/api/billing/pdf?id=${d.id}&kind=agreement">Preview Service Agreement</a>` : ""}${d.status === "Draft" ? `<button class="btn subtle" data-document-edit="${d.id}">Customize</button><button class="btn primary" data-document-issue="${d.id}">Issue Documents</button><button class="btn subtle" data-document-delete="${d.id}">Delete Draft</button>` : `<button class="btn subtle" data-document-revise="${d.id}">Create Revision</button><button class="btn" data-record-payment="${d.id}">Record Verified Payment</button><button class="btn primary" data-document-queue="${d.id}">Prepare Email</button><button class="btn subtle" data-document-delete="${d.id}">Delete Issued Invoice</button>`}</div>${(
              billingData.payments || []
            )
              .filter((p) => p.invoiceId === d.id)
              .map(
                (p) =>
                  `<div class="list-item row"><span>Payment received · ${billMoney(p.receipt.amount, p.currency)} · ${p.receipt.date}</span><div class="actions"><a class="btn subtle" target="_blank" rel="noopener" href="/api/billing/pdf?id=${p.id}&kind=receipt">View Receipt</a><button class="btn subtle" data-document-queue="${p.id}">Prepare Receipt Email</button></div></div>`,
              )
              .join("")}</div>`,
        )
        .join("") ||
      '<p class="muted">Your invoices and Service Agreements will appear here.</p>'
    }</div>`;
  }
  if (!isCatalogue && billingData.trash?.length)
    html += `<details class="card"><summary>Deleted Drafts (${billingData.trash.length})</summary>${billingData.trash
      .filter(
        (d) =>
          !billingCustomerFilter || d.customer.email === billingCustomerFilter,
      )
      .map(
        (d) =>
          `<div class="list-item row"><span>${esc(d.customer.name)} · ${billMoney(d.total, d.currency)}</span><button class="btn" data-draft-restore="${d.id}">Restore Draft</button></div>`,
      )
      .join("")}</details>`;
  return html;
}
function productForm(p) {
  return `<form id="product-form" class="card"><h2>${p.id ? "Edit Defaults" : "New Product / Service"}</h2><p class="small muted">Updates apply to future selections. Existing client documents keep their original details.</p><div class="form-grid"><div class="field"><label for="product-name">Name</label><input id="product-name" name="name" value="${esc(p.name || "")}" required maxlength="200"></div><div class="field"><label for="product-kind">Type</label><select id="product-kind" name="kind"><option ${p.kind === "Service" ? "selected" : ""}>Service</option><option ${p.kind === "Product" ? "selected" : ""}>Product</option></select></div><div class="field"><label for="product-price">Default Price</label><input id="product-price" name="price" type="number" min="0" max="10000000" step=".01" value="${p.price || 0}" required></div><div class="field"><label for="product-currency">Currency</label><input id="product-currency" name="currency" value="${esc(p.currency || "CAD")}" pattern="[A-Za-z]{3}" maxlength="3" required></div><div class="field"><label for="product-tax">Applicable Tax (%)</label><input id="product-tax" name="tax" type="number" min="0" max="100" step=".01" value="${p.tax || 0}" required></div></div><div class="field"><label for="product-description">Invoice Description</label><textarea id="product-description" name="description" maxlength="2000">${esc(p.description || "")}</textarea></div><div class="field"><label for="product-next-steps">What Happens Next (Email)</label><textarea id="product-next-steps" name="nextSteps" maxlength="5000">${esc(p.nextSteps || "")}</textarea></div><div class="field"><label for="product-terms">Default Service Agreement</label><textarea id="product-terms" name="terms" class="agreement-editor" maxlength="20000">${esc(p.terms || "")}</textarea></div><label><input name="requiresAgreement" type="checkbox" ${(p.requiresAgreement ?? p.kind !== "Product") ? "checked" : ""}> Include a Service Agreement by default.</label><label><input name="approved" type="checkbox" ${p.approved ? "checked" : ""}> I have reviewed and approved this template.</label><label><input name="archived" type="checkbox" ${p.archived ? "checked" : ""}> Archive this offer from new invoice selections.</label><div class="actions"><button class="btn primary">Save Defaults</button><button type="button" class="btn" id="save-product-draft">Save As Draft</button><button type="button" class="btn" id="cancel-product">Cancel</button></div><p class="small muted">Tax defaults to 0%. Set the rate that applies to your business and this offer.</p></form>`;
}
function newBillingDraft() {
  const client = state.leads.find((l) => l.email === billingCustomerFilter);
  const p =
    billingData.products.find(
      (p) =>
        !p.archived &&
        client &&
        p.id === innerCodePackages.get(state.programmes[client.id]).id,
    ) || billingData.products.find((p) => !p.archived);
  return {
    customer: {
      name: state.leads.find((l) => l.email === billingCustomerFilter)
        ? (() => {
            const l = state.leads.find(
              (l) => l.email === billingCustomerFilter,
            );
            return l.first + " " + l.last;
          })()
        : "",
      email: billingCustomerFilter,
      phone: client?.phone || "",
    },
    due: day,
    issueDate: day,
    agreementDate: day,
    items: p ? [lineFromProduct(p)] : [],
    terms: p?.terms || "",
    nextSteps: p?.nextSteps || programmeContent.nextText(p?.id) || "",
    formatting: { terms: p?.formatting?.terms },
    requiresAgreement: p?.requiresAgreement ?? p?.kind !== "Product",
    approved: false,
    payment:
      p && !Number(p.tax)
        ? innerCodePayments.instructions(p.id, p.price, p.currency)
        : "",
    notes: "",
  };
}
function lineFromProduct(p) {
  return {
    productId: p.id,
    name: p.name,
    description: p.description,
    formatting: { description: p.formatting?.description },
    quantity: 1,
    price: p.price,
    tax: p.tax,
    discount: 0,
  };
}
function editorFromDocument(d) {
  return {
    ...structuredClone(d),
    items: d.items.map((i) => ({
      ...i,
      price: i.unit / 100,
      discount: i.discount / 100,
    })),
  };
}
function captureInvoice() {
  const f = document.querySelector("#invoice-form");
  if (!f) return;
  const formatting = documentEditing.capture(f);
  const v = Object.fromEntries(new FormData(f));
  Object.assign(documentEditor, {
    customer: {
      name: v.customerName,
      email: v.customerEmail,
      phone: v.customerPhone,
    },
    due: v.due,
    issueDate: v.issueDate,
    agreementDate: v.agreementDate,
    payment: v.payment,
    notes: v.notes,
    terms: v.terms,
    nextSteps: v.nextSteps,
    formatting: {
      terms: formatting.terms,
      payment: formatting.payment,
      notes: formatting.notes,
      nextSteps: formatting.nextSteps,
    },
    approved: f.elements.approved.checked,
    requiresAgreement: f.elements.requiresAgreement.checked,
  });
  documentEditor.items = documentEditor.items.map((i, n) => ({
    ...i,
    formatting: { description: formatting[`description-${n}`] },
    ...Object.fromEntries(
      ["name", "description", "quantity", "price", "discount", "tax"].map(
        (k) => [k, v[`${k}-${n}`]],
      ),
    ),
  }));
}
function invoiceForm(d) {
  const active = billingData.products.filter((p) => !p.archived);
  return `<form id="invoice-form" class="card"><h2>${d.id ? "Customize Client Documents" : "Create Client Documents"}</h2><div class="field"><label for="billing-customer">Use Existing Client (Optional)</label><select id="billing-customer"><option value="">Enter customer manually</option>${clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="form-grid"><div class="field"><label for="billing-name">Customer Name</label><input id="billing-name" name="customerName" value="${esc(d.customer.name)}" required maxlength="200"></div><div class="field"><label for="billing-email">Customer Email</label><input id="billing-email" name="customerEmail" type="email" value="${esc(d.customer.email)}" required maxlength="254"></div><div class="field"><label for="billing-phone">Customer Phone</label><input id="billing-phone" name="customerPhone" value="${esc(d.customer.phone || "")}" maxlength="100"></div><div class="field"><label for="billing-issued">Issue Date</label><input id="billing-issued" name="issueDate" type="date" value="${esc(d.issueDate || day)}" required></div><div class="field"><label for="billing-agreement-date">Coach Agreement Date</label><input id="billing-agreement-date" name="agreementDate" type="date" value="${esc(d.agreementDate || "")}"></div><div class="field"><label for="billing-due">Payment Due</label><input id="billing-due" name="due" type="date" value="${d.due}" required></div></div><h3>Invoice Items</h3>${d.items.map((i, n) => `<fieldset class="billing-item"><legend>Item ${n + 1}</legend><div class="field"><label for="item-product-${n}">Product / Service</label><select id="item-product-${n}" data-line-product="${n}">${active.map((p) => `<option value="${p.id}" ${p.id === i.productId ? "selected" : ""}>${esc(p.name)} · ${p.currency}</option>`).join("")}</select></div><div class="field"><label for="item-name-${n}">Name</label><input id="item-name-${n}" name="name-${n}" value="${esc(i.name)}" required></div><div class="field"><label for="item-description-${n}">Description</label><textarea id="item-description-${n}" name="description-${n}" maxlength="2000">${esc(i.description)}</textarea></div><div class="form-grid"><div class="field"><label for="item-quantity-${n}">Quantity</label><input id="item-quantity-${n}" name="quantity-${n}" type="number" min="1" max="10000" step="1" value="${i.quantity}" required></div><div class="field"><label for="item-price-${n}">Unit Price</label><input id="item-price-${n}" name="price-${n}" type="number" min="0" step=".01" value="${i.price}" required></div><div class="field"><label for="item-discount-${n}">Line Discount (Amount)</label><input id="item-discount-${n}" name="discount-${n}" type="number" min="0" step=".01" value="${i.discount}" required></div><div class="field"><label for="item-tax-${n}">Applicable Tax (%)</label><input id="item-tax-${n}" name="tax-${n}" type="number" min="0" max="100" step=".01" value="${i.tax}" required></div></div>${i.productId === "inner-code" && billingData.products.some((p) => p.id === i.productId && p.price === 500 && p.currency === "CAD") ? `<div class="actions"><button type="button" class="btn subtle" data-inner-stage="${n}:150">Use $150 Deposit</button><button type="button" class="btn subtle" data-inner-stage="${n}:350">Use $350 Balance</button><button type="button" class="btn subtle" data-inner-stage="${n}:500">Full $500</button></div>` : ""}<button type="button" class="btn subtle" data-line-remove="${n}">Remove Item</button><button type="button" class="btn subtle" data-item-variant="${n}">Save Item As New Variant</button></fieldset>`).join("")}<button class="btn" type="button" id="add-billing-item" ${active.length ? "" : "disabled"}>Add Item</button><div class="field"><label for="billing-payment">Payment Instructions / Schedule</label><textarea id="billing-payment" name="payment" maxlength="3000">${esc(d.payment)}</textarea></div><div class="field"><label for="billing-notes">Invoice Notes</label><textarea id="billing-notes" name="notes" maxlength="3000">${esc(d.notes)}</textarea></div><div class="field"><label for="billing-next-steps">What Happens Next (Email)</label><textarea id="billing-next-steps" name="nextSteps" maxlength="5000">${esc(d.nextSteps || "")}</textarea></div><label><input name="requiresAgreement" type="checkbox" ${d.requiresAgreement !== false ? "checked" : ""}> Include Service Agreement</label><div class="agreement-fields"><h3>Customize Service Agreement</h3><p class="small muted">These changes apply only to this client. If you add another service, include its scope and terms below before approving.</p><div class="field"><label for="billing-terms">Client Service Agreement Terms</label><textarea id="billing-terms" name="terms" class="agreement-editor" maxlength="20000">${esc(d.terms)}</textarea></div></div><label><input name="approved" type="checkbox" ${d.approved ? "checked" : ""}> I have reviewed the scope, amounts, payment schedule and terms for this customer.</label><div class="actions"><button class="btn primary">Save Draft & Preview</button><button type="button" class="btn" id="cancel-invoice">Cancel</button></div><p class="small muted">Saving a draft does not issue documents or send email. Catalog defaults are unchanged.</p></form>`;
}
async function billingMutation(path, data) {
  return (
    await api("/api/billing/" + path, {
      method: "POST",
      headers: { "X-CSRF-Token": window.__session.csrf },
      body: JSON.stringify(data),
    })
  ).result;
}
function bindBilling() {
  documentEditing.mount(document, {
    product: productEditor,
    invoice: documentEditor,
  });
  if (
    !["catalogue", "billing"].includes(state.view) ||
    window.__session.role !== "coach"
  )
    return;
  const on = (s, event, fn) =>
    document.querySelector(s)?.addEventListener(event, fn);
  const action = (fn) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await fn(e);
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  };
  on("#billing-customer-filter", "change", (e) => {
    billingCustomerFilter = e.target.value;
    render();
  });
  on("#billing-reload", "click", () => {
    billingError = "";
    refreshBilling();
  });
  on("#new-product", "click", () => {
    productEditor = {};
    render();
  });
  on("#cancel-product", "click", () => {
    productEditor = null;
    render();
  });
  document
    .querySelectorAll("[data-product-edit],[data-product-variant]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const p = billingData.products.find(
            (p) => p.id === (b.dataset.productEdit || b.dataset.productVariant),
          );
          productEditor = structuredClone(p);
          if (b.dataset.productVariant) {
            delete productEditor.id;
            delete productEditor.version;
            productEditor.name += " — New Variant";
            productEditor.approved = false;
            productEditor.archived = false;
          }
          render();
        }),
    );
  on("#product-form", "submit", async (e) => {
    e.preventDefault();
    const f = e.target,
      b = f.querySelector('button:not([type="button"])');
    b.disabled = true;
    try {
      const formatting = documentEditing.capture(f);
      await billingMutation("product", {
        ...productEditor,
        ...Object.fromEntries(new FormData(f)),
        formatting,
        approved: f.elements.approved.checked,
        requiresAgreement: f.elements.requiresAgreement.checked,
        archived: f.elements.archived.checked,
      });
      productEditor = null;
      await refreshWorkspaceState();
      await refreshBilling();
      toast("Product defaults saved.");
    } catch (err) {
      let errorBox = f.querySelector("[data-document-save-error]");
      if (!errorBox) {
        errorBox = document.createElement("div");
        errorBox.className = "note document-save-error";
        errorBox.dataset.documentSaveError = "true";
        errorBox.setAttribute("role", "alert");
        f.append(errorBox);
      }
      errorBox.textContent = err.message;
      errorBox.scrollIntoView({ block: "nearest" });
      toast("Not saved yet. See the message below your editor.");
    } finally {
      b.disabled = false;
    }
  });
  on("#save-product-draft", "click", () => {
    const form = document.querySelector("#product-form");
    form.elements.approved.checked = false;
    form.requestSubmit();
  });
  on("#new-invoice", "click", () => {
    documentEditor = newBillingDraft();
    render();
  });
  on("#cancel-invoice", "click", () => {
    documentEditor = null;
    render();
  });
  on("#billing-customer", "change", (e) => {
    captureInvoice();
    const c = state.leads.find((c) => c.id === e.target.value);
    if (c) {
      documentEditor.customer = {
        name: c.first + " " + c.last,
        email: c.email,
        phone: c.phone || "",
      };
      render();
    }
  });
  on("#add-billing-item", "click", () => {
    captureInvoice();
    const p = billingData.products.find((p) => !p.archived);
    documentEditor.items.push(lineFromProduct(p));
    documentEditor.approved = false;
    render();
  });
  document.querySelectorAll("[data-line-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        captureInvoice();
        documentEditor.items.splice(Number(b.dataset.lineRemove), 1);
        documentEditor.approved = false;
        render();
      }),
  );
  document.querySelectorAll("[data-line-product]").forEach(
    (b) =>
      (b.onchange = () => {
        captureInvoice();
        const p = billingData.products.find((p) => p.id === b.value);
        documentEditor.items[Number(b.dataset.lineProduct)] =
          lineFromProduct(p);
        if (documentEditor.items.length === 1) {
          documentEditor.payment = !Number(p.tax)
            ? innerCodePayments.instructions(p.id, p.price, p.currency)
            : "";
          documentEditor.terms = p.terms;
          documentEditor.nextSteps =
            p.nextSteps || programmeContent.nextText(p.id) || "";
          documentEditor.formatting = { terms: p.formatting?.terms };
          documentEditor.requiresAgreement =
            p.requiresAgreement ?? p.kind !== "Product";
        }
        documentEditor.approved = false;
        render();
      }),
  );
  document.querySelectorAll("[data-inner-stage]").forEach(
    (b) =>
      (b.onclick = () => {
        captureInvoice();
        const [n, price] = b.dataset.innerStage.split(":").map(Number);
        Object.assign(documentEditor.items[n], {
          price,
          name:
            price === 500
              ? "Inner Code"
              : "Inner Code — " + (price === 150 ? "Deposit" : "Balance"),
        });
        documentEditor.payment =
          documentEditor.items.length === 1 &&
          !Number(documentEditor.items[n].tax) &&
          !Number(documentEditor.items[n].discount)
            ? innerCodePayments.instructions(
                documentEditor.items[n].productId,
                price,
                "CAD",
              )
            : "";
        documentEditor.approved = false;
        render();
      }),
  );
  document.querySelectorAll("[data-item-variant]").forEach(
    (b) =>
      (b.onclick = () => {
        captureInvoice();
        const item = documentEditor.items[Number(b.dataset.itemVariant)];
        const original = billingData.products.find(
          (p) => p.id === item.productId,
        );
        productEditor = {
          name: item.name + " — New Variant",
          kind: original.kind,
          description: item.description,
          price: Number(item.price),
          currency: original.currency,
          tax: Number(item.tax),
          terms: documentEditor.terms,
          formatting: {
            description: item.formatting?.description,
            terms: documentEditor.formatting?.terms,
          },
          approved: false,
          archived: false,
        };
        state.view = "catalogue";
        render();
      }),
  );
  for (const id of ["#product-form", "#invoice-form"])
    on(id, "input", (e) => {
      if (e.target.name !== "approved" && e.currentTarget.elements.approved)
        e.currentTarget.elements.approved.checked = false;
    });
  on("#invoice-form", "submit", async (e) => {
    e.preventDefault();
    captureInvoice();
    const b = e.target.querySelector(
      'button[type="submit"],button:not([type])',
    );
    b.disabled = true;
    try {
      await billingMutation("draft", documentEditor);
      documentEditor = null;
      await refreshBilling();
      toast("Draft saved. Preview both documents below.");
    } catch (err) {
      const f = e.target;
      let errorBox = f.querySelector("[data-document-save-error]");
      if (!errorBox) {
        errorBox = document.createElement("div");
        errorBox.className = "note document-save-error";
        errorBox.dataset.documentSaveError = "true";
        errorBox.setAttribute("role", "alert");
        f.append(errorBox);
      }
      errorBox.textContent = err.message;
      errorBox.scrollIntoView({ block: "nearest" });
      toast("Not saved yet. See the message below your editor.");
    } finally {
      b.disabled = false;
    }
  });
  document.querySelectorAll("[data-document-delete]").forEach((button) => {
    button.onclick = action(async () => {
      const d = billingData.documents.find(
        (d) => d.id === button.dataset.documentDelete,
      );
      const message =
        d.status === "Draft"
          ? `Delete this draft for ${d.customer.name}? You can restore it from Deleted Drafts.`
          : `Permanently delete mistaken invoice ${d.reference} for ${d.customer.name}? An email already sent cannot be recalled. Linked payment records prevent deletion.`;
      if (!window.confirm(message)) return;
      const result = await billingMutation("delete", {
        id: d.id,
        version: d.version,
        confirm: true,
      });
      if (documentEditor?.id === d.id) documentEditor = null;
      await refreshWorkspaceState();
      await refreshBilling();
      toast(
        result.restorable
          ? "Draft deleted. Restore is available below."
          : "Mistaken invoice deleted from Billing.",
      );
    });
  });
  document.querySelectorAll("[data-draft-restore]").forEach((button) => {
    button.onclick = action(async () => {
      const d = billingData.trash.find(
        (d) => d.id === button.dataset.draftRestore,
      );
      await billingMutation("restore", { id: d.id, version: d.version });
      await refreshBilling();
      toast("Draft restored.");
    });
  });
  document.querySelectorAll("[data-document-edit]").forEach(
    (b) =>
      (b.onclick = () => {
        documentEditor = editorFromDocument(
          billingData.documents.find((d) => d.id === b.dataset.documentEdit),
        );
        render();
      }),
  );
  document.querySelectorAll("[data-document-issue]").forEach(
    (b) =>
      (b.onclick = action(async () => {
        const d = billingData.documents.find(
          (d) => d.id === b.dataset.documentIssue,
        );
        await billingMutation("issue", { id: d.id, version: d.version });
        await refreshBilling();
        toast("Documents issued and frozen. No email sent.");
      })),
  );
  document.querySelectorAll("[data-document-revise]").forEach(
    (b) =>
      (b.onclick = action(async () => {
        const d = await billingMutation("revise", {
          id: b.dataset.documentRevise,
        });
        documentEditor = editorFromDocument(d);
        await refreshBilling();
      })),
  );
  document.querySelectorAll("[data-record-payment]").forEach(
    (b) =>
      (b.onclick = () => {
        billingPaymentEditor = billingData.documents.find(
          (d) => d.id === b.dataset.recordPayment,
        );
        render();
        document
          .querySelector("#billing-receipt-form")
          .scrollIntoView({ behavior: "smooth" });
      }),
  );
  on("#cancel-receipt", "click", () => {
    billingPaymentEditor = null;
    render();
  });
  on("#billing-receipt-form", "submit", async (e) => {
    e.preventDefault();
    const form = e.target,
      button = form.querySelector('button:not([type="button"])');
    button.disabled = true;
    try {
      const v = Object.fromEntries(new FormData(form));
      await billingMutation("payment", {
        ...v,
        id: billingPaymentEditor.id,
        verified: form.elements.verified.checked,
      });
      billingPaymentEditor = null;
      await refreshBilling();
      toast("Verified payment recorded. Your receipt is ready.");
    } catch (err) {
      toast(err.message);
      button.disabled = false;
    }
  });
  document.querySelectorAll("[data-document-queue]").forEach(
    (b) =>
      (b.onclick = action(async () => {
        await saveChain;
        await billingMutation("queue", { id: b.dataset.documentQueue });
        await refreshWorkspaceState();
        await refreshBilling();
        toast("Email prepared. Review and send it from Email Center.");
      })),
  );
}

function receiptForm(d) {
  const received = (billingData.payments || [])
      .filter((p) => p.invoiceId === d.id)
      .reduce((n, p) => n + p.receipt.amount, 0),
    outstanding = d.total - received;
  return `<form id="billing-receipt-form" class="card"><h2>Record Verified Payment</h2><p>${esc(d.customer.name)} · ${esc(d.reference)} · Outstanding: ${billMoney(outstanding, d.currency)}</p><div class="form-grid"><div class="field"><label>Amount Received (${d.currency})</label><input name="amount" type="number" min=".01" max="${outstanding / 100}" step=".01" value="${outstanding / 100}" required></div><div class="field"><label>Payment Date</label><input name="date" type="date" value="${day}" required></div><div class="field"><label>Payment Method</label><input name="method" required maxlength="100"></div><div class="field"><label>Transaction Reference</label><input name="reference" required maxlength="200"></div></div><label><input name="verified" type="checkbox" required> I have checked that this payment reached my account.</label><div class="actions"><button class="btn primary" ${outstanding <= 0 ? "disabled" : ""}>Record Payment & Create Receipt</button><button class="btn" type="button" id="cancel-receipt">Cancel</button></div><p class="small muted">This records your verification; it does not charge a card or verify a bank transfer automatically.</p></form>`;
}
