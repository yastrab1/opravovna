"""Copy persisted PDFs and consistent SQLite snapshots; abort on verification failure."""
import hashlib
import json
import pathlib
import shutil
import sqlite3


def backup_state(source, destination):
    source, destination = pathlib.Path(source), pathlib.Path(destination)
    destination.mkdir(parents=True, exist_ok=False, mode=0o700)
    manifest = {}
    # Snapshot metadata first. PDF versions are immutable and retained, so copying
    # blobs afterwards includes the versions referenced by these snapshots.
    databases = list(source.rglob('*.sqlite'))
    if not databases:
        raise RuntimeError('No persisted databases found; refusing empty backup')
    for original in databases:
        target = destination / original.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(original.as_uri() + '?mode=ro', uri=True) as src:
            with sqlite3.connect(target) as dst:
                src.backup(dst)
                if dst.execute('pragma integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Invalid database backup')
    for original in source.rglob('*'):
        if not original.is_file() or original.suffix == '.sqlite' or original.name.endswith(('.sqlite-wal', '.sqlite-shm')):
            continue
        target = destination / original.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        # Compare source and copy; any concurrent replacement aborts deployment.
        if digest(original) != digest(target):
            raise RuntimeError('Backup verification failed: source changed during copy')
    verify_references(destination)
    for target in destination.rglob('*'):
        if target.is_file():
            manifest[str(target.relative_to(destination))] = {
                'bytes': target.stat().st_size, 'sha256': digest(target)
            }
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Verified full state backup: {len(databases)} databases, {len(manifest)} files; {destination}')


def verify_references(destination):
    blobs = {file.name: file for file in destination.rglob('*') if file.is_file() and file.parent.name == 'blobs'}
    object_keys, references = set(), set()
    for file in destination.rglob('*.sqlite'):
        with sqlite3.connect(file.as_uri() + '?mode=ro', uri=True) as db:
            tables = {row[0] for row in db.execute("select name from sqlite_master where type='table'")}
            if '_mf_objects' in tables:
                for key, blob, size in db.execute('select key, blob_id, size from _mf_objects'):
                    object_keys.add(key)
                    if blob is not None and (blob not in blobs or blobs[blob].stat().st_size != size):
                        raise RuntimeError('Backup is missing a referenced PDF/archive blob')
            if '_mf_multipart_parts' in tables:
                for blob, size in db.execute('select blob_id, size from _mf_multipart_parts'):
                    if blob not in blobs or blobs[blob].stat().st_size != size:
                        raise RuntimeError('Backup is missing a multipart blob')
            if 'documents' in tables:
                references.update(value for row in db.execute('select original, graded from documents') for value in row if value)
            if 'projects' in tables:
                references.update(row[0] for row in db.execute('select archive from projects') if row[0])
    if not references.issubset(object_keys):
        raise RuntimeError('Backup contains a PDF/archive reference with no stored object')
    print(f'Checked storage references: {len(references)} PDFs/archives, {len(object_keys)} stored objects')


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


if __name__ == '__main__':
    import sys
    backup_state(sys.argv[1], sys.argv[2])
