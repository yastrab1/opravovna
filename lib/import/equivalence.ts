export function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
export function stateComments(state: any) {
  if (Array.isArray(state.scoring?.comments)) return state.scoring.comments;
  const comments = (state.changes ?? [])
    .filter(
      (change: any) =>
        change.type === "Text" &&
        change.data?.text &&
        change.data?.name !== state.scoring?.annotName,
    )
    .map((change: any) => change.data.text);
  return state.scoring?.points == null
    ? comments
    : [...comments, `${state.scoring.points}B`];
}
export async function sameGradedSubmission(
  projectId: string,
  doc: any,
  incoming: any,
  pdf: Uint8Array,
) {
  if (
    doc.state.scoring?.points !== incoming.scoring?.points ||
    JSON.stringify(doc.state.tags ?? []) !==
      JSON.stringify(incoming.tags ?? []) ||
    JSON.stringify(stateComments(doc.state)) !==
      JSON.stringify(stateComments(incoming))
  )
    return false;
  const matches = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      return sameBytes(new Uint8Array(await response.arrayBuffer()), pdf);
    } catch {
      return false;
    }
  };
  const base = `/api/projects/${projectId}/documents/${doc.id}/file`;
  const visualState = (s: any) =>
    JSON.stringify([s.changes ?? [], s.rotations ?? {}, s.extraPages ?? 0]);
  if (visualState(doc.state) === visualState(incoming) && (await matches(base)))
    return true;
  const state = doc.state;
  if (
    !state.changes?.length &&
    !state.extraPages &&
    !Object.values(state.rotations ?? {}).some((value: any) => value !== 0)
  )
    return false;
  try {
    const response = await fetch(base);
    if (!response.ok) return false;
    const original = new Uint8Array(await response.arrayBuffer());
    const { flattenPdf } = await import("@/lib/pdf-engine");
    return sameBytes(await flattenPdf(original, state), pdf);
  } catch {
    return false;
  }
}
