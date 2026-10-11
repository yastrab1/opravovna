"use client";
import {
  ChevronLeft,
  Download,
  Save,
  Users,
  UserRoundCheck,
} from "lucide-react";
export default function ProjectToolbar({
  save,
  setProject,
  list,
  report,
  busy,
  project,
  saveStatus,
  readonly,
  exportZip,
  mergeConflicts,
  openSharing,
  openAssignments,
}: {
  save: any;
  setProject: any;
  list: any;
  report: any;
  busy: string;
  project: any;
  saveStatus: string;
  readonly: boolean;
  exportZip: any;
  mergeConflicts: any[];
  openSharing: any;
  openAssignments: () => void;
}) {
  return (
    <div className="projectbar">
      <button
        className="backbutton"
        onClick={async () => {
          if (await save()) {
            setProject(null);
            list().catch(report);
          }
        }}
        disabled={!!busy}
      >
        <ChevronLeft size={18} /> Projekty
      </button>
      <div className="projectname">
        <span className="eyebrow">PROJEKT</span>
        <strong>{project.title}</strong>
      </div>
      <span className="sync" role="status">
        <span
          className={saveStatus === "Uložené" ? "statusdot" : "statusdot amber"}
        />
        {saveStatus}
      </span>
      <div className="projectactions">
        <button onClick={() => save()} disabled={readonly || !!busy}>
          <Save size={16} />
          <span className="desktop">Uložiť</span>
        </button>
        {project.role === "owner" && (
          <button onClick={openSharing} disabled={!!busy}>
            <Users size={16} />
            <span className="desktop">Zdieľať</span>
          </button>
        )}
        {project.role === "owner" && (
          <button
            onClick={openAssignments}
            disabled={!!busy || !project.documents.length}
          >
            <UserRoundCheck size={16} />
            <span className="desktop">Priradiť</span>
          </button>
        )}
        <button
          className="primary"
          onClick={exportZip}
          disabled={
            !!busy || !project.documents.length || mergeConflicts.length > 0
          }
        >
          <Download size={16} /> Exportovať ZIP
        </button>
      </div>
    </div>
  );
}
