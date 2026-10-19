#!/usr/bin/env python3
"""Offline, deterministic source candidate. Never publishes or reads environment files."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parent.parent
FILES = ['LICENSE', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
         'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs',
         'Dockerfile', 'docker-compose.yml', '.dockerignore', '.gitignore',
         'scripts/devnet-claim.ts', 'scripts/devnet-rpc-pacing.ts', 'scripts/install.sh', 'scripts/verify-dependency.mjs', 'scripts/verify-environment.mjs',
         'deploy/build-source-release.py', 'deploy/verify-source-release.py', 'deploy/SOURCE_RELEASE.md',
         'deploy/THIRD_PARTY_NOTICES.md', 'deploy/RAYDIUM_SDK_LICENSE.txt']
TREES = ['src', 'public', 'patches', 'supabase/migrations', 'tests', 'deploy/source-vendor']
DENIED = {'.git', '.next', 'node_modules', 'evidence', 'runs', '.local-data',
          'coverage', 'test-results', 'playwright-report', '__pycache__', 'source-releases'}
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]{12,}')

def safe(path):
    if path.parts[:2] == ('public', 'source'):
        return False  # Generated release payloads must never include themselves.
    return not any(p in DENIED or p.startswith('.env') for p in path.parts) and path.suffix not in {'.log', '.tsbuildinfo', '.pem', '.key', '.p12', '.pfx'}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output', default='/tmp/stonklaunch-source-release')
    args = ap.parse_args()
    output = Path(args.output).resolve()
    if output == ROOT or ROOT in output.parents:
        raise SystemExit('Output must be outside the repository; no publication directory is permitted.')
    data = {}
    def add(path, name):
        if path.is_symlink() or not path.is_file():
            raise SystemExit(f'Expected regular file, not symlink: {name}')
        content = path.read_bytes()
        if SECRET.search(content):
            raise SystemExit(f'Potential credential pattern; review file locally: {name}')
        data[name] = content
    for name in FILES:
        add(ROOT / name, name)
    for name in TREES:
        tree = ROOT / name
        for base, dirs, files in os.walk(tree, followlinks=False):
            dirs[:] = sorted(d for d in dirs if safe(Path(base, d).relative_to(ROOT)) and not Path(base, d).is_symlink())
            for file in sorted(files):
                path = Path(base, file)
                rel = path.relative_to(ROOT)
                if safe(rel):
                    add(path, rel.as_posix())
    # Do not read even .env.example: publish only this known, noncredential template.
    data['.env.example'] = b'# Generated safe template. Demo defaults; no credentials supplied.\n'
    pkg = json.loads(data['package.json'])
    sdk = (ROOT / 'node_modules/@raydium-io/raydium-sdk-v2').resolve(strict=True)
    meta = json.loads((sdk / 'package.json').read_bytes())
    expected = pkg['dependencies']['@raydium-io/raydium-sdk-v2']
    if meta['version'] != expected or meta.get('license') != 'GPL-3.0':
        raise SystemExit('Installed SDK does not match exact application version/license.')
    for name in ['LICENSE', 'package.json', 'README.md']:
        add(sdk / name, 'third_party/raydium-sdk-v2/' + name)
    for base, dirs, files in os.walk(sdk / 'src', followlinks=False):
        dirs[:] = sorted(d for d in dirs if not Path(base, d).is_symlink())
        for file in sorted(files):
            path = Path(base, file)
            rel = path.relative_to(sdk)
            if not safe(rel):
                raise SystemExit(f'Unexpected SDK source filename: {rel}')
            add(path, 'third_party/raydium-sdk-v2/' + rel.as_posix())
    add(ROOT / 'deploy/source-vendor/raydium-sdk-v2/tsconfig.json', 'third_party/raydium-sdk-v2/tsconfig.json')
    # Metadata-only inventory; do not traverse arbitrary package files or credential paths.
    inventory = {}
    notice_records = []
    for manifest in sorted((ROOT / 'node_modules/.pnpm').glob('*/node_modules/*/package.json')) + sorted((ROOT / 'node_modules/.pnpm').glob('*/node_modules/@*/*/package.json')):
        if manifest.parent.is_symlink():
            continue
        dep = json.loads(manifest.read_bytes())
        key = dep.get('name', '') + '@' + dep.get('version', '')
        inventory[key] = {'name': dep.get('name'), 'version': dep.get('version'), 'license': dep.get('license', dep.get('licenses', 'UNKNOWN')), 'repository': dep.get('repository')}
        # Preserve installed license/copyright/notice files including embedded framework notices.
        for base, dirs, files in os.walk(manifest.parent, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in DENIED and not Path(base, d).is_symlink())
            for filename in sorted(files):
                if re.match(r'(?i)^(licen[cs]e|copying|copyright|notice|authors)([._-].*)?$', filename):
                    path = Path(base, filename)
                    if not path.is_symlink():
                        rel = path.relative_to(manifest.parent).as_posix()
                        target = 'third_party/notices/' + key.replace('/', '__') + '/' + rel
                        add(path, target)
                        notice_records.append({'package': key, 'file': target})
    data['THIRD_PARTY_NOTICE_INDEX.json'] = (json.dumps(notice_records, sort_keys=True, indent=2) + '\n').encode()
    rpc = ROOT / 'deploy/source-vendor/rpc-websockets'
    rpc_installed = ROOT / 'node_modules/.pnpm/rpc-websockets@9.3.9/node_modules/rpc-websockets'
    if json.loads((rpc / 'package.json').read_bytes())['version'] != '9.3.9':
        raise SystemExit('Unexpected vendored rpc-websockets version')
    source_maps = sorted((rpc_installed / 'dist').glob('*.map'))
    if len(source_maps) != 4:
        raise SystemExit('Expected four installed rpc-websockets source maps')
    for source_map in source_maps:
        mapping = json.loads(source_map.read_bytes())
        for name, content in zip(mapping['sources'], mapping['sourcesContent']):
            rel = Path(name.removeprefix('../'))
            if '..' in rel.parts or rel.is_absolute() or not str(rel).startswith('src/'):
                raise SystemExit('Unsafe upstream source map path')
            if (rpc / rel).read_text() != content:
                raise SystemExit('Pinned rpc-websockets source does not match installed bundle')

    notice_records = sorted({(n['package'], n['file']): n for n in notice_records}.values(), key=lambda n: (n['package'], n['file']))
    data['THIRD_PARTY_NOTICE_INDEX.json'] = (json.dumps(notice_records, sort_keys=True, indent=2) + '\n').encode()
    data['DEPENDENCY_LICENSE_INVENTORY.json'] = (json.dumps(list(inventory.values()), sort_keys=True, indent=2) + '\n').encode()
    version = pkg['version']
    if not re.fullmatch(r'[A-Za-z0-9._+-]+', version):
        raise SystemExit('Unsafe application version')
    manifest = {'application': pkg['name'], 'version': version, 'sdk_version': expected,
                'status': 'LOCAL_REVIEW_CANDIDATE_NOT_LEGAL_CLEARANCE',
                'files': [{'path': name, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()} for name, value in sorted(data.items())]}
    manifest_bytes = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    data['SOURCE_MANIFEST.json'] = manifest_bytes
    digest = hashlib.sha256(manifest_bytes).hexdigest()
    basename = f'stonklaunch-{version}-source-{digest[:16]}'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / (basename + '.tar.gz')
    with archive.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode='w', format=tarfile.USTAR_FORMAT) as tar:
                for name, content in sorted(data.items()):
                    info = tarfile.TarInfo(basename + '/' + name)
                    info.size = len(content)
                    info.mode = 0o644
                    info.mtime = 0
                    tar.addfile(info, io.BytesIO(content))
    sha = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / (basename + '.manifest.json')).write_bytes(manifest_bytes)
    (output / (basename + '.sha256')).write_text(f'{sha}  {archive.name}\n')
    print(json.dumps({'archive': str(archive), 'sha256': sha, 'manifest_sha256': digest, 'files': len(data), 'installed_packages_in_inventory': len(inventory), 'status': manifest['status']}, indent=2))

if __name__ == '__main__':
    main()
