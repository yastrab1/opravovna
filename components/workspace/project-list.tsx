"use client";
import { FileText, FolderOpen, Plus, Users } from "lucide-react";
import { ArrowIcon } from "./icons";
export default function ProjectList({
  projects,
  hasJoin,
  join,
  busy,
  create,
  newTitle,
  setNewTitle,
  open,
}: {
  projects: any[];
  hasJoin: boolean;
  join: any;
  busy: string;
  create: any;
  newTitle: string;
  setNewTitle: any;
  open: any;
}) {
  return (
    <section className="projects">
      <div className="sectionintro">
        <div>
          <div className="eyebrow">PRACOVNÝ PRIESTOR</div>
          <h1>Vaše projekty</h1>
          <p className="muted">
            Každý archív má svoj priestor na spoločné opravovanie.
          </p>
        </div>
        <FolderOpen size={48} strokeWidth={1} className="muted" />
      </div>
      {hasJoin && (
        <div className="joinbox">
          <Users size={20} />
          <span>Dostali ste pozvanie do projektu.</span>
          <button className="primary" onClick={join} disabled={!!busy}>
            Prijať pozvanie
          </button>
        </div>
      )}
      <form className="newproject" onSubmit={create}>
        <Plus size={20} />
        <input
          aria-label="Názov nového projektu"
          placeholder="Názov nového projektu"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={200}
        />
        <button className="primary" disabled={!!busy}>
          Vytvoriť projekt
        </button>
      </form>
      <div className="projectlist">
        {projects.length ? (
          projects.map((p) => (
            <button
              className="projectrow"
              key={p.id}
              onClick={() => open(p.id)}
              disabled={!!busy}
            >
              <span className="foldericon">
                <FolderOpen size={23} />
              </span>
              <span>
                <strong>{p.title}</strong>
                <small>
                  Vytvorené {new Date(p.created).toLocaleDateString("sk-SK")}
                </small>
              </span>
              <span className="rowend">
                Otvoriť <ArrowIcon />
              </span>
            </button>
          ))
        ) : (
          <div className="empty">
            <FileText size={32} />
            <h2>Začnite prvým projektom</h2>
            <p>
              Vytvorte projekt a nahrajte archív riešení alebo opravený export.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
