import { useEffect, useState } from "react";

import { getSignedUrl } from "@/lib/storage";

/** Resolves a private storage path into a temporary signed URL. */
export function useSignedUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    void getSignedUrl(path).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
