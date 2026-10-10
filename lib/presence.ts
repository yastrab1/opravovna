export const PRESENCE_INTERVAL = 15_000;
export const PRESENCE_TTL = 50_000;
export type ProjectViewer = {
  userId: string;
  name: string;
  image: string;
  updated: number;
  documentId: string | null;
};
export function viewerInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "");
}
