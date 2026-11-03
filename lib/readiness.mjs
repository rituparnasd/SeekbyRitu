// Render must not treat a locked or disconnected workspace as a healthy release.
export async function readiness(db) {
  if (!db)
    return { status: 503, body: { status: "setup_required", ready: false } };
  try {
    const rows = await db.query("SELECT 1 AS ready");
    if (Number(rows[0]?.ready) !== 1) throw Error("Storage not ready");
    return { status: 200, body: { status: "ok", ready: true } };
  } catch {
    return {
      status: 503,
      body: { status: "storage_unavailable", ready: false },
    };
  }
}
