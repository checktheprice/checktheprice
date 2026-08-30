import { buildReelPrompt } from "./prompt";
import type { ReelProduct } from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_VEO_MODEL = "veo-3.1-fast-generate-preview";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return key;
}

export function veoModel(): string {
  return process.env.GEMINI_VEO_MODEL || DEFAULT_VEO_MODEL;
}

async function googleFetch(pathOrUrl: string, init: RequestInit = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  const headers = new Headers(init.headers);
  headers.set("x-goog-api-key", apiKey());
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res;
}

async function imageToInlineData(imageUrl: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not load product image (${res.status}).`);
  const contentType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("Product image URL did not return an image.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return { mimeType: contentType, data: btoa(binary) };
}

export async function startReelGeneration(product: ReelProduct) {
  const { concept, prompt } = buildReelPrompt(product);
  const inlineData = await imageToInlineData(product.image);
  const res = await googleFetch(`/models/${encodeURIComponent(veoModel())}:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          image: { inlineData },
        },
      ],
      parameters: {
        aspectRatio: "9:16",
        sampleCount: 1,
      },
    }),
  });
  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Gemini API did not return an operation name.");
  return { operationName: data.name, concept, model: veoModel() };
}

export async function getReelOperation(operationName: string) {
  if (!operationName.startsWith("operations/")) throw new Error("Invalid operation name.");
  const res = await googleFetch(`/${operationName}`);
  return (await res.json()) as Record<string, unknown>;
}

export function getVideoUri(operation: Record<string, unknown>): string | null {
  const response = operation.response as { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } } | undefined;
  return response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null;
}

export async function downloadGeneratedVideo(operationName: string) {
  const operation = await getReelOperation(operationName);
  if (!operation.done) throw new Error("Video generation is not complete yet.");
  const uri = getVideoUri(operation);
  if (!uri) throw new Error("Completed operation did not include a video URI.");
  const res = await googleFetch(uri);
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") || "video/mp4",
      "Content-Disposition": 'attachment; filename="checktheprice-ai-reel.mp4"',
      "Cache-Control": "no-store",
    },
  });
}
