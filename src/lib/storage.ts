import { supabase } from "@/integrations/supabase/client";

const BUCKET = "screenshots";
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 3600;

/** Signed URLs for the private screenshots bucket, cached in memory. */
export async function getSignedUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;

  const pending = inflight.get(path);
  if (pending) return pending;

  const promise = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
    inflight.delete(path);
    if (error || !data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 120) * 1000 });
    return data.signedUrl;
  })();

  inflight.set(path, promise);
  return promise;
}

export function forgetSignedUrl(path?: string | null) {
  if (path) cache.delete(path);
}
