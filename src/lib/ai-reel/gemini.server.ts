import { createClient } from "@supabase/supabase-js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "veo-3.1-generate-preview";

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function requireAdmin(request: Request): Promise<
  { userId: string } | Response
> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return jsonError("Admin authentication is required.", 401);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return jsonError("Supabase server configuration is missing.", 500);

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return jsonError("Invalid admin session.", 401);

  const { data: isAdmin, error: roleError } = await client.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) return jsonError("Admin access is required.", 403);

  return { userId: userData.user.id };
}

async function imageAsInlineData(imageUrl: string) {
  const response = await fetch(imageUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not fetch product image (${response.status}).`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("Product image URL did not return an image.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("Product image is too large for video generation.");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { mimeType: contentType, data: Buffer.from(binary, "binary").toString("base64") };
}

function geminiHeaders() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured in the server environment.");
  return { "x-goog-api-key": key, "Content-Type": "application/json" };
}

export async function startVideoGeneration(prompt: string, imageUrl: string) {
  const image = await imageAsInlineData(imageUrl);
  const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:predictLongRunning`, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({
      instances: [{ prompt, image: { inlineData: image } }],
      parameters: {
        aspectRatio: "9:16",
        resolution: "720p",
        durationSeconds: "8",
        numberOfVideos: 1,
        personGeneration: "allow_adult",
      },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.name) {
    const message = body?.error?.message || `Gemini video generation failed (${response.status}).`;
    throw new Error(message);
  }
  return String(body.name);
}

export async function getVideoOperation(operationName: string) {
  const safeName = operationName.replace(/^\/+/, "");
  const response = await fetch(`${GEMINI_BASE_URL}/${safeName}`, {
    headers: geminiHeaders(),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || `Gemini operation check failed (${response.status}).`);
  }
  return body as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{ video?: { uri?: string } }>;
      };
    };
  };
}

export async function downloadGeneratedVideo(operationName: string): Promise<Response> {
  const operation = await getVideoOperation(operationName);
  if (!operation.done) return new Response(JSON.stringify({ error: "Video is still generating." }), { status: 409 });
  if (operation.error) return jsonError(operation.error.message || "Video generation failed.", 502);
  const uri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) return jsonError("Gemini completed without a downloadable video.", 502);

  const videoResponse = await fetch(uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! } });
  if (!videoResponse.ok) return jsonError(`Video download failed (${videoResponse.status}).`, 502);
  return new Response(videoResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="checktheprice-reel.mp4"',
      "Cache-Control": "no-store",
    },
  });
}
