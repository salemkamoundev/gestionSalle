#!/usr/bin/env bash
set -euo pipefail

echo "✅ Patch: afficher l'email du Personnel de Salle dans le formulaire réservation (sans régressions)"

FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

# Backup
BK="${FILE}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$FILE" "$BK"
echo "🗂️  Backup: $BK"

python3 - <<'PY'
from pathlib import Path
import re, sys

path = Path("src/app/features/calendar/reservation-form/reservation-form.component.html")
s = path.read_text(encoding="utf-8")

# Si déjà patché (email déjà affiché dans la section staff), on ne touche à rien
if "{{ staff.email }}" in s and "toggleStaff(staff.id" in s:
    print("ℹ️  Déjà OK: l'email du staff est déjà affiché.")
    sys.exit(0)

# Stratégie "sans régression":
# - on repère le bloc de sélection staff (clic -> toggleStaff(staff.id!))
# - on remplace UNIQUEMENT le premier affichage de {{ staff.nom }} qui suit ce toggle
toggle_pos = s.find("toggleStaff(staff.id")
if toggle_pos == -1:
    print("❌ Pattern toggleStaff(staff.id...) introuvable. Patch non appliqué.")
    sys.exit(1)

name_pat = re.compile(r"\{\{\s*staff\.nom\s*\}\}")
m = name_pat.search(s, toggle_pos)
if not m:
    print("❌ {{ staff.nom }} introuvable après toggleStaff. Patch non appliqué.")
    sys.exit(1)

replacement = """<div class="w-full flex flex-col gap-0.5">
                <span>{{ staff.nom }}</span>
                @if (staff.email) {
                  <span class="text-[9px] font-semibold text-slate-500 truncate">{{ staff.email }}</span>
                }
              </div>"""

s2 = s[:m.start()] + replacement + s[m.end():]

path.write_text(s2, encoding="utf-8")
print("✅ Patch appliqué: affichage email ajouté sous le nom (Personnel de Salle).")
PY

echo "✅ Terminé. Rafraîchis la page:"
echo "   http://localhost:4200/reservations/new?date=2025-12-02&slotId=aprem"
