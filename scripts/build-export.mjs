import fs from 'node:fs/promises';
import ts from 'typescript';
await fs.mkdir('dist/export', { recursive: true });
for (const file of ['pdf-annotations', 'pdf-image', 'pdf-render', 'archive']) {
  const source = await fs.readFile(`lib/${file}.ts`, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/(from\s+['"]\.\/[^'"]+)(['"])/g, (match, path, quote) => `${path}${path.endsWith('.mjs') ? '' : '.mjs'}${quote}`);
  await fs.writeFile(`dist/export/${file}.mjs`, output);
}
