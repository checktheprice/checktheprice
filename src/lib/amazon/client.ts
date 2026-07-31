// AWS SigV4 signer + POST for Amazon Product Advertising API v5.
// Server-only: never import this from client components.
import { createHash, createHmac } from "node:crypto";

export type PaapiOperation = "SearchItems" | "GetItems" | "GetVariations" | "BrowseNodes";

const SERVICE = "ProductAdvertisingAPI";
const ALGO = "AWS4-HMAC-SHA256";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function amzDate(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso, date: iso.slice(0, 8) };
}

function targetHeader(op: PaapiOperation) {
  return `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${op}`;
}

function pathFor(op: PaapiOperation) {
  switch (op) {
    case "SearchItems":
      return "/paapi5/searchitems";
    case "GetItems":
      return "/paapi5/getitems";
    case "GetVariations":
      return "/paapi5/getvariations";
    case "BrowseNodes":
      return "/paapi5/getbrowsenodes";
  }
}

export async function paapiRequest<T>(
  op: PaapiOperation,
  payload: Record<string, unknown>,
): Promise<T> {
  const accessKey = env("AMAZON_ACCESS_KEY");
  const secretKey = env("AMAZON_SECRET_KEY");
  const region = process.env.AMAZON_REGION ?? "eu-west-1";
  const host = process.env.AMAZON_HOST ?? "webservices.amazon.in";
  const partnerTag = env("AMAZON_PARTNER_TAG");

  const body = JSON.stringify({
    ...payload,
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: `www.${host.replace(/^webservices\./, "")}`,
  });

  const { amz, date } = amzDate();
  const path = pathFor(op);
  const target = targetHeader(op);
  const contentType = "application/json; charset=utf-8";

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-date:${amz}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = ["POST", path, "", canonicalHeaders, signedHeaders, sha256Hex(body)].join("\n");
  const credentialScope = `${date}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGO, amz, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization = `${ALGO} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": contentType,
      "x-amz-date": amz,
      "x-amz-target": target,
      Authorization: authorization,
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`PA API ${op} ${res.status}: ${text.slice(0, 500)}`) as Error & {
      status?: number;
      retryable?: boolean;
    };
    err.status = res.status;
    err.retryable = res.status === 429 || res.status === 503;
    throw err;
  }
  return JSON.parse(text) as T;
}

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
