import fs from 'node:fs/promises';
import ts from 'typescript';
await fs.mkdir('dist/export', { recursive: true });
for (const file of ['pdf-annotations', 'pdf-render', 'archive']) {
  const source = await fs.readFile(`lib/${file}.ts`, 'utf8');
  await fs.writeFile(`dist/export/${file}.mjs`, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
