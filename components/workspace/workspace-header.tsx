"use client";
import ProjectViewers from "./project-viewers";
import ToolSettings from "@/app/tool-settings";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { PencilMark } from "./icons";
export default function WorkspaceHeader({
  projectId,
  documentId,
  onOpenDocument,
  busy,
  onError,
  isSignedIn,
  preferences,
  persistPreferences,
}: {
  projectId?: string;
  documentId?: string | null;
  onOpenDocument: (id: string) => Promise<void>;
  busy: boolean;
  onError: (error: unknown) => void;
  isSignedIn: boolean | undefined;
  preferences: any;
  persistPreferences: any;
}) {
  return (
    <header className="appheader">
      <Link href="/" className="brand">
        <span className="brandmark">
          <PencilMark />
        </span>
        Opravovňa<span className="beta">PDF</span>
      </Link>
      <div className="headerend">
        <span className="muted desktop">Priestor na dobrú spätnú väzbu</span>
        {isSignedIn ? (
          <>
            <ProjectViewers
              key={projectId}
              projectId={projectId}
              documentId={documentId}
              onOpenDocument={onOpenDocument}
              busy={busy}
              onError={onError}
            />
            <ToolSettings
              tools={preferences.tools}
              onSave={(tools) => persistPreferences({ tools })}
            />
            <UserButton />
          </>
        ) : (
          <>
            <SignInButton mode="modal">
              <button>Prihlásiť sa</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="primary">Vytvoriť účet</button>
            </SignUpButton>
          </>
        )}
      </div>
    </header>
  );
}
