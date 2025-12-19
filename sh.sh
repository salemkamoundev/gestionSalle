#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "Erreur: python3 est requis."
  exit 1
fi

ROOT="$(pwd)"
if [ ! -f "$ROOT/package.json" ] && [ ! -f "$ROOT/angular.json" ]; then
  echo "Erreur: lance ce script à la racine du projet."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"

# chemins attendus (fallback via find si besoin)
CLIENTS="$ROOT/src/app/features/clients/client-list/client-list.component.ts"
STAFF="$ROOT/src/app/features/staff/staff-list/staff-list.component.ts"
TEAMS="$ROOT/src/app/features/teams/team-list/team-list.component.ts"
PAY="$ROOT/src/app/features/payments/payment-list/payment-list.component.ts"

find_one() { find "$ROOT" -path "$1" -print -quit 2>/dev/null || true; }

[ -f "$CLIENTS" ] || CLIENTS="$(find_one "*/src/app/features/clients/client-list/client-list.component.ts")"
[ -f "$STAFF" ]   || STAFF="$(find_one "*/src/app/features/staff/staff-list/staff-list.component.ts")"
[ -f "$TEAMS" ]   || TEAMS="$(find_one "*/src/app/features/teams/team-list/team-list.component.ts")"
[ -f "$PAY" ]     || PAY="$(find_one "*/src/app/features/payments/payment-list/payment-list.component.ts")"

for f in "$CLIENTS" "$STAFF" "$TEAMS" "$PAY"; do
  if [ -z "${f:-}" ] || [ ! -f "$f" ]; then
    echo "Erreur: fichier introuvable: $f"
    exit 1
  fi
done

for f in "$CLIENTS" "$STAFF" "$TEAMS" "$PAY"; do
  cp -f "$f" "$f.bak.$STAMP"
done

python3 - "$CLIENTS" "$STAFF" "$TEAMS" "$PAY" <<'PY'
import sys, re
from pathlib import Path

files = [Path(p) for p in sys.argv[1:]]

def patch(content: str) -> str:
  # Corrige UNIQUEMENT les interpolations Angular qui ont été écrites avec un seul { ... }
  # et qui causent NG5002 (ICU).
  #
  # On vise des expressions typiques de la pagination:
  # - page()
  # - totalPages()
  # - this.filteredX().length
  #
  # Important: ne pas toucher aux blocs "@if (...) {" ou "@for (...) {"
  # => on ne remplace que les { ... } qui contiennent une expression et sont entourées d'espaces/texte,
  # et on évite celles précédées par '@if' ou '@for' etc.

  # Remplace: { page() } => {{ page() }}
  content = re.sub(
    r'(?<!\{)\{\s*(page\(\))\s*\}(?!\})',
    r'{{ \1 }}',
    content
  )

  # Remplace: { totalPages() } => {{ totalPages() }}
  content = re.sub(
    r'(?<!\{)\{\s*(totalPages\(\))\s*\}(?!\})',
    r'{{ \1 }}',
    content
  )

  # Remplace: { this.filteredClients().length } => {{ this.filteredClients().length }}
  content = re.sub(
    r'(?<!\{)\{\s*(this\.filtered[A-Za-z0-9_]+\(\)\.length)\s*\}(?!\})',
    r'{{ \1 }}',
    content
  )

  return content

for p in files:
  s0 = p.read_text(encoding="utf-8")
  s = patch(s0)
  if s != s0:
    p.write_text(s, encoding="utf-8")
    print(f"OK: patched -> {p}")
  else:
    print(f"OK: no change -> {p}")
PY

echo "✅ Fix ICU appliqué."
echo "🧷 Backups: *.bak.$STAMP"
echo "👉 Relance: ng serve"
