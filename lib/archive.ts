// Codes are preserved verbatim; alphabetic codes are competition-specific.
export function parseSubmission(path: string) {
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) throw new Error('Neplatná cesta v ZIP archíve.');
  const basename = path.split('/').pop()!;
  const m = /^p(\d+)-c([a-z0-9]+)-(.+)-(\d+)\.pdf$/i.exec(basename);
  if (!m) return null;
  return { submissionId: m[4], problem: Number(m[1]), rocnik: m[2], name: m[3].split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' '), basename, folder: path.slice(0,-basename.length).replace(/\/$/,'') };
}
export function projectTitle(folder: string) {
 return folder.replace(/^(\d+)-/, '$1. ').replace(/-+/g,' ').trim();
}
export function exportName(title: string) {
 return title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[/\\:*?"<>|]/g,'').replace(/_opravene(?:\.zip)?$/i,'').trim() + '_opravene.zip';
}
