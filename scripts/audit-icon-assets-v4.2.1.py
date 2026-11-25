#!/usr/bin/env python3
"""Qoomia V4.2.1: audit the allow-listed Icons8 category and brand assets."""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import json,re,sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
CATALOG=(ROOT/'lib/category-icon-catalog.ts').read_text()
PROVENANCE=json.loads((ROOT/'public/icons/icon-provenance.json').read_text())
failures:list[str]=[]

local_ids=sorted(re.findall(r"\bicon\('([^']+)'",CATALOG))
remote_entries=dict(re.findall(r"\bicons8\('([^']+)'[^\n]+?'(https://[^']+)'",CATALOG))
brand_entries=dict(re.findall(r"\bbrand\('([^']+)'\s*,\s*'[^']+'\s*,\s*'([^']+)'",CATALOG))
local_files=sorted(path.stem for path in (ROOT/'public/icons/categories').glob('*.png'))
brand_files=sorted(path.stem for path in (ROOT/'public/icons/brands').glob('*.png'))
approved_remote=PROVENANCE.get('approvedRuntimeAssets',{})

if local_ids!=local_files:failures.append(f'Catalogo categorie locali non conforme: {local_ids} != {local_files}')
if sorted(brand_entries.values())!=brand_files:failures.append('Catalogo brand e file locali non coincidono')
if remote_entries!=approved_remote:failures.append(f'Asset runtime non conformi al manifest: {remote_entries} != {approved_remote}')
if bool(remote_entries)!=bool(PROVENANCE.get('runtimeExternalIconCalls')):failures.append('Flag runtimeExternalIconCalls incoerente')
for icon_id,url in remote_entries.items():
    if not re.fullmatch(r'https://img\.icons8\.com/[a-z0-9-]+/96/[a-z0-9-]+\.png',url):failures.append(f'URL Icons8 non approvato per {icon_id}: {url}')

paths=list((ROOT/'public/icons/categories').glob('*.png'))+list((ROOT/'public/icons/brands').glob('*.png'))
rendered=0
for path in paths:
    try:
        with Image.open(BytesIO(path.read_bytes())) as image:
            image.load()
            if image.width<1 or image.height<1:raise ValueError('dimensioni non valide')
            if image.convert('RGBA').getchannel('A').getbbox() is None:raise ValueError('render trasparente')
        rendered+=1
    except Exception as error:failures.append(f'{path.relative_to(ROOT)}: {error}')

fallback=(ROOT/'components/CategoryColorIcon.tsx').read_text()
for token in ['TagIcon','onError','@phosphor-icons/react/ssr']:
    if token not in fallback:failures.append(f'Fallback Phosphor incompleto: {token}')
if 'if(!ready||!src)return <TagIcon' not in fallback:failures.append('Render esclusivo asset oppure fallback non verificato')

if failures:
    print('ICON PROVENANCE AUDIT FAILED');print('\n'.join(f'- {item}' for item in failures));sys.exit(1)
print(f'ICON PROVENANCE AUDIT PASS: {len(local_ids)} categorie locali + {len(remote_entries)} categorie Icons8 CDN + {len(brand_files)} brand; {rendered}/{len(paths)} asset locali decodificati; fallback Phosphor Tag verificato')
