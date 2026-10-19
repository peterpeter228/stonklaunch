#!/usr/bin/env python3
"""Offline pre-build consistency gate; reads archives in memory without extraction."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import runpy
import tarfile

ROOT = Path(__file__).resolve().parent.parent
GENERATED = {'.env.example', 'DEPENDENCY_LICENSE_INVENTORY.json', 'THIRD_PARTY_NOTICE_INDEX.json'}

def verify(root=ROOT, archive=None, checksums=None):
    root = Path(root)
    archive = Path(archive) if archive else root / 'public/source/stonklaunch-source.tar.gz'
    checksums = Path(checksums) if checksums else root / 'public/source/SHA256SUMS.txt'
    assert archive.is_file() and not archive.is_symlink(), 'Missing regular source archive'
    assert archive.stat().st_size <= 32 * 1024 * 1024, 'Archive exceeds bounded review size'
    lines = checksums.read_text().splitlines()
    matching = [line.split()[0] for line in lines if re.fullmatch(r'[a-f0-9]{64}\s+\*?stonklaunch-source\.tar\.gz', line)]
    assert len(matching) == 1, 'Expected one checksum for stonklaunch-source.tar.gz'
    actual = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert actual == matching[0], 'Archive checksum mismatch'
    payload = {}
    total = 0
    with tarfile.open(archive, 'r:gz') as tar:
        prefix = None
        for member in tar:
            name = PurePosixPath(member.name)
            assert member.isfile() and not name.is_absolute() and '..' not in name.parts, 'Unsafe archive member'
            assert len(name.parts) >= 2, 'Missing archive root directory'
            prefix = prefix or name.parts[0]
            assert name.parts[0] == prefix, 'Multiple archive roots'
            rel = PurePosixPath(*name.parts[1:]).as_posix()
            assert rel not in payload, 'Duplicate archive member'
            total += member.size
            assert total <= 64 * 1024 * 1024 and len(payload) < 10000, 'Archive exceeds bounded review limits'
            payload[rel] = tar.extractfile(member).read()
    manifest = json.loads(payload.pop('SOURCE_MANIFEST.json'))
    entries = manifest['files']
    assert len(entries) == len(payload), 'Manifest member count mismatch'
    declared = set()
    for item in entries:
        path = item['path']
        assert path not in declared, 'Duplicate manifest path'
        declared.add(path)
        value = payload[path]
        assert len(value) == item['bytes'] and hashlib.sha256(value).hexdigest() == item['sha256'], f'Manifest hash mismatch: {path}'
    assert declared == set(payload), 'Unmanifested archive member'
    # Trusted local builder defines the same allowlist. Importing does not run main().
    policy = runpy.run_path(str(root / 'deploy/build-source-release.py'))
    expected = set(policy['FILES'])
    for tree in policy['TREES']:
        for path in (root / tree).rglob('*'):
            rel = path.relative_to(root)
            if path.is_file() and policy['safe'](rel):
                assert not path.is_symlink(), f'Symlink in authored source: {rel}'
                expected.add(rel.as_posix())
    authored = {p for p in payload if p not in GENERATED and not p.startswith('third_party/')}
    assert authored == expected, f'Authored file set changed; missing={sorted(expected-authored)}, obsolete={sorted(authored-expected)}'
    for path in sorted(expected):
        assert not any(part.startswith('.env') for part in Path(path).parts), 'Environment file in source allowlist'
        local = root / path
        assert local.is_file() and not local.is_symlink(), f'Missing regular authored file: {path}'
        assert local.read_bytes() == payload[path], f'Stale source archive: {path}'
    package = json.loads(payload['package.json'])
    assert manifest['version'] == package['version'], 'Application version mismatch'
    assert manifest['sdk_version'] == package['dependencies']['@raydium-io/raydium-sdk-v2'], 'SDK version mismatch'
    return {'status': 'PASS', 'sha256': actual, 'authored_files': len(expected), 'archive_files': len(payload)+1,
            'scope': 'Archive/manifest integrity and current authored source consistency; no install, extraction, network or legal clearance.'}

if __name__ == '__main__':
    try:
        print(json.dumps(verify(), indent=2))
    except (AssertionError, OSError, KeyError, ValueError, tarfile.TarError) as error:
        raise SystemExit(f'SOURCE_RELEASE_GATE_FAILED: {error}')
