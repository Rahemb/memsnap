CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  original_filename TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  image_hash TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  error_message TEXT,
  title TEXT,
  summary TEXT,
  category TEXT,
  subcategory TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  detected_text TEXT,
  source_platform TEXT,
  location_name TEXT,
  city TEXT,
  country TEXT,
  website TEXT,
  price NUMERIC,
  currency TEXT,
  event_date TIMESTAMPTZ,
  brand TEXT,
  product_name TEXT,
  restaurant_name TEXT,
  content_type TEXT,
  confidence_score NUMERIC,
  suggested_actions TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  last_viewed_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenshots TO authenticated;
GRANT ALL ON public.screenshots TO service_role;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots_own" ON public.screenshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX screenshots_user_created_idx ON public.screenshots (user_id, created_at DESC);
CREATE INDEX screenshots_user_category_idx ON public.screenshots (user_id, category);
CREATE INDEX screenshots_tags_idx ON public.screenshots USING gin (tags);
CREATE INDEX screenshots_hash_idx ON public.screenshots (user_id, image_hash);
CREATE INDEX screenshots_search_idx ON public.screenshots USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.screenshots_search_vector() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,'') || ' ' || coalesce(NEW.detected_text,'') || ' ' ||
    coalesce(NEW.category,'') || ' ' || coalesce(NEW.subcategory,'') || ' ' || coalesce(NEW.location_name,'') || ' ' ||
    coalesce(NEW.city,'') || ' ' || coalesce(NEW.country,'') || ' ' || coalesce(NEW.brand,'') || ' ' ||
    coalesce(NEW.product_name,'') || ' ' || coalesce(NEW.restaurant_name,'') || ' ' || coalesce(NEW.source_platform,'') || ' ' ||
    array_to_string(NEW.tags,' '));
  RETURN NEW;
END; $$;
CREATE TRIGGER screenshots_search_vector_trg BEFORE INSERT OR UPDATE ON public.screenshots
FOR EACH ROW EXECUTE FUNCTION public.screenshots_search_vector();

CREATE TABLE public.screenshot_embeddings (
  screenshot_id UUID PRIMARY KEY REFERENCES public.screenshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'google/gemini-embedding-2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenshot_embeddings TO authenticated;
GRANT ALL ON public.screenshot_embeddings TO service_role;
ALTER TABLE public.screenshot_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "embeddings_own" ON public.screenshot_embeddings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX screenshot_embeddings_idx ON public.screenshot_embeddings USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_screenshot_id UUID REFERENCES public.screenshots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_own" ON public.collections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX collections_user_idx ON public.collections (user_id, created_at DESC);

CREATE TABLE public.collection_items (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  screenshot_id UUID NOT NULL REFERENCES public.screenshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, screenshot_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT ALL ON public.collection_items TO service_role;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_items_own" ON public.collection_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX collection_items_screenshot_idx ON public.collection_items (screenshot_id);

CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  auto_analyze BOOLEAN NOT NULL DEFAULT true,
  rediscover_enabled BOOLEAN NOT NULL DEFAULT true,
  store_detected_text BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_own" ON public.user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'keyword',
  result_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_history_own" ON public.search_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX search_history_user_idx ON public.search_history (user_id, created_at DESC);

CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES public.screenshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'vision_analysis',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_jobs TO authenticated;
GRANT ALL ON public.processing_jobs TO service_role;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_own" ON public.processing_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX processing_jobs_screenshot_idx ON public.processing_jobs (screenshot_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER screenshots_touch BEFORE UPDATE ON public.screenshots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER collections_touch BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.match_screenshots(query_embedding vector(3072), match_count int DEFAULT 20)
RETURNS TABLE (screenshot_id uuid, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.screenshot_id, 1 - (e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.screenshot_embeddings e
  WHERE e.user_id = auth.uid()
  ORDER BY e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_screenshots(vector, int) TO authenticated;

CREATE POLICY "screenshot_files_own" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);