"""Create deterministic delivery variants; keep original approved artwork intact."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
products = root / 'artifacts/varsa-shop/public/products'
widths = (160, 320, 640, 960, 1254)
records = []
for source_file in sorted(products.glob('*.png')):
    stem = source_file.stem
    source = products / f'{stem}.png'
    original = source.read_bytes()
    with Image.open(source) as image:
        if image.size not in ((1254, 1254), (1263, 1245)):
            raise ValueError(f'Review changed artwork dimensions: {stem}')
        variants = []
        for width in widths:
            height = round(width * image.height / image.width)
            target = products / f'{stem}-{width}.webp'
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            resized.save(target, 'WEBP', quality=90, method=6)
            with Image.open(target) as check:
                check.load()
                assert check.size == (width, height)
            variants.append({'width': width, 'height': height, 'file': target.name, 'bytes': target.stat().st_size})
    assert source.read_bytes() == original
    records.append({'source':source.name, 'bytes':len(original), 'sha256':hashlib.sha256(original).hexdigest(), 'variants':variants})
report = root / 'docs/brand-image-sizes.json'
report.write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records, indent=2))
