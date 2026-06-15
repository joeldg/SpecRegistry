import type { FastifyRequest } from "fastify";

export function publicUrl(req?: FastifyRequest): string {
  const configured = process.env.SPECREG_PUBLIC_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const host = req?.headers["x-forwarded-host"] ?? req?.headers.host;
  if (typeof host === "string" && host.trim()) {
    const protoHeader = req?.headers["x-forwarded-proto"];
    const proto = typeof protoHeader === "string" && protoHeader ? protoHeader.split(",")[0].trim() : "http";
    return `${proto}://${host}`;
  }

  return `http://localhost:${process.env.PORT ?? 4000}`;
}
