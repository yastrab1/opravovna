"use client";
import { useProjectPresence } from "@/hooks/use-project-presence";
import { viewerInitials, type ProjectViewer } from "@/lib/presence";
import { api } from "@/lib/client-api";
import { useEffect, useRef, useState } from "react";

function Avatar({
  viewer,
  onFollow,
  busy,
}: {
  viewer: ProjectViewer;
  onFollow: (viewer: ProjectViewer) => void;
  busy: boolean;
}) {
  const [failedImage, setFailedImage] = useState("");
  return (
    <button
      type="button"
      className="presence-person"
      disabled={busy}
      onClick={() => onFollow(viewer)}
      aria-label={`${viewer.name}, ${viewer.documentId ? "prejsť na otvorené riešenie" : "projekt otvorený, riešenie zatiaľ nezdieľa"}`}
    >
      {viewer.image && failedImage !== viewer.image ? (
        // Clerk profile pictures are already hosted and resized by Clerk.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={viewer.image}
          alt=""
          width={28}
          height={28}
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(viewer.image)}
        />
      ) : (
        <span className="presence-initials">{viewerInitials(viewer.name)}</span>
      )}
      <span className="presence-tooltip" aria-hidden="true">
        {viewer.name}
        <span className="presence-tooltip-note">
          {viewer.documentId
            ? "Kliknutím prejsť na riešenie"
            : "Projekt otvorený, riešenie zatiaľ nezdieľa"}
        </span>
      </span>
    </button>
  );
}
export function ViewerAvatars({
  viewers,
  onFollow,
  busy = false,
}: {
  viewers: ProjectViewer[];
  onFollow: (viewer: ProjectViewer) => void;
  busy?: boolean;
}) {
  if (!viewers.length) return null;
  const visible = viewers.slice(0, 3),
    rest = viewers.slice(3);
  return (
    <div
      className="project-presence"
      role="group"
      aria-label="Práve v projekte"
    >
      {visible.map((viewer) => (
        <Avatar
          key={viewer.userId}
          viewer={viewer}
          onFollow={onFollow}
          busy={busy}
        />
      ))}
      {rest.length > 0 && (
        <details
          className="presence-more"
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className="presence-person presence-overflow"
            aria-label={`Ďalší používatelia (${rest.length})`}
          >
            +{rest.length}
          </summary>
          <div className="presence-menu">
            {rest.map((viewer) => (
              <button
                type="button"
                key={viewer.userId}
                disabled={busy}
                onClick={(event) => {
                  event.currentTarget.closest("details")!.open = false;
                  onFollow(viewer);
                }}
              >
                {viewer.name}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
export default function ProjectViewers({
  projectId,
  documentId,
  onOpenDocument,
  busy,
  onError,
}: {
  projectId?: string;
  documentId?: string | null;
  onOpenDocument: (id: string) => Promise<unknown>;
  busy: boolean;
  onError: (error: unknown) => void;
}) {
  const viewers = useProjectPresence(projectId, documentId);
  const [following, setFollowing] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [projectId],
  );
  async function follow(viewer: ProjectViewer) {
    if (!projectId || following || busy) return;
    const abort = new AbortController();
    request.current = abort;
    setFollowing(true);
    try {
      const current: ProjectViewer[] = await api(
        `projects/${projectId}/presence`,
        { signal: abort.signal },
      );
      if (abort.signal.aborted) return;
      const person = current.find((person) => person.userId === viewer.userId);
      if (!person)
        throw new Error("Používateľ už nemá tento projekt otvorený.");
      if (!person.documentId)
        throw new Error(
          `${person.name} má projekt otvorený, ale jeho karta neposiela aktuálne riešenie. Nech obnoví stránku.`,
        );
      await onOpenDocument(person.documentId);
    } catch (error) {
      if (!abort.signal.aborted) onError(error);
    } finally {
      setFollowing(false);
    }
  }
  return (
    <ViewerAvatars
      viewers={viewers}
      onFollow={follow}
      busy={busy || following}
    />
  );
}
