import os from "node:os";
import type { FastifyRequest } from "fastify";
import type { Db } from "../db.js";
import { HttpError } from "../helpers.js";

const PUBLIC_HOSTNAME_KEY = "server.public_hostname";

export interface PublicUrlConfig {
  public_hostname: string;
  detected_ip: string;
  effective_public_url: string;
  source: "env" | "setting" | "forwarded" | "detected_ip";
}

interface ResolvePublicUrlInput {
  envPublicUrl?: string;
  publicHostname?: string;
  forwardedHost?: string;
  host?: string;
  forwardedProto?: string;
  port?: string;
  detectedIp: string;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function firstForwarded(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function hostnameFromHost(host: string): string {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.split(":")[0] ?? host;
  }
}

function portFromHost(host?: string): string | undefined {
  if (!host) return undefined;
  try {
    return new URL(`http://${host}`).port || undefined;
  } catch {
    const match = host.match(/:(\d+)$/);
    return match?.[1];
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || host === "127.0.0.1" || /^127\./.test(host);
}

/** The wildcard bind address — never a valid client-facing URL, even if set explicitly. */
function isUnspecifiedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "0.0.0.0" || host === "::";
}

/**
 * Replace an unreachable hostname with the detected server IP. A wildcard bind
 * address (0.0.0.0) is always replaced. A loopback address (localhost/127.x) is
 * replaced only when it was *auto-detected* — when an operator sets it explicitly
 * (SPECREG_PUBLIC_URL or the public-hostname setting) it is honored, so a co-located
 * single-host deployment can advertise http://127.0.0.1:4000 on purpose.
 */
function rewriteUnreachable(parsed: URL, detectedIp: string, preserveLoopback: boolean): void {
  if (isUnspecifiedHostname(parsed.hostname) || (isLoopbackHostname(parsed.hostname) && !preserveLoopback)) {
    parsed.hostname = detectedIp;
  }
}

function normalizeUrl(url: string, detectedIp: string, preserveLoopback = false): string {
  const parsed = new URL(trimTrailingSlash(url));
  rewriteUnreachable(parsed, detectedIp, preserveLoopback);
  return parsed.toString().replace(/\/+$/, "");
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function hostToUrl(hostValue: string, proto: string, fallbackPort: string | undefined, detectedIp: string, preserveLoopback = false): string {
  const trimmed = hostValue.trim();
  if (!trimmed || trimmed.includes("/")) throw new HttpError(400, "Public hostname must be a hostname, host:port, or http(s) URL.");
  const parsed = new URL(`${proto}://${trimmed}`);
  rewriteUnreachable(parsed, detectedIp, preserveLoopback);
  if (!parsed.port && fallbackPort && !((proto === "http" && fallbackPort === "80") || (proto === "https" && fallbackPort === "443"))) {
    parsed.port = fallbackPort;
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function detectServerIpAddress(): string {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (!address.internal) return address.address;
    }
  }
  return "0.0.0.0";
}

export function resolvePublicUrl(input: ResolvePublicUrlInput): { url: string; source: PublicUrlConfig["source"] } {
  const proto = firstForwarded(input.forwardedProto) ?? "http";
  const requestPort = portFromHost(input.forwardedHost) ?? portFromHost(input.host);
  const fallbackPort = requestPort ?? input.port;
  const envPublicUrl = input.envPublicUrl ? trimTrailingSlash(input.envPublicUrl) : "";
  // Explicit operator configuration (env + setting) is honored verbatim, including an
  // intentional loopback host for a co-located single-host deployment.
  if (envPublicUrl) return { url: normalizeUrl(envPublicUrl, input.detectedIp, true), source: "env" };

  const publicHostname = input.publicHostname ? input.publicHostname.trim() : "";
  if (publicHostname) {
    return {
      url: isUrlLike(publicHostname)
        ? normalizeUrl(publicHostname, input.detectedIp, true)
        : hostToUrl(publicHostname, proto, fallbackPort, input.detectedIp, true),
      source: "setting",
    };
  }

  const forwardedHost = input.forwardedHost?.trim();
  if (forwardedHost) {
    return { url: hostToUrl(forwardedHost, proto, undefined, input.detectedIp), source: "forwarded" };
  }

  return { url: hostToUrl(input.detectedIp, proto, fallbackPort ?? "4000", input.detectedIp), source: "detected_ip" };
}

export function getPublicHostnameConfig(db: Db): string {
  return (db.prepare("SELECT value FROM settings WHERE key = ?").get(PUBLIC_HOSTNAME_KEY) as { value?: string } | undefined)?.value ?? "";
}

export function savePublicHostnameConfig(db: Db, publicHostname: string): string {
  const value = publicHostname.trim();
  if (value && !isUrlLike(value) && value.includes("/")) {
    throw new HttpError(400, "Public hostname must be a hostname, host:port, or http(s) URL.");
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(PUBLIC_HOSTNAME_KEY, trimTrailingSlash(value));
  return getPublicHostnameConfig(db);
}

export function getPublicUrlConfig(db: Db, req?: FastifyRequest): PublicUrlConfig {
  const detectedIp = detectServerIpAddress();
  const resolved = resolvePublicUrl({
    envPublicUrl: process.env.SPECREG_PUBLIC_URL,
    publicHostname: getPublicHostnameConfig(db),
    forwardedHost: firstHeader(req?.headers["x-forwarded-host"]),
    host: firstHeader(req?.headers.host),
    forwardedProto: firstHeader(req?.headers["x-forwarded-proto"]),
    port: process.env.PORT ?? "4000",
    detectedIp,
  });
  return {
    public_hostname: getPublicHostnameConfig(db),
    detected_ip: detectedIp,
    effective_public_url: resolved.url,
    source: resolved.source,
  };
}

export function publicUrl(db: Db, req?: FastifyRequest): string {
  return getPublicUrlConfig(db, req).effective_public_url;
}
