"use client";
import type { CorrectScores, InvalidScore } from "@/lib/import/prepare-scores";
import { useEffect, useRef, useState } from "react";

export function useImportScores() {
  const [issues, setIssues] = useState<InvalidScore[]>([]);
  const pending = useRef<
    ((value: Record<string, number> | null) => void) | null
  >(null);
  function finish(value: Record<string, number> | null) {
    pending.current?.(value);
    pending.current = null;
    setIssues([]);
  }
  useEffect(
    () => () => {
      pending.current?.(null);
    },
    [],
  );
  const request: CorrectScores = (next) =>
    new Promise((resolve) => {
      pending.current = resolve;
      setIssues(next);
    });
  return { issues, request, finish };
}
