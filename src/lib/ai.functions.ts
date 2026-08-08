import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Screenshot understanding endpoints. All heavy lifting lives in ai.server.ts
 * so this module stays a thin wrapper (required for server-fn splitting).
 */

export const analyzeScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ screenshotId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const {
      analyseImage,
      analysisToRow,
      embeddingContent,
      embedText,
      AiConfigError,
    } = await import("@/lib/ai.server");

    const { data: shot, error } = await supabase
      .from("screenshots")
      .select("id, storage_path")
      .eq("id", data.screenshotId)
      .single();
    if (error || !shot) throw new Error("Screenshot not found.");

    await supabase.from("processing_jobs").insert({
      screenshot_id: shot.id,
      user_id: userId,
      job_type: "vision_analysis",
      status: "running",
    });
    await supabase.from("screenshots").update({ status: "analyzing" }).eq("id", shot.id);

    const fail = async (message: string) => {
      await supabase
        .from("screenshots")
        .update({ status: "failed", error_message: message })
        .eq("id", shot.id);
      await supabase
        .from("processing_jobs")
        .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
        .eq("screenshot_id", shot.id)
        .eq("status", "running");
    };

    try {
      const signed = await supabase.storage
        .from("screenshots")
        .createSignedUrl(shot.storage_path, 600);
      if (signed.error || !signed.data?.signedUrl) throw new Error("Could not read the image file.");

      const analysis = await analyseImage(signed.data.signedUrl);
      const row = analysisToRow(analysis);

      await supabase.from("screenshots").update({ ...row, status: "organizing" }).eq("id", shot.id);

      // Semantic index (best effort — the screenshot is already useful without it).
      let embedded = false;
      try {
        const content = embeddingContent(row);
        if (content) {
          const embedding = await embedText(content);
          await supabase.from("screenshot_embeddings").upsert({
            screenshot_id: shot.id,
            user_id: userId,
            content,
            embedding: JSON.stringify(embedding),
          });
          embedded = true;
        }
      } catch (embedError) {
        console.error("embedding failed", embedError);
      }

      await supabase.from("screenshots").update({ status: "ready" }).eq("id", shot.id);
      await supabase
        .from("processing_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("screenshot_id", shot.id)
        .eq("status", "running");

      return { ok: true as const, embedded };
    } catch (err) {
      const message =
        err instanceof AiConfigError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Analysis failed.";
      await fail(message);
      return { ok: false as const, message };
    }
  });

export const semanticSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1).max(300), limit: z.number().min(1).max(50).optional() }).parse(
      input,
    ),
  )
  .handler(async ({ data, context }) => {
    const { embedText, SIMILARITY_FLOOR, RELATIVE_DROP } = await import("@/lib/ai.server");
    try {
      const embedding = await embedText(data.query);
      const { data: matches, error } = await context.supabase.rpc("match_screenshots", {
        query_embedding: JSON.stringify(embedding),
        match_count: data.limit ?? 24,
      });
      if (error) throw error;
      const scored = (matches ?? [])
        .map((m) => ({ id: m.screenshot_id as string, similarity: Number(m.similarity) }))
        .filter((m) => Number.isFinite(m.similarity) && m.similarity >= SIMILARITY_FLOOR);
      const best = scored[0]?.similarity ?? 0;
      return {
        ok: true as const,
        matches: scored.filter((m) => m.similarity >= best - RELATIVE_DROP),
      };


    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Meaning-based search is unavailable.",
        matches: [] as { id: string; similarity: number }[],
      };
    }
  });

export const askScreenshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().min(2).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { embedText, answerQuestion, embeddingContent, SIMILARITY_FLOOR } = await import(
      "@/lib/ai.server"
    );

    try {
      let ids: string[] = [];
      try {
        const embedding = await embedText(data.question);
        const { data: matches } = await supabase.rpc("match_screenshots", {
          query_embedding: JSON.stringify(embedding),
          match_count: 12,
        });
        ids = (matches ?? [])
          .filter((m) => Number(m.similarity) >= SIMILARITY_FLOOR)
          .map((m) => m.screenshot_id as string);

      } catch {
        ids = [];
      }

      const base = supabase
        .from("screenshots")
        .select(
          "id, title, summary, category, subcategory, tags, city, country, location_name, brand, product_name, restaurant_name, price, currency, source_platform, detected_text, created_at",
        )
        .eq("user_id", userId)
        .eq("status", "ready");

      const { data: rows } = ids.length
        ? await base.in("id", ids)
        : await base.order("created_at", { ascending: false }).limit(24);

      if (!rows?.length) {
        return {
          ok: true as const,
          answer: "You have not saved anything that matches that yet.",
          screenshotIds: [] as string[],
        };
      }

      const contextText = rows
        .map((r, i) => `[${i + 1}] ${r.title ?? "Untitled"}\n${embeddingContent(r)}`)
        .join("\n\n");

      const answer = await answerQuestion(data.question, contextText);

      await supabase
        .from("search_history")
        .insert({ user_id: userId, query: data.question, mode: "ask", result_count: rows.length });

      return { ok: true as const, answer, screenshotIds: rows.map((r) => r.id) };
    } catch (err) {
      return {
        ok: false as const,
        answer: "",
        message: err instanceof Error ? err.message : "Ask is unavailable right now.",
        screenshotIds: [] as string[],
      };
    }
  });
