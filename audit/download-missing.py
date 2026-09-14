from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PurePosixPath
from curl_cffi import requests
import json
import time

ROOT = Path('F:/Cartier')
PUBLIC = ROOT / 'public'
BASE = 'https://websitefactory.cartier.com/akamai-storage/videos/ww26/'
EXCLUDED = {'index.html', 'assets/app.js', 'assets/app.css'}
paths = json.loads((ROOT / 'audit/asset-paths.json').read_text(encoding='utf-8-sig'))
pending = []
for path in paths:
    clean = str(PurePosixPath(path))
    if '..' in PurePosixPath(path).parts or path.startswith(('/', 'http')):
        raise ValueError(f'Invalid path: {path}')
    if clean not in EXCLUDED and not (PUBLIC / clean).exists():
        pending.append(clean)

print(f'Manifest: {len(paths)}, missing: {len(pending)}', flush=True)
started = time.monotonic()
results = []

def download(path):
    destination = PUBLIC / path
    if destination.exists():
        return {'path': path, 'status': 'skipped-existing'}
    try:
        response = requests.get(BASE + path, impersonate='chrome', headers={'Referer': 'https://www.cartier.com/'}, timeout=120)
        record = {'path': path, 'status': response.status_code, 'bytes': len(response.content), 'contentType': response.headers.get('Content-Type')}
        if response.status_code != 200:
            return record
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            with destination.open('xb') as output:
                output.write(response.content)
        except FileExistsError:
            record['status'] = 'skipped-existing'
        return record
    except Exception as error:
        return {'path': path, 'status': 'error', 'error': str(error)}

with ThreadPoolExecutor(max_workers=4) as pool:
    jobs = [pool.submit(download, path) for path in pending]
    for job in as_completed(jobs):
        record = job.result()
        results.append(record)
        if record['status'] not in (200, 'skipped-existing'):
            print('FAIL', json.dumps(record), flush=True)
        if len(results) % 50 == 0 or len(results) == len(pending):
            print(f"Progress {len(results)}/{len(pending)}, bytes {sum(item.get('bytes', 0) for item in results if item['status'] == 200):,}, elapsed {time.monotonic() - started:.0f}s", flush=True)
            (ROOT / 'audit/download-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')

(ROOT / 'audit/download-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps({'downloaded': sum(item['status'] == 200 for item in results), 'failed': sum(item['status'] not in (200, 'skipped-existing') for item in results), 'bytes': sum(item.get('bytes', 0) for item in results if item['status'] == 200), 'seconds': round(time.monotonic() - started, 1)}), flush=True)
