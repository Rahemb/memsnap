import type { Tables } from "@/integrations/supabase/types";

export type Screenshot = Tables<"screenshots">;
export type Collection = Tables<"collections">;
export type Profile = Tables<"profiles">;
export type Preferences = Tables<"user_preferences">;

export type ScreenshotStatus = "uploading" | "analyzing" | "organizing" | "ready" | "failed";

export const STATUS_LABEL: Record<ScreenshotStatus, string> = {
  uploading: "Uploading",
  analyzing: "Analyzing",
  organizing: "Organizing",
  ready: "Ready",
  failed: "Failed",
};

export function isProcessing(status: string) {
  return status === "uploading" || status === "analyzing" || status === "organizing";
}

export function displayTitle(s: Screenshot) {
  return s.title?.trim() || s.original_filename?.replace(/\.[a-z0-9]+$/i, "") || "Untitled screenshot";
}

export function placeLine(s: Screenshot) {
  return [s.location_name, s.city, s.country].filter(Boolean).join(", ") || null;
}
