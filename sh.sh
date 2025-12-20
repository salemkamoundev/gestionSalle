#!/usr/bin/env bash
set -euo pipefail

FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

[ -f "angular.json" ] || { echo "❌ angular.json introuvable"; exit 1; }
[ -f "$FILE" ] || { echo "❌ Fichier introuvable: $FILE"; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak.$TS"
echo "✅ Backup créé: $FILE.bak.$TS"

python3 - "$FILE" <<'PY'
import sys, re
from pathlib import Path

path = Path(sys.argv[1])
html = path.read_text(encoding="utf-8")

# On cible UNIQUEMENT la modale Nouveau Client
# Objectif :
# - max-h-[90vh]
# - overflow-hidden sur le container
# - overflow-y-auto sur le contenu
# - header reste visible

pattern = re.compile(
    r'(<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 animate-fade-in">)([\s\S]*?)(</div>\s*</div>\s*</div>)',
    re.M
)

def patch(match: re.Match) -> str:
    container, body, closing = match.groups()

    if "max-h-[90vh]" in container:
        return match.group(0)  # déjà patché

    # 1) rendre le container scroll-safe
    container = container.replace(
        "animate-fade-in",
        "animate-fade-in max-h-[90vh] flex flex-col overflow-hidden"
    )

    # 2) rendre le contenu scrollable (pas le header)
    body = body.replace(
        '<div class="p-5">',
        '<div class="p-5 overflow-y-auto flex-1">'
    )

    return container + body + closing

new_html, n = pattern.subn(patch, html, count=1)

if n == 0:
    print("❌ Modale Nouveau Client introuvable (structure différente)")
    sys.exit(1)

path.write_text(new_html, encoding="utf-8")
print("PATCHED:", path)
PY

echo "✅ Modale Nouveau Client rendue scrollable (mobile-safe)"
echo "➡️  Relance: ng serve / ng build"
