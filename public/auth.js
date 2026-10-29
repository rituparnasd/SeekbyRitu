const root = document.querySelector("#app");
const escapeText = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Request failed");
  return data;
}
function layout(content) {
  root.innerHTML = `<main class="auth-shell"><div class="brand"><img class="brand-logo" src="/assets/seekbyritu-logo.png" alt="Seek by Ritu original logo"><span>SeekbyRitu</span></div><p class="eyebrow">PRIVATE COACHING WORKSPACE</p><section class="card">${content}</section><p class="small muted">Your account data is stored on the configured server. No sample clients are loaded.</p></main>`;
}
function error(message) {
  const el = document.querySelector("#auth-error");
  if (el) el.textContent = message;
}
async function boot() {
  try {
    localStorage.removeItem("seek-demo-v1");
    const config = await api("/api/config");
    window.__config = config;
    if (!config.ready) {
      layout(
        `<h1>Server Setup Required</h1><p>The workspace is locked until secure storage is configured.</p><p class="muted">Missing settings: ${escapeText(config.missing.join(", ") || "Check database connectivity and encryption key configuration.")}</p>${config.setupDiagnostic ? `<div class="note"><strong>Setup Code: ${escapeText(config.setupDiagnostic.code)}</strong><p>${escapeText(config.setupDiagnostic.hint)}</p></div>` : ""}<p>Set these in Render → Service → Environment. Share only the setup code; never paste credentials in chat.</p>`,
      );
      return;
    }
    let me;
    try {
      me = await api("/api/me");
    } catch {}
    if (me) {
      window.__session = me;
      const result = await api("/api/state");
      window.__initialState = result.state;
      window.__serverBase = structuredClone(result.state);
      window.__revision = result.revision;
      const script = document.createElement("script");
      script.src = "/app.js";
      document.body.append(script);
      return;
    }
    const token = new URL(location.href).searchParams.get("invite");
    if (token) {
      layout(
        `<h1>Set Your Password</h1><form id="invite-form"><label>New Password (14+ Characters)</label><input type="password" name="password" minlength="14" maxlength="200" required autocomplete="new-password"><button class="btn primary">Activate Account</button></form><p id="auth-error" role="alert"></p>`,
      );
      document.querySelector("#invite-form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("/api/accept-invite", {
            method: "POST",
            body: JSON.stringify({
              token,
              password: new FormData(e.target).get("password"),
            }),
          });
          history.replaceState({}, "", location.pathname);
          login();
        } catch (err) {
          error(err.message);
        }
      };
      return;
    }
    if (config.setupRequired) {
      layout(
        `<h1>Create Coach Account</h1><p>One-time owner setup. Your authenticator app will be required for every coach login.</p><form id="setup-form"><label>Owner Setup Token</label><input name="token" type="password" required autocomplete="off"><label>Email</label><input name="email" type="email" required autocomplete="username"><label>Password (14+ Characters)</label><input name="password" type="password" minlength="14" maxlength="200" required autocomplete="new-password"><button class="btn primary">Create Owner</button></form><p id="auth-error" role="alert"></p>`,
      );
      document.querySelector("#setup-form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          const data = await api("/api/setup", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
          });
          layout(
            `<h1>Set Up Your Authenticator</h1><p>Add a manual entry in your authenticator app. Store this secret securely now; it will not be shown again.</p><code class="secret">${escapeText(data.secret)}</code><p>Save these single-use recovery codes offline too: ${data.recoveryCodes.map(escapeText).join(" · ")}. A recovery code can replace the authenticator code at login. Never share these codes.</p><button class="btn primary" id="setup-done">I Saved It — Continue To Login</button>`,
          );
          document.querySelector("#setup-done").onclick = login;
        } catch (err) {
          error(err.message);
        }
      };
      return;
    }
    login();
  } catch (e) {
    layout(`<h1>Unable To Connect</h1><p>${escapeText(e.message)}</p>`);
  }
}
function login() {
  layout(
    `<h1>Welcome Back</h1><form id="login-form"><label>Email</label><input type="email" name="email" required autocomplete="username"><label>Password</label><input type="password" name="password" required autocomplete="current-password"><label>Coach Authenticator Code (Clients Leave Blank)</label><input name="code" inputmode="numeric" maxlength="32" autocomplete="one-time-code"><button class="btn primary">Sign In</button></form><p id="auth-error" role="alert"></p><p class="small muted">Need to reset your password? Contact your coach for a new single-use setup link.</p>`,
  );
  document.querySelector("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
      });
      location.reload();
    } catch (err) {
      error(err.message);
    }
  };
}
boot();
