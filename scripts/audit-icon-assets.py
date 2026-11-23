#!/usr/bin/env python3
"""Audit the local Qoomia Icons8 PNG catalog used by V4.1.6."""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import json
import re
import sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
CATALOG=(ROOT/'lib/category-icon-catalog.ts').read_text(encoding='utf-8')
PROVENANCE=json.loads((ROOT/'public/icons/icon-provenance.json').read_text(encoding='utf-8'))
failures:list[str]=[]

category_ids=re.findall(r"^\s*icon\('([^']+)'",CATALOG,re.M)
brand_files=re.findall(r"^\s*brand\('[^']+','[^']+','([^']+)'",CATALOG,re.M)
category_expected=sorted(f'{item}.png' for item in category_ids)
brand_expected=sorted(f'{item}.png' for item in brand_files)
category_actual=sorted(path.name for path in (ROOT/'public/icons/categories').glob('*.png'))
brand_actual=sorted(path.name for path in (ROOT/'public/icons/brands').glob('*.png'))

if category_actual!=category_expected:
    failures.append(f'Catalogo categorie e asset non coincidono: {category_actual} != {category_expected}')
if brand_actual!=brand_expected:
    failures.append(f'Catalogo brand e asset non coincidono: {brand_actual} != {brand_expected}')
if PROVENANCE.get('runtimeExternalIconCalls') is not False:
    failures.append('Il manifest deve vietare chiamate runtime a servizi icone esterni.')

paths=[ROOT/'public/icons/categories'/name for name in category_expected]
paths += [ROOT/'public/icons/brands'/name for name in brand_expected]
rendered=0
for path in paths:
    if not path.is_file():
        failures.append(f'Asset mancante: {path.relative_to(ROOT)}')
        continue
    try:
        with Image.open(BytesIO(path.read_bytes())) as image:
            image.load()
            if image.width<1 or image.height<1:
                raise ValueError('dimensioni non valide')
            if image.convert('RGBA').getchannel('A').getbbox() is None:
                raise ValueError('immagine completamente trasparente')
        rendered+=1
    except Exception as error:
        failures.append(f'{path.relative_to(ROOT)}: {error}')

runtime_files=[
    'lib/category-icon-catalog.ts','lib/category-icon-assets.ts','lib/category-style.ts',
    'components/CategoryColorIcon.tsx','components/IconCatalogPicker.tsx','components/CategoryIcon.tsx',
]
for name in runtime_files:
    text=(ROOT/name).read_text(encoding='utf-8')
    if re.search(r'https?://(?:img\.)?icons8\.',text,re.I):
        failures.append(f'Chiamata Icons8 runtime rilevata: {name}')

fallback=(ROOT/'components/CategoryColorIcon.tsx').read_text(encoding='utf-8')
for token in ['TagIcon','onError','setFailedSrc','@phosphor-icons/react/ssr']:
    if token not in fallback:
        failures.append(f'Fallback Phosphor incompleto: {token}')

if failures:
    print('ICON ASSET AUDIT FAILED')
    print('\n'.join(f'- {item}' for item in failures))
    sys.exit(1)
print(f'ICON ASSET AUDIT PASS: {len(category_expected)} categorie + {len(brand_expected)} brand; {rendered}/{len(paths)} PNG locali decodificati')
