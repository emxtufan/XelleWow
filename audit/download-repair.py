from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from curl_cffi import requests
import json
import struct

root = Path('F:/Cartier/public')
paths = [p for p in root.rglob('*') if p.is_file() and p.suffix in {'.glb', '.exr', '.wasm'}]
def repair(path):
    relative = path.relative_to(root).as_posix()
    response = requests.get('https://websitefactory.cartier.com/akamai-storage/videos/ww26/' + relative, impersonate='chrome', headers={'Referer': 'https://www.cartier.com/'}, timeout=120)
    response.raise_for_status()
    data = response.content
    if path.suffix == '.glb':
        assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 8)[0] == len(data)
    elif path.suffix == '.exr':
        assert data[:4] == b'\x76\x2f\x31\x01'
    elif path.suffix == '.wasm':
        assert data[:4] == b'\x00asm'
    temporary = path.with_suffix(path.suffix + '.download')
    temporary.write_bytes(data)
    temporary.replace(path)
    return {'path': relative, 'status': 200, 'bytes': len(data)}
records = []
with ThreadPoolExecutor(max_workers=4) as pool:
    for job in as_completed([pool.submit(repair, path) for path in paths]):
        record = job.result()
        records.append(record)
        print(json.dumps(record), flush=True)
Path('F:/Cartier/audit/download-repair-report.json').write_text(json.dumps(records, indent=2))
