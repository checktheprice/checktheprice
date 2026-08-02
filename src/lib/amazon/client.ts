// Amazon Creators API client (replaces PA API v5 + AWS SigV4).
// OAuth 2.0 client-credentials -> 1 hour bearer token -> POST /catalog/v1/*.
// Server-only: never import this from client components.
import { createHash } from "node:crypto";

export type CreatorsOperation = "SearchItems" | "GetItems" | "GetVariations" | "BrowseNodes";

const BASE_URL = "https://creatorsapi.amazon/catalog/v1";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

/** e.g. "v3.2" -> "3.2" (the Authorization header wants the bare number). */
function credentialVersion(): string {
  const raw = process.env.AMAZON_CREDENTIAL_VERSION ?? "v3.2";
  return raw.trim().replace(/^v/i, "");
}

export function marketplace(): string {
  return process.env.AMAZON_MARKETPLACE ?? "www.amazon.in";
}

/**
 * Login with Amazon (v3.x) or Cognito (v2.x) token endpoint.
 * Region is chosen by the credential Version; override with AMAZON_TOKEN_ENDPOINT.
 */
function tokenEndpoint(): string {
  const override = process.env.AMAZON_TOKEN_ENDPOINT;
  if (override) return override;

  const version = credentialVersion();
  const minor = version.split(".")[1] ?? "2";

  if (version.startsWith("2")) {
    const region = minor === "1" ? "us-east-1" : minor === "3" ? "us-west-2" : "eu-south-2";
    return `https://creatorsapi.auth.${region}.amazoncognito.com/oauth2/token`;
  }
  // v3.x -> LWA regional endpoints: .1 = NA, .2 = EU (incl. IN), .3 = FE
  const host = minor === "1" ? "api.amazon.com" : minor === "3" ? "api.amazon.co.jp" : "api.amazon.co.uk";
  return `https://${host}/auth/o2/token`;
}

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

async function accessToken(): Promise<string> {
  // 60s safety margin so a request never travels with a token that expires mid-flight.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const clientId = env("AMAZON_CREDENTIAL_ID");
  const clientSecret = env("AMAZON_CREDENTIAL_SECRET");
  const endpoint = tokenEndpoint();
  const isCognito = endpoint.includes("amazoncognito.com");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: isCognito
      ? {
          "content-type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        }
      : { "content-type": "application/json" },
    body: isCognito
      ? new URLSearchParams({ grant_type: "client_credentials", scope: "creatorsapi/default" }).toString()
      : JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "creatorsapi::default",
        }),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Creators API token ${res.status}: ${text.slice(0, 500)}`) as Error & {
      status?: number;
      retryable?: boolean;
    };
    err.status = res.status;
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }

  const data = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Creators API token response had no access_token");

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

function pathFor(op: CreatorsOperation): string {
  switch (op) {
    case "SearchItems":
      return "/searchItems";
    case "GetItems":
      return "/getItems";
    case "GetVariations":
      return "/getVariations";
    case "BrowseNodes":
      return "/getBrowseNodes";
  }
}

export async function creatorsRequest<T>(
  op: CreatorsOperation,
  payload: Record<string, unknown>,
): Promise<T> {
  const partnerTag = env("AMAZON_PARTNER_TAG");
  const mp = marketplace();
  const token = await accessToken();

  const body = JSON.stringify({
    ...payload,
    partnerTag,
    partnerType: "Associates",
    marketplace: mp,
  });

  const res = await fetch(`${BASE_URL}${pathFor(op)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}, Version ${credentialVersion()}`,
      "content-type": "application/json",
      "x-marketplace": mp,
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    // 401 usually means the cached token went stale early - drop it so the retry re-mints.
    if (res.status === 401) cachedToken = null;
    const err = new Error(`Creators API ${op} ${res.status}: ${text.slice(0, 500)}`) as Error & {
      status?: number;
      retryable?: boolean;
    };
    err.status = res.status;
    err.retryable = res.status === 429 || res.status === 401 || res.status >= 500;
    throw err;
  }
  return JSON.parse(text) as T;
}

/** Kept for backwards compatibility with existing imports. */
export const paapiRequest = creatorsRequest;

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
