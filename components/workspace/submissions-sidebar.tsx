"use client";
import SubmissionFilters from "./submission-filters";
import Thumbnail from "@/app/thumbnail";
import { categoryLabel } from "@/lib/preferences";
import { tagName } from "@/lib/tags";
import { Check, Search, Upload } from "lucide-react";
export default function SubmissionsSidebar({
  project,
  readonly,
  busy,
  importZip,
  query,
  setQuery,
  projectPreferences,
  setProjectPreferences,
  allTags,
  categoryOptions,
  documents,
  active,
  switchDoc,
}: {
  project: any;
  readonly: boolean;
  busy: string;
  importZip: any;
  query: string;
  setQuery: any;
  projectPreferences: any;
  setProjectPreferences: any;
  allTags: string[];
  categoryOptions: string[];
  documents: any[];
  active: any;
  switchDoc: any;
}) {
  return (
    <aside className="submissions">
      <div className="listheading">
        <h2>
          Riešenia <span>{project.documents.length}</span>
        </h2>
        {!readonly && (
          <label
            className={"iconbutton " + (busy ? "disabled" : "")}
            title="Importovať ZIP"
          >
            <Upload size={17} />
            <input
              type="file"
              accept=".zip"
              aria-label="Importovať ZIP"
              hidden
              disabled={!!busy}
              onChange={(e) => {
                if (e.target.files?.[0]) importZip(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="search">
        <Search size={16} />
        <input
          aria-label="Hľadať riešenie"
          placeholder="Meno, ID alebo ročník…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <SubmissionFilters
        value={projectPreferences}
        onChange={setProjectPreferences}
        tags={allTags}
        categories={categoryOptions}
      />
      <div className="documentlist">
        {documents.map((d: any) => (
          <button
            disabled={!!busy}
            key={d.id}
            className={"documentrow " + (active === d.id ? "selected" : "")}
            onClick={() => switchDoc(d.id)}
          >
            <Thumbnail project={project.id} id={d.id} version={d.fileVersion} />
            <span>
              <strong>{d.metadata.name}</strong>
              <small>
                {categoryLabel(d.metadata.rocnik)} · #{d.metadata.submissionId}
              </small>
              {d.state.tags.length > 0 && (
                <span className="documenttags">
                  {d.state.tags.map((t: any, i: number) => (
                    <span className="tagchip" key={i} title={tagName(t)}>
                      {tagName(t)}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span
              className={
                "scorebadge " +
                (d.state.scoring?.points != null ? "scored" : "")
              }
            >
              {d.state.scoring?.points ?? "–"}
            </span>
          </button>
        ))}
        {!documents.length && (
          <p className="listempty">
            {project.documents.length
              ? "Žiadne riešenie nevyhovuje filtru."
              : "Nahrajte ZIP archív pomocou tlačidla vyššie."}
          </p>
        )}
      </div>
      <div className="listfooter">
        <span>
          <Check size={14} />
          {
            project.documents.filter(
              (d: any) => d.state.scoring?.points != null,
            ).length
          }{" "}
          / {project.documents.length} ohodnotených
        </span>
      </div>
    </aside>
  );
}
