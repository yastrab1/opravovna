"use client";
import { api } from "@/lib/client-api";
import { Link, X } from "lucide-react";
export default function ShareDialog({
  shareDialog,
  setSharing,
  project,
  email,
  setEmail,
  memberRole,
  setMemberRole,
  members,
  setMembers,
  link,
  setLink,
  report,
}: {
  shareDialog: any;
  setSharing: any;
  project: any;
  email: string;
  setEmail: any;
  memberRole: string;
  setMemberRole: any;
  members: any[];
  setMembers: React.Dispatch<React.SetStateAction<any[]>>;
  link: string;
  setLink: any;
  report: any;
}) {
  return (
    <dialog
      ref={shareDialog}
      className="sharing"
      aria-labelledby="share-title"
      onCancel={() => setSharing(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            setSharing(false);
        }
      }}
    >
      <div className="shareheading">
        <h2 id="share-title">Zdieľanie projektu</h2>
        <button
          aria-label="Zavrieť zdieľanie"
          onClick={() => setSharing(false)}
        >
          <X size={18} />
        </button>
      </div>
      <div>
        <p className="muted">
          Používateľ sa prihlási cez Clerk rovnakým e-mailom. Pozvánky
          neposielame e-mailom.
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`projects/${project.id}/members`, {
              method: "POST",
              body: JSON.stringify({ email, role: memberRole }),
            });
            setEmail("");
            setMembers(await api(`projects/${project.id}/members`));
          } catch (e) {
            report(e);
          }
        }}
      >
        <input
          aria-label="E-mail spolupracovníka"
          type="email"
          required
          placeholder="kolega@example.sk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          value={memberRole}
          onChange={(e) => setMemberRole(e.target.value)}
          aria-label="Prístup"
        >
          <option value="editor">Môže upravovať</option>
          <option value="viewer">Môže čítať</option>
        </select>
        <button className="primary">Pridať</button>
      </form>
      <div className="memberlist">
        {members.map((m) => (
          <div key={m.id}>
            <span>{m.email}</span>
            <small>{m.role === "editor" ? "Úpravy" : "Čítanie"}</small>
            <button
              aria-label={"Odobrať " + m.email}
              onClick={async () => {
                try {
                  await api(`projects/${project.id}/members`, {
                    method: "DELETE",
                    body: JSON.stringify({ id: m.id }),
                  });
                  setMembers(members.filter((x) => x.id !== m.id));
                } catch (e) {
                  report(e);
                }
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="sharelink">
        <button
          onClick={async () => {
            try {
              const r = await api(`projects/${project.id}/share`, {
                method: "POST",
                body: "{}",
              });
              setLink(location.origin + "/?join=" + r.token);
            } catch (e) {
              report(e);
            }
          }}
        >
          <Link size={15} /> Vytvoriť odkaz pre opravovateľov
        </button>
        {link && (
          <>
            <input
              readOnly
              aria-label="Odkaz na pripojenie"
              value={link}
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(link).catch(report)}
            >
              Kopírovať
            </button>
            <button
              onClick={async () => {
                try {
                  await api(`projects/${project.id}/share`, {
                    method: "POST",
                    body: '{"revoke":true}',
                  });
                  setLink("");
                } catch (e) {
                  report(e);
                }
              }}
            >
              Zrušiť odkaz
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
