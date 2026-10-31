"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";

type State<T> = { data: T | null; error: ApiError | null; loading: boolean };

/** Load a GET endpoint on mount. Pass null to skip loading until something else is ready. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, "Something went wrong.");
        setState({ data: null, error: apiError, loading: false });
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
