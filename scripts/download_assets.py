"""Download the original public Cartier WW26 assets without altering existing files.

Install: python -m pip install curl_cffi
Run:     python scripts/download_assets.py
Repair previously mis-decoded binary captures:
         python scripts/download_assets.py --repair-binaries
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PurePosixPath
from curl_cffi import requests
import argparse
import json
import re
import struct
import time

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
BASE = 'https://websitefactory.cartier.com/akamai-storage/videos/ww26/'
BENCHMARK_BASE = 'https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks/'
EXCLUDED = {'index.html', 'assets/app.js', 'assets/app.css'}
TEMPLATE = re.compile(r'^images/productPages/[^/]+/[^/]+\.webp$')
BENCHMARKS = [
    'd-intel', 'd-apple', 'd-amd', 'd-radeon', 'd-nvidia', 'd-geforce', 'd-adreno',
    'm-adreno', 'm-apple', 'm-mali-t', 'm-mali', 'm-nvidia', 'm-powervr', 'm-samsung', 'm-apple-ipad',
]

def verify_binary(path, data):
    suffix = Path(path).suffix
    if suffix == '.glb':
        if len(data) < 12 or data[:4] != b'glTF' or struct.unpack_from('<I', data, 8)[0] != len(data):
            raise ValueError('Invalid GLB magic or embedded file length')
    elif suffix == '.exr' and data[:4] != b'\x76\x2f\x31\x01':
        raise ValueError('Invalid EXR magic')
    elif suffix == '.wasm' and data[:4] != b'\x00asm':
        raise ValueError('Invalid WASM magic')
    elif suffix == '.json':
        json.loads(data)

def download(item):
    path, url, replace = item
    destination = PUBLIC / path
    if destination.exists() and not replace:
        return {'path': path, 'status': 'skipped-existing'}
    try:
        response = requests.get(url, impersonate='chrome', headers={'Referer': 'https://www.cartier.com/'}, timeout=120)
        record = {'path': path, 'url': url, 'status': response.status_code, 'bytes': len(response.content), 'contentType': response.headers.get('Content-Type')}
        if response.status_code != 200:
            return record
        verify_binary(path, response.content)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if replace:
            temporary = destination.with_suffix(destination.suffix + '.download')
            temporary.write_bytes(response.content)
            temporary.replace(destination)
        else:
            try:
                with destination.open('xb') as output:
                    output.write(response.content)
            except FileExistsError:
                record['status'] = 'skipped-existing'
        return record
    except Exception as error:
        return {'path': path, 'url': url, 'status': 'error', 'error': str(error)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repair-binaries', action='store_true', help='Replace existing GLB, EXR and WASM captures using original binary responses.')
    args = parser.parse_args()
    paths = json.loads((ROOT / 'audit/asset-paths.json').read_text(encoding='utf-8-sig'))
    pending, templates = [], []
    for path in paths:
        clean = str(PurePosixPath(path))
        if '..' in PurePosixPath(path).parts or path.startswith(('/', 'http')):
            raise ValueError(f'Invalid path: {path}')
        if clean in EXCLUDED:
            continue
        if TEMPLATE.match(clean):
            templates.append(clean)
            continue
        replace = args.repair_binaries and Path(path).suffix in {'.glb', '.exr', '.wasm'}
        if replace or not (PUBLIC / clean).exists():
            pending.append((clean, BASE + clean, replace))
    # Repaired binaries first so the original app can be previewed immediately.
    pending.sort(key=lambda item: (not item[2], item[0]))
    for filename in BENCHMARKS:
        path = f'benchmarks/{filename}.json'
        if not (PUBLIC / path).exists():
            pending.insert(0, (path, BENCHMARK_BASE + filename + '.json', False))
    print(f'Manifest: {len(paths)}; template-only paths: {len(templates)}; pending downloads: {len(pending)}', flush=True)
    started = time.monotonic()
    results = []
    report = ROOT / 'audit/download-assets-report.json'
    with ThreadPoolExecutor(max_workers=4) as pool:
        for job in as_completed([pool.submit(download, item) for item in pending]):
            record = job.result()
            results.append(record)
            if record['status'] not in (200, 'skipped-existing'):
                print('FAIL', json.dumps(record), flush=True)
            if len(results) % 25 == 0 or len(results) == len(pending):
                print(f"Progress {len(results)}/{len(pending)}, bytes {sum(item.get('bytes', 0) for item in results if item['status'] == 200):,}, elapsed {time.monotonic() - started:.0f}s", flush=True)
                report.write_text(json.dumps({'templateInputsSkipped': templates, 'results': results}, indent=2), encoding='utf-8')
    report.write_text(json.dumps({'templateInputsSkipped': templates, 'results': results}, indent=2), encoding='utf-8')
    print(json.dumps({'downloaded': sum(item['status'] == 200 for item in results), 'failed': sum(item['status'] not in (200, 'skipped-existing') for item in results), 'bytes': sum(item.get('bytes', 0) for item in results if item['status'] == 200), 'seconds': round(time.monotonic() - started, 1)}), flush=True)

if __name__ == '__main__':
    main()
