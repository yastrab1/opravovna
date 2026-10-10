import {defineConfig,globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
 ...nextVitals,...nextTs,
 globalIgnores(['**/node_modules/**','local-worker.mjs','dist/**','.next/**','.test-tmp/**','.sites-runtime/**','.wrangler/**','public/pdf.worker.min.mjs','public/pdfjs/**','build/**','next-env.d.ts']),
 {rules:{
  // Arnold, PDF.js and Fabric exchange extensible object records. Keep unknown
  // fields at those boundaries instead of pretending their shape is closed.
  '@typescript-eslint/no-explicit-any':'off',
  // Canvas instances live in refs; account/document synchronization is an
  // intentional effect. These compiler-only rules do not model those APIs.
  'react-hooks/refs':'off','react-hooks/set-state-in-effect':'off',
 }},
 {files:['hooks/editor/**/*','app/workspace.tsx'],rules:{'react-hooks/immutability':'off'}},
 {files:['**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}},
]);
