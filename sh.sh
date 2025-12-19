#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 est requis"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"

PAY_MODAL_TS="src/app/features/payments/payment-modal/payment-modal.component.ts"
PAY_LIST_TS="src/app/features/payments/payment-list/payment-list.component.ts"

find_one() { find . -path "$1" -print -quit 2>/dev/null || true; }

[[ -f "$PAY_MODAL_TS" ]] || PAY_MODAL_TS="$(find_one "*/src/app/features/payments/payment-modal/payment-modal.component.ts")"
[[ -f "$PAY_LIST_TS" ]]  || PAY_LIST_TS="$(find_one "*/src/app/features/payments/payment-list/payment-list.component.ts")"

for f in "$PAY_MODAL_TS" "$PAY_LIST_TS"; do
  if [[ -z "${f:-}" || ! -f "$f" ]]; then
    echo "❌ Introuvable: $f"
    exit 1
  fi
done

cp -f "$PAY_MODAL_TS" "$PAY_MODAL_TS.bak.$STAMP"
cp -f "$PAY_LIST_TS" "$PAY_LIST_TS.bak.$STAMP"

python3 - "$PAY_MODAL_TS" "$PAY_LIST_TS" <<'PY'
import sys, re
from pathlib import Path

pay_modal = Path(sys.argv[1])
pay_list = Path(sys.argv[2])

pm0 = pay_modal.read_text(encoding="utf-8", errors="ignore")
pl0 = pay_list.read_text(encoding="utf-8", errors="ignore")

pm = pm0
pl = pl0

# ------------------------------------------------------------
# 1) payment-modal.component.ts : supprimer le bloc ajouté en double
#    (Compat inputs) + les @Input/@Output/EventEmitter ajoutés
# ------------------------------------------------------------

# A) Supprimer bloc "Compat inputs" si présent (et champs associés)
pm = re.sub(
    r"\n\s*//\s*Compat inputs[\s\S]*?@Output\(\)\s*onClose\s*=\s*new\s*EventEmitter<[^>]*>\(\);\s*\n",
    "\n",
    pm,
    count=1
)

# Certaines variantes peuvent avoir EventEmitter sans générique
pm = re.sub(
    r"\n\s*//\s*Compat inputs[\s\S]*?@Output\(\)\s*onClose\s*=\s*new\s*EventEmitter\(\);\s*\n",
    "\n",
    pm,
    count=1
)

# B) Supprimer les lignes exactes si elles traînent sans le commentaire
pm = re.sub(r"^\s*@Input\(\)\s*reservation\s*:\s*any\s*=\s*null;\s*$\n?", "", pm, flags=re.M)
pm = re.sub(r"^\s*@Input\(\)\s*paymentToEdit\s*:\s*any\s*=\s*null;\s*$\n?", "", pm, flags=re.M)
pm = re.sub(r"^\s*@Output\(\)\s*onClose\s*=\s*new\s*EventEmitter<[^>]*>\(\);\s*$\n?", "", pm, flags=re.M)
pm = re.sub(r"^\s*@Output\(\)\s*onClose\s*=\s*new\s*EventEmitter\(\);\s*$\n?", "", pm, flags=re.M)

# C) Nettoyer imports Input/Output/EventEmitter si on les a ajoutés mais qu'ils ne sont plus utilisés
# (On ne touche pas si le fichier en a besoin pour autre chose.)
def strip_unused_core_import(name: str, text: str) -> str:
    # si le symbole n'apparait plus dans le fichier (hors import), on peut l'enlever de l'import { ... } from '@angular/core'
    if re.search(rf"\b{name}\b", text) and not re.search(rf"^import\s+.*\b{name}\b.*from\s+'@angular/core';", text, flags=re.M):
        return text  # symbole utilisé ailleurs (rare), on ne touche pas
    if re.search(rf"\b{name}\b", text) and re.search(rf"@{name}\b", text):
        return text  # utilisé en décorateur
    # si le symbole n'existe plus en dehors des imports:
    if len(re.findall(rf"\b{name}\b", text)) <= len(re.findall(rf"^import\s+.*\b{name}\b.*$", text, flags=re.M)):
        # enlever du import angular/core
        text = re.sub(
            r"import\s+\{\s*([^}]+)\s*\}\s+from\s+'@angular/core';",
            lambda m: "import { " + ", ".join([x.strip() for x in m.group(1).split(",") if x.strip() and x.strip() != name]) + " } from '@angular/core';",
            text,
            count=1
        )
    return text

# On ne supprime que si absent maintenant
pm = strip_unused_core_import("Input", pm)
pm = strip_unused_core_import("Output", pm)
pm = strip_unused_core_import("EventEmitter", pm)

# ------------------------------------------------------------
# 2) payment-list.component.ts : focusedReservation() ne doit jamais renvoyer undefined
# ------------------------------------------------------------

# On force le computed à retourner (find(...) || null)
pl = re.sub(
    r"return\s+id\s*\?\s*this\.reservations\(\)\.find\(r\s*=>\s*r\.id\s*===\s*id\)\s*:\s*null\s*;",
    "return id ? (this.reservations().find(r => r.id === id) || null) : null;",
    pl
)

# Variante sans "this."
pl = re.sub(
    r"return\s+id\s*\?\s*reservations\(\)\.find\(r\s*=>\s*r\.id\s*===\s*id\)\s*:\s*null\s*;",
    "return id ? (reservations().find(r => r.id === id) || null) : null;",
    pl
)

pay_modal.write_text(pm, encoding="utf-8")
pay_list.write_text(pl, encoding="utf-8")

print("OK: payment-modal cleaned duplicates + payment-list focusedReservation type fixed")
PY

echo "✅ Corrigé."
echo "🧷 Backups:"
echo " - $PAY_MODAL_TS.bak.$STAMP"
echo " - $PAY_LIST_TS.bak.$STAMP"
echo "👉 Relance: ng serve"
