import { useCallback, useEffect, useRef, useState } from "react";
import { collectAssetPaths } from "../lib/util";

/**
 * Maps image paths in the content (assets/uploads/…) to blob URLs so the editor and the
 * live preview can show them straight away, even from a private repository.
 */
export function useAssetMap(getBlob: ((path: string) => Promise<Blob | null>) | null, content: any, version: number) {
  const [map, setMap] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (!getBlob || !content) return;
    for (const p of collectAssetPaths(content)) {
      if (asked.current.has(p)) continue;
      asked.current.add(p);
      getBlob(p)
        .then((b) => { if (b) setMap((m) => ({ ...m, [p]: URL.createObjectURL(b) })); })
        .catch(() => {});
    }
  }, [getBlob, content, version]);

  const add = useCallback((path: string, file: Blob) => {
    asked.current.add(path);
    setMap((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
  }, []);

  return { map, add };
}
