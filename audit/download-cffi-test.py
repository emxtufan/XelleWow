from curl_cffi import requests
from pathlib import Path

root = Path('F:/Cartier/audit')
for filename, url in [
    ('download-cffi-test.css', 'https://websitefactory.cartier.com/akamai-storage/videos/ww26/assets/app.css'),
    ('download-cffi-preview.mp4', 'https://websitefactory.cartier.com/akamai-storage/videos/ww26//videos/movie/movie_preview.mp4'),
]:
    response = requests.get(url, impersonate='chrome', headers={'Referer': 'https://www.cartier.com/'}, timeout=45)
    print(filename, response.status_code, len(response.content), response.headers.get('Content-Type'), flush=True)
    (root / filename).write_bytes(response.content)
