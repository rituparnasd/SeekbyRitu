import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
export function databaseOptions(value, caPEM) {
  const u = new URL(value);
  if (!["postgres:", "postgresql:"].includes(u.protocol))
    throw Object.assign(Error("PostgreSQL URL required"), {
      code: "SEEK_DATABASE_URL",
    });
  for (const k of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    u.searchParams.delete(k);
  const ssl = { rejectUnauthorized: true };
  if (caPEM) {
    const text = caPEM.replace(/\\n/g, "\n");
    const certificates = text.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    );
    try {
      if (!certificates?.length) throw Error();
      for (const certificate of certificates) {
        const parsed = new X509Certificate(certificate);
        if (!parsed.ca) throw Error();
      }
    } catch {
      throw Object.assign(Error("Provider CA certificate required"), {
        code: "SEEK_DATABASE_CA_FORMAT",
      });
    }
    ssl.ca = [...rootCertificates, ...certificates];
  }
  return {
    connectionString: u.toString(),
    ssl,
    max: 5,
    connectionTimeoutMillis: 10000,
  };
}
