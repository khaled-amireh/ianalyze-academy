"""Download only the selected freely licensed fonts and their license notices."""
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[1] / 'design-preview' / 'assets' / 'fonts'
items = {
    'Inter.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf',
    'Cairo.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt,wght%5D.ttf',
    'Inter-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt',
    'Cairo-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/OFL.txt',
}
for name, url in items.items():
    result = requests.get(url, timeout=30)
    result.raise_for_status()
    (root / name).write_bytes(result.content)
    print(f'{name}: {len(result.content)} bytes')
