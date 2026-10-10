"use client";
import ToolSettings from "@/app/tool-settings";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { PencilMark } from "./icons";
export default function WorkspaceHeader({
  isSignedIn,
  preferences,
  persistPreferences,
}: {
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
