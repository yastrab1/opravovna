"use client";
import GradingSidebar from "@/components/workspace/grading-sidebar";
import ImportScoreDialog from "@/components/workspace/import-score-dialog";
import MergeDialog from "@/components/workspace/merge-dialog";
import ProjectEmpty from "@/components/workspace/project-empty";
import ProjectList from "@/components/workspace/project-list";
import ProjectToolbar from "@/components/workspace/project-toolbar";
import ShareDialog from "@/components/workspace/share-dialog";
import SubmissionsSidebar from "@/components/workspace/submissions-sidebar";
import Welcome from "@/components/workspace/welcome";
import WorkspaceHeader from "@/components/workspace/workspace-header";
import { useWorkspace } from "@/hooks/use-workspace";
import { download } from "@/lib/client-api";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
const PdfEditor = dynamic(() => import("./pdf-editor"), {
  ssr: false,
  loading: () => <div className="loading">Pripravujem editor…</div>,
});
export default function Workspace() {
  const {
    scoreCorrection,
    isSignedIn,
    preferences,
    persistPreferences,
    error,
    saveStatus,
    current,
    dirty,
    setError,
    open,
    project,
    mergeConflicts,
    setMergeOpen,
    mergeOpen,
    mergeDialog,
    setMergeConflicts,
    busy,
    resolveMerge,
    isLoaded,
    projects,
    hasJoin,
    join,
    create,
    newTitle,
    setNewTitle,
    save,
    setProject,
    list,
    report,
    readonly,
    exportZip,
    openSharing,
    sharing,
    shareDialog,
    setSharing,
    email,
    setEmail,
    memberRole,
    setMemberRole,
    members,
    setMembers,
    link,
    setLink,
    importZip,
    query,
    setQuery,
    projectPreferences,
    setProjectPreferences,
    filter,
    setFilter,
    allTags,
    tagFilter,
    setTagFilter,
    categories,
    categoryOptions,
    setCategories,
    documents,
    active,
    switchDoc,
    nextDocument,
    openNext,
    doc,
    changed,
    editor,
    applyGrade,
    projectTags,
    toggleTag,
    tag,
    setTag,
  } = useWorkspace();
  return (
    <main>
      {scoreCorrection.issues.length > 0 && (
        <ImportScoreDialog {...scoreCorrection} />
      )}
      <WorkspaceHeader
        projectId={project?.id}
        documentId={active}
        onOpenDocument={switchDoc}
        busy={!!busy}
        onError={report}
        isSignedIn={isSignedIn}
        preferences={preferences}
        persistPreferences={persistPreferences}
      />
      {error && (
        <div role="alert" className="notice error">
          <span>{error}</span>
          {saveStatus === "Konflikt zmien" && (
            <>
              <button
                onClick={() =>
                  download(
                    new Blob(
                      [JSON.stringify(current.current.doc.state, null, 2)],
                      { type: "application/json" },
                    ),
                    "moje-neulozene-zmeny.json",
                  )
                }
              >
                Stiahnuť moje zmeny
              </button>
              <button
                onClick={() => {
                  dirty.current = false;
                  setError("");
                  open(project.id);
                }}
              >
                Načítať serverovú verziu
              </button>
            </>
          )}
          <button aria-label="Zavrieť upozornenie" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {mergeConflicts.length > 0 && !mergeOpen && (
        <div className="notice progress">
          <span>
            {mergeConflicts.length} nevyriešených konfliktov pri importe.
          </span>
          <button onClick={() => setMergeOpen(true)}>Vyriešiť konflikty</button>
        </div>
      )}
      {mergeOpen && (
        <MergeDialog
          mergeDialog={mergeDialog}
          setMergeOpen={setMergeOpen}
          error={error}
          mergeConflicts={mergeConflicts}
          setMergeConflicts={setMergeConflicts}
          busy={busy}
          resolveMerge={resolveMerge}
        />
      )}
      {busy && (
        <div className="notice progress" role="status">
          <span className="pulse" />
          {busy}
        </div>
      )}
      {!isLoaded ? (
        <div className="loading">Načítavam…</div>
      ) : !isSignedIn ? (
        <Welcome />
      ) : !project ? (
        <ProjectList
          projects={projects}
          hasJoin={hasJoin}
          join={join}
          busy={busy}
          create={create}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          open={open}
        />
      ) : (
        <>
          <ProjectToolbar
            save={save}
            setProject={setProject}
            list={list}
            report={report}
            busy={busy}
            project={project}
            saveStatus={saveStatus}
            readonly={readonly}
            exportZip={exportZip}
            mergeConflicts={mergeConflicts}
            openSharing={openSharing}
          />
          {sharing && (
            <ShareDialog
              shareDialog={shareDialog}
              setSharing={setSharing}
              project={project}
              email={email}
              setEmail={setEmail}
              memberRole={memberRole}
              setMemberRole={setMemberRole}
              members={members}
              setMembers={setMembers}
              link={link}
              setLink={setLink}
              report={report}
            />
          )}
          <div className="workspace">
            <SubmissionsSidebar
              project={project}
              readonly={readonly}
              busy={busy}
              importZip={importZip}
              query={query}
              setQuery={setQuery}
              projectPreferences={projectPreferences}
              setProjectPreferences={setProjectPreferences}
              filter={filter}
              setFilter={setFilter}
              allTags={allTags}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              categories={categories}
              categoryOptions={categoryOptions}
              setCategories={setCategories}
              documents={documents}
              active={active}
              switchDoc={switchDoc}
            />
            {doc ? (
              <>
                <PdfEditor
                  defaults={preferences.tools}
                  key={doc.id}
                  doc={doc}
                  projectId={project.id}
                  readonly={readonly || !!busy}
                  onChange={changed}
                  onError={report}
                  register={(a) => {
                    editor.current = a;
                  }}
                />
                <GradingSidebar
                  doc={doc}
                  readonly={readonly}
                  busy={busy}
                  applyGrade={applyGrade}
                  nextDocument={nextDocument}
                  openNext={openNext}
                  editor={editor}
                  projectTags={projectTags}
                  toggleTag={toggleTag}
                  tag={tag}
                  setTag={setTag}
                  changed={changed}
                />
              </>
            ) : (
              <ProjectEmpty
                readonly={readonly}
                busy={busy}
                importZip={importZip}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
