import { z } from "zod";

/**
 * Server-only helpers for the screenshot understanding pipeline.
 *
 * Pipeline: upload -> row created -> job -> vision + OCR analysis ->
 * validated JSON -> database updated -> embedding stored -> searchable.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const VISION_MODEL = "google/gemini-3.6-flash";
const CHAT_MODEL = "google/gemini-3.6-flash";
const EMBEDDING_MODEL = "google/gemini-embedding-2";

export class AiConfigError extends Error {}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    throw new AiConfigError(
      "Screenshot understanding is not configured yet: the AI key is missing.",
    );
  }
  return key;
}

async function gatewayFetch(path: string, body: unknown) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": apiKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Too many requests right now — try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`Analysis service error (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

const nullableString = z.union([z.string(), z.null()]).optional();
const nullableNumber = z.union([z.number(), z.null()]).optional();

export const AnalysisSchema = z.object({
  title: nullableString,
  summary: nullableString,
  category: nullableString,
  subcategory: nullableString,
  tags: z.array(z.string()).optional(),
  detected_text: nullableString,
  source_platform: nullableString,
  content_type: nullableString,
  location: z
    .object({ name: nullableString, city: nullableString, country: nullableString })
    .partial()
    .optional(),
  entities: z.array(z.string()).optional(),
  product: z
    .object({
      name: nullableString,
      brand: nullableString,
      price: nullableNumber,
      currency: nullableString,
    })
    .partial()
    .optional(),
  restaurant: z.object({ name: nullableString, cuisine: nullableString }).partial().optional(),
  event: z.object({ name: nullableString, date: nullableString }).partial().optional(),
  urls: z.array(z.string()).optional(),
  suggested_actions: z.array(z.string()).optional(),
  confidence: nullableNumber,
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const SYSTEM_PROMPT = `You analyse a single screenshot that a person saved because they want to remember it.
Look at both the visuals and every piece of text in the image.
Return ONLY a JSON object, no prose, no markdown fences, using exactly this shape:
{"title":"","summary":"","category":"","subcategory":"","tags":[],"detected_text":"","source_platform":"","content_type":"","location":{"name":"","city":"","country":""},"entities":[],"product":{"name":"","brand":"","price":null,"currency":""},"restaurant":{"name":"","cuisine":""},"event":{"name":"","date":null},"urls":[],"suggested_actions":[],"confidence":0}
Rules:
- title: short, specific, human (e.g. "Circolo Popolare, London"). Never mention screenshots or AI.
- summary: one calm sentence about what this is and why someone saved it.
- category: prefer one of travel, restaurants, shopping, recipes, events, entertainment, fitness, fashion, cars, home, ideas, important, other. Invent a better one only when none fit.
- tags: 3-6 short lowercase tags.
- detected_text: all readable text in the image, condensed.
- source_platform: only when the interface is recognisable (tiktok, instagram, safari, chrome, google maps, booking, youtube, whatsapp, pinterest, airbnb, messages). Use "unknown" if unsure.
- event.date: ISO date (YYYY-MM-DD) or null.
- price: a number only, no currency symbols.
- suggested_actions: from open_maps, visit_website, add_to_trip, visit_product, add_to_wishlist, add_to_calendar, view_ingredients, add_to_watchlist, mark_watched.
- confidence: 0-1, how sure you are overall.
Use null or "" for anything not present. Never invent facts.`;

function stripFences(text: string) {
  return text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Runs vision + OCR analysis on a publicly fetchable image URL. */
export async function analyseImage(imageUrl: string): Promise<Analysis> {
  const json = await gatewayFetch("/chat/completions", {
    model: VISION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse this saved screenshot." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
    ?.content;
  if (!content) throw new Error("The analyser returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch {
    const match = stripFences(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The analyser returned an unreadable response.");
    parsed = JSON.parse(match[0]);
  }

  const result = AnalysisSchema.safeParse(parsed);
  if (!result.success) throw new Error("The analysis did not match the expected format.");
  return result.data;
}

const clean = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
};

/** Maps validated analysis JSON onto the screenshots table columns. */
export function analysisToRow(analysis: Analysis) {
  const price = analysis.product?.price;
  const eventDate = clean(analysis.event?.date ?? null);
  const parsedDate = eventDate ? new Date(eventDate) : null;

  return {
    title: clean(analysis.title),
    summary: clean(analysis.summary),
    category: clean(analysis.category)?.toLowerCase() ?? null,
    subcategory: clean(analysis.subcategory),
    tags: (analysis.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
    detected_text: clean(analysis.detected_text),
    source_platform: clean(analysis.source_platform)?.toLowerCase() ?? null,
    content_type: clean(analysis.content_type),
    location_name: clean(analysis.location?.name ?? null),
    city: clean(analysis.location?.city ?? null),
    country: clean(analysis.location?.country ?? null),
    website: (analysis.urls ?? []).find((u) => /^https?:\/\//i.test(u)) ?? null,
    price: typeof price === "number" && Number.isFinite(price) ? price : null,
    currency: clean(analysis.product?.currency ?? null)?.toUpperCase() ?? null,
    event_date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
    brand: clean(analysis.product?.brand ?? null),
    product_name: clean(analysis.product?.name ?? null),
    restaurant_name: clean(analysis.restaurant?.name ?? null),
    confidence_score:
      typeof analysis.confidence === "number" ? Math.min(1, Math.max(0, analysis.confidence)) : null,
    suggested_actions: (analysis.suggested_actions ?? []).slice(0, 6),
    metadata: {
      entities: analysis.entities ?? [],
      urls: analysis.urls ?? [],
      cuisine: analysis.restaurant?.cuisine ?? null,
      event_name: analysis.event?.name ?? null,
      analysed_at: new Date().toISOString(),
      model: VISION_MODEL,
    },
  };
}

/** Text used to build the semantic-search embedding for a screenshot. */
export function embeddingContent(row: Record<string, unknown>) {
  const parts = [
    row["title"],
    row["summary"],
    row["category"],
    row["subcategory"],
    Array.isArray(row["tags"]) ? (row["tags"] as string[]).join(" ") : null,
    row["restaurant_name"],
    row["product_name"],
    row["brand"],
    row["location_name"],
    row["city"],
    row["country"],
    row["source_platform"],
    typeof row["detected_text"] === "string" ? row["detected_text"].slice(0, 1500) : null,
  ];
  return parts.filter(Boolean).join("\n").slice(0, 4000);
}

export async function embedText(text: string): Promise<number[]> {
  const json = await gatewayFetch("/embeddings", { model: EMBEDDING_MODEL, input: text });
  const vector = (json as { data?: { embedding?: number[] }[] }).data?.[0]?.embedding;
  if (!vector?.length) throw new Error("Could not build a search vector.");
  return vector;
}

export async function answerQuestion(question: string, context: string): Promise<string> {
  const json = await gatewayFetch("/chat/completions", {
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `You answer questions about the screenshots a person saved. Use ONLY the provided context.
Be brief (1-3 sentences), warm and factual. Refer to items by their title.
If the context has nothing relevant, say you could not find anything saved about it. Never invent details.`,
      },
      { role: "user", content: `Question: ${question}\n\nSaved screenshots:\n${context}` },
    ],
  });
  const content = (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
    ?.content;
  return content?.trim() ?? "I could not read an answer from the analyser.";
}
