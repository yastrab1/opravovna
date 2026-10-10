"use client";
import { useProjectPresence } from "@/hooks/use-project-presence";
import { viewerInitials, type ProjectViewer } from "@/lib/presence";
import { useState } from "react";

function Avatar({ viewer }: { viewer: ProjectViewer }) {
  const [failedImage, setFailedImage] = useState("");
  return (
    <span
      className="presence-person"
      tabIndex={0}
      role="img"
      aria-label={viewer.name}
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
      </span>
    </span>
  );
}
export function ViewerAvatars({ viewers }: { viewers: ProjectViewer[] }) {
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
        <Avatar key={viewer.userId} viewer={viewer} />
      ))}
      {rest.length > 0 && (
        <span
          className="presence-person presence-overflow"
          tabIndex={0}
          role="img"
          aria-label={rest.map((viewer) => viewer.name).join(", ")}
        >
          +{rest.length}
          <span className="presence-tooltip" aria-hidden="true">
            {rest.map((viewer) => viewer.name).join(", ")}
          </span>
        </span>
      )}
    </div>
  );
}
export default function ProjectViewers({ projectId }: { projectId?: string }) {
  const viewers = useProjectPresence(projectId);
  return <ViewerAvatars viewers={viewers} />;
}
