import { supabase } from "@/integrations/supabase/client";
import type { Collection, Screenshot } from "@/lib/types";

const LIST_COLUMNS =
  "id, user_id, storage_path, thumbnail_path, original_filename, width, height, status, error_message, title, summary, category, subcategory, tags, source_platform, location_name, city, country, website, price, currency, event_date, brand, product_name, restaurant_name, content_type, confidence_score, suggested_actions, metadata, is_archived, is_edited, last_viewed_at, captured_at, created_at, updated_at, file_size, image_hash, detected_text";

export const PAGE_SIZE = 24;

export async function fetchScreenshots(options: {
  page?: number;
  category?: string | null;
  archived?: boolean;
  ids?: string[];
}): Promise<Screenshot[]> {
  const page = options.page ?? 0;
  let query = supabase
    .from("screenshots")
    .select(LIST_COLUMNS)
    .eq("is_archived", options.archived ?? false)
    .order("created_at", { ascending: false });

  if (options.category) query = query.eq("category", options.category);
  if (options.ids) {
    if (!options.ids.length) return [];
    query = query.in("id", options.ids);
  } else {
    query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Screenshot[];
}

export async function fetchScreenshot(id: string): Promise<Screenshot> {
  const { data, error } = await supabase
    .from("screenshots")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Screenshot;
}

export async function fetchProcessing(): Promise<Screenshot[]> {
  const { data, error } = await supabase
    .from("screenshots")
    .select(LIST_COLUMNS)
    .in("status", ["uploading", "analyzing", "organizing", "failed"])
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []) as Screenshot[];
}

export async function fetchRediscover(): Promise<Screenshot[]> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("screenshots")
    .select(LIST_COLUMNS)
    .eq("is_archived", false)
    .eq("status", "ready")
    .lt("created_at", cutoff)
    .order("last_viewed_at", { ascending: true, nullsFirst: true })
    .limit(6);
  if (error) throw error;
  return (data ?? []) as Screenshot[];
}

export type CollectionWithCount = Collection & { count: number; cover?: string | null };

export async function fetchCollections(): Promise<CollectionWithCount[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(screenshot_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as (Collection & { collection_items: { screenshot_id: string }[] })[];
  const coverIds = rows
    .map((r) => r.cover_screenshot_id ?? r.collection_items[0]?.screenshot_id ?? null)
    .filter(Boolean) as string[];

  const covers = new Map<string, string | null>();
  if (coverIds.length) {
    const { data: shots } = await supabase
      .from("screenshots")
      .select("id, thumbnail_path, storage_path")
      .in("id", coverIds);
    for (const shot of shots ?? [])
      covers.set(shot.id, shot.thumbnail_path ?? shot.storage_path);
  }

  return rows.map((r) => {
    const coverId = r.cover_screenshot_id ?? r.collection_items[0]?.screenshot_id ?? null;
    return {
      ...r,
      count: r.collection_items.length,
      cover: coverId ? (covers.get(coverId) ?? null) : null,
    };
  });
}

export async function fetchCollectionScreenshots(collectionId: string): Promise<Screenshot[]> {
  const { data, error } = await supabase
    .from("collection_items")
    .select("screenshot_id, added_at")
    .eq("collection_id", collectionId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.screenshot_id);
  if (!ids.length) return [];
  const shots = await fetchScreenshots({ ids });
  const order = new Map(ids.map((id, i) => [id, i]));
  return shots.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function keywordSearch(term: string): Promise<Screenshot[]> {
  const cleaned = term.trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  const tsQuery = tokens.map((t) => `${t.replace(/[^\p{L}\p{N}]/gu, "")}:*`).filter(Boolean).join(" | ");

  const [full, loose] = await Promise.all([
    tsQuery
      ? supabase
          .from("screenshots")
          .select(LIST_COLUMNS)
          .textSearch("search_vector", tsQuery)
          .eq("is_archived", false)
          .limit(40)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("screenshots")
      .select(LIST_COLUMNS)
      .or(
        [
          `title.ilike.%${cleaned}%`,
          `summary.ilike.%${cleaned}%`,
          `detected_text.ilike.%${cleaned}%`,
          `city.ilike.%${cleaned}%`,
          `brand.ilike.%${cleaned}%`,
          `product_name.ilike.%${cleaned}%`,
          `restaurant_name.ilike.%${cleaned}%`,
          `category.ilike.%${cleaned}%`,
        ].join(","),
      )
      .eq("is_archived", false)
      .limit(40),
  ]);

  const merged = new Map<string, Screenshot>();
  for (const row of [...((full.data ?? []) as Screenshot[]), ...((loose.data ?? []) as Screenshot[])])
    merged.set(row.id, row);
  return [...merged.values()];
}

export async function fetchCategoryCounts() {
  const { data, error } = await supabase
    .from("screenshots")
    .select("category")
    .eq("is_archived", false)
    .eq("status", "ready");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.category ?? "other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export type Suggestion = { kind: "city" | "category"; value: string; count: number };

/** Groups the library to propose collections the person may want. Never auto-creates. */
export async function fetchCollectionSuggestions(): Promise<Suggestion[]> {
  const [{ data: shots }, { data: existing }] = await Promise.all([
    supabase
      .from("screenshots")
      .select("city, category")
      .eq("is_archived", false)
      .eq("status", "ready"),
    supabase.from("collections").select("name"),
  ]);

  const taken = new Set((existing ?? []).map((c) => c.name.toLowerCase()));
  const cities = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const row of shots ?? []) {
    if (row.city) cities.set(row.city, (cities.get(row.city) ?? 0) + 1);
    if (row.category) categories.set(row.category, (categories.get(row.category) ?? 0) + 1);
  }

  const out: Suggestion[] = [];
  for (const [value, count] of cities)
    if (count >= 3 && !taken.has(value.toLowerCase())) out.push({ kind: "city", value, count });
  for (const [value, count] of categories)
    if (count >= 5 && !taken.has(value.toLowerCase()))
      out.push({ kind: "category", value, count });

  return out.sort((a, b) => b.count - a.count).slice(0, 3);
}

export async function fetchStats() {
  const [shots, collections] = await Promise.all([
    supabase.from("screenshots").select("file_size, is_archived", { count: "exact" }),
    supabase.from("collections").select("id", { count: "exact", head: true }),
  ]);
  const bytes = (shots.data ?? []).reduce((total, row) => total + Number(row.file_size ?? 0), 0);
  return {
    screenshots: shots.count ?? 0,
    collections: collections.count ?? 0,
    bytes,
  };
}
