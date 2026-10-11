import { workspaceUrl } from "@/lib/workspace-url";
export default function ErrorSolutionLink({
  solution,
  open,
}: {
  solution: {
    project: string;
    id: string;
    label: string;
    path?: string;
  } | null;
  open: (project: string, solution: string) => Promise<boolean>;
}) {
  if (!solution?.id) return null;
  const href = workspaceUrl(new URL("https://opravovna.tech/"), {
    project: solution.project,
    solution: solution.id,
  });
  return (
    <a
      href={href.pathname + href.search}
      title={solution.path}
      onClick={(event) => {
        event.preventDefault();
        void open(solution.project, solution.id);
      }}
    >
      Otvoriť zlyhané riešenie: {solution.label}
    </a>
  );
}
