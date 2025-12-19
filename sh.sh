#!/usr/bin/env bash
set -euo pipefail

FILE="src/app/features/history/history.component.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  echo "➡️ Lance ce script depuis la racine du projet Angular."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

path = Path("src/app/features/history/history.component.ts")
s = path.read_text(encoding="utf-8")
orig = s

# 1) Corriger les mauvais noms de signaux dans le constructor effect()
# (ton projet utilise: searchQuery, startDate, endDate, statusFilter) :contentReference[oaicite:1]{index=1}
s = s.replace("this.searchText();", "this.searchQuery();")
s = s.replace("this.dateFrom();", "this.startDate();")
s = s.replace("this.dateTo();", "this.endDate();")

# 2) Corriger le binding ngModel sur pageSize (signal)
# Remplacer [(ngModel)]="pageSize" par [ngModel]="pageSize()" + (ngModelChange)="pageSize.set($event); page.set(1)"
s = re.sub(
    r'\[\(ngModel\)\]\s*=\s*"pageSize"\s*\n\s*\(ngModelChange\)\s*=\s*"page\.set\(1\)"',
    r'[ngModel]="pageSize()"\n                    (ngModelChange)="pageSize.set($event); page.set(1)"',
    s
)

# Variante si le template n'avait pas (ngModelChange)="page.set(1)" juste après
s = re.sub(
    r'\[\(ngModel\)\]\s*=\s*"pageSize"',
    r'[ngModel]="pageSize()" (ngModelChange)="pageSize.set($event); page.set(1)"',
    s
)

if s == orig:
    print("ℹ️ Aucun changement appliqué (peut-être déjà corrigé).")
else:
    path.write_text(s, encoding="utf-8")
    print("✅ Correctifs appliqués sur", path)
PY

echo "✅ Done. Relance: ng serve (ou redémarre le build)."
