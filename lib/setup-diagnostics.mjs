const messages = {
  KEY_FORMAT:
    "DATA_ENCRYPTION_KEY must contain the saved output of openssl rand -base64 32, not the command itself. Do not generate a replacement key for an existing database.",
  DATABASE_URL_FORMAT:
    "Re-copy the complete PostgreSQL connection URL from Render. Do not include quotes, a label, or the copy command.",
  DATABASE_AUTH:
    "PostgreSQL rejected the username/password. Re-copy the current connection URL from the intended Render database; do not share it in chat.",
  DATABASE_NAME:
    "The database named in DATABASE_URL does not exist. Check the intended database connection URL.",
  DATABASE_DNS:
    "The database hostname could not be resolved. Check the copied URL and that the web service and database use the appropriate region/network.",
  DATABASE_NETWORK:
    "The database could not be reached. Check that it is running and the connection URL/network is correct.",
  DATABASE_TLS:
    "The database TLS certificate could not be verified. Keep verification enabled; use the provider-supported hostname and trusted certificate configuration.",
  DATABASE_CA_FORMAT:
    "DATABASE_CA_CERT must contain the provider-issued CA certificate in PEM format. Do not paste a password, URL, private key, or a certificate obtained from an unverified connection.",
  DATABASE_TLS_UNSUPPORTED:
    "The selected database endpoint does not offer the TLS connection required by this app. Use a provider-supported TLS endpoint; verification has not been disabled.",
  DATABASE_PERMISSION:
    "The database account cannot create or access the required tables. Check database user permissions.",
  DATABASE_SETUP:
    "Database setup failed. Share only this code with the developer; never the database URL or secret values.",
};
export function setupDiagnosis(stage, error) {
  let code = "DATABASE_SETUP";
  if (stage === "encryption") code = "KEY_FORMAT";
  else {
    const c = String(error?.code || "");
    if (c === "ERR_INVALID_URL" || c === "SEEK_DATABASE_URL")
      code = "DATABASE_URL_FORMAT";
    else if (c === "SEEK_DATABASE_CA_FORMAT") code = "DATABASE_CA_FORMAT";
    else if (c === "28P01" || c === "28000") code = "DATABASE_AUTH";
    else if (c === "3D000") code = "DATABASE_NAME";
    else if (["ENOTFOUND", "EAI_AGAIN"].includes(c)) code = "DATABASE_DNS";
    else if (
      [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ECONNRESET",
        "ENETUNREACH",
        "EHOSTUNREACH",
      ].includes(c)
    )
      code = "DATABASE_NETWORK";
    else if (
      [
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
        "CERT_HAS_EXPIRED",
        "ERR_TLS_CERT_ALTNAME_INVALID",
      ].includes(c)
    )
      code = "DATABASE_TLS";
    else if (c === "42501") code = "DATABASE_PERMISSION";
    else if (/does not support SSL/i.test(String(error?.message || "")))
      code = "DATABASE_TLS_UNSUPPORTED";
    else if (/timeout|timed out/i.test(String(error?.message || "")))
      code = "DATABASE_NETWORK";
  }
  const tlsCodes = new Set([
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ]);
  const tlsCode = tlsCodes.has(error?.code) ? error.code : undefined;
  return { code, hint: messages[code], ...(tlsCode ? { tlsCode } : {}) };
}
