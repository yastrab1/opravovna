import { spawnSync } from 'node:child_process';

if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY before building.');
}
const tags = process.argv.slice(2);
if (!tags.length) throw new Error('Supply at least one image tag.');
const result = spawnSync('docker', [
  'build', '--build-arg', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  ...tags.flatMap(tag => ['-t', tag]), '.',
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
