import { useEffect, useRef, useState } from "react";
export type ExportDownloads = {
  project: string;
  filename: string;
  expires: boolean;
  parts: { part: number; count: number; bytes: number; url: string }[];
};
export function useExportDownloads() {
  const [downloads, setDownloads] = useState<ExportDownloads | null>(null);
  const urls = useRef<string[]>([]);
  function publishDownloads(value: ExportDownloads | null) {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current =
      value?.parts.filter((p) => p.url.startsWith("blob:")).map((p) => p.url) ??
      [];
    setDownloads(value);
  }
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  return { downloads, publishDownloads };
}
