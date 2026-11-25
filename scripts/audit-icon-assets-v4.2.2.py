#!/usr/bin/env python3
"""Qoomia V4.2.2: audit the allow-listed local category and brand assets."""
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
if remote_entries:failures.append(f'URL runtime non ammessi: {remote_entries}')
if approved_remote:failures.append(f'Allow-list runtime deve essere vuota: {approved_remote}')
if PROVENANCE.get('runtimeExternalIconCalls'):failures.append('runtimeExternalIconCalls deve essere false')
if set(PROVENANCE.get('qoomiaLocalCategoryAssets',[]))!={'barber','education','entertainment'}:
    failures.append('Manifest asset locali speciali incompleto')

paths=list((ROOT/'public/icons/categories').glob('*.png'))+list((ROOT/'public/icons/brands').glob('*.png'))
rendered=0
for path in paths:
    try:
        with Image.open(BytesIO(path.read_bytes())) as image:
            image.load()
            if image.size!=(96,96):raise ValueError(f'dimensioni {image.size}, attese 96x96')
            if image.convert('RGBA').getchannel('A').getbbox() is None:raise ValueError('render trasparente')
        rendered+=1
    except Exception as error:failures.append(f'{path.relative_to(ROOT)}: {error}')

fallback=(ROOT/'components/CategoryColorIcon.tsx').read_text()
for token in ['TagIcon','onError','@phosphor-icons/react/ssr']:
    if token not in fallback:failures.append(f'Fallback Phosphor incompleto: {token}')
if 'if(!ready||!src)return <TagIcon' not in fallback:failures.append('Render esclusivo asset oppure fallback non verificato')

if failures:
    print('ICON ASSET AUDIT FAILED');print('\n'.join(f'- {item}' for item in failures));sys.exit(1)
print(f'ICON ASSET AUDIT PASS: {len(local_ids)} categorie locali + {len(brand_files)} brand; {rendered}/{len(paths)} asset locali 96x96 decodificati; nessuna dipendenza CDN; fallback Phosphor Tag verificato')