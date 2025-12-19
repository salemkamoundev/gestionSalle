#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# Fix "Rechercher le Client" :
# - Recherche sur Nom + Prénom + Téléphone
# - Ajoute un bouton "X" rond pour vider le champ (et désélectionner le client)
# ------------------------------------------------------------

if ! command -v python3 >/dev/null 2>&1; then
  echo "Erreur: python3 est requis pour appliquer le patch."
  echo "Installe python3 puis relance ce script."
  exit 1
fi

ROOT="$(pwd)"

# Si l'utilisateur n'est pas à la racine, on tente de remonter jusqu'à trouver angular.json ou package.json
if [ ! -f "$ROOT/angular.json" ] && [ ! -f "$ROOT/package.json" ]; then
  CUR="$ROOT"
  while [ "$CUR" != "/" ]; do
    if [ -f "$CUR/angular.json" ] || [ -f "$CUR/package.json" ]; then
      ROOT="$CUR"
      break
    fi
    CUR="$(dirname "$CUR")"
  done
fi

TS_FILE="$ROOT/src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="$ROOT/src/app/features/calendar/reservation-form/reservation-form.component.html"

# Fallback si chemins non trouvés
if [ ! -f "$TS_FILE" ]; then
  TS_FILE="$(find "$ROOT" -path "*/src/app/features/calendar/reservation-form/reservation-form.component.ts" -print -quit 2>/dev/null || true)"
fi
if [ ! -f "$HTML_FILE" ]; then
  HTML_FILE="$(find "$ROOT" -path "*/src/app/features/calendar/reservation-form/reservation-form.component.html" -print -quit 2>/dev/null || true)"
fi

if [ -z "${TS_FILE:-}" ] || [ ! -f "$TS_FILE" ]; then
  echo "Erreur: impossible de trouver reservation-form.component.ts"
  exit 1
fi
if [ -z "${HTML_FILE:-}" ] || [ ! -f "$HTML_FILE" ]; then
  echo "Erreur: impossible de trouver reservation-form.component.html"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
cp -f "$TS_FILE"   "$TS_FILE.bak.$STAMP"
cp -f "$HTML_FILE" "$HTML_FILE.bak.$STAMP"

python3 - "$TS_FILE" "$HTML_FILE" <<'PY'
import sys, re
from pathlib import Path

ts_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

ts = ts_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

ts_original = ts
html_original = html

# -----------------------------
# Patch TS: filteredClients + clearClientSearch()
# -----------------------------

# Remplacement du bloc filteredClients (on garde idempotent: si déjà patché, on ne touche pas)
# On cherche l'assignation "filteredClients = computed(() => { ... });"
m = re.search(r'^\s*filteredClients\s*=\s*computed\(\(\)\s*=>\s*\{.*?^\s*\}\);\s*$',
              ts, flags=re.M | re.S)

new_filtered_clients = """  filteredClients = computed(() => {
    const q = (this.clientSearch() || '').toLowerCase().trim();
    if (!q) return this.clients().slice(0, 10);

    // Pour le téléphone: on compare uniquement les chiffres (pratique si l'utilisateur tape avec espaces)
    const qDigits = q.replace(/\\D/g, '');

    return this.clients().filter(c => {
      const full = `${(c.nom || '').toLowerCase()} ${(c.prenom || '').toLowerCase()}`.trim();
      const fullRev = `${(c.prenom || '').toLowerCase()} ${(c.nom || '').toLowerCase()}`.trim();
      const phoneDigits = String(c.telephone || '').replace(/\\D/g, '');

      // Nom / Prénom / Téléphone
      return full.includes(q) || fullRev.includes(q) || (qDigits && phoneDigits.includes(qDigits));
    });
  });"""

if m:
    block = m.group(0)
    # Si déjà patché (présence de fullRev / qDigits / etc.), on skip
    if "fullRev.includes" not in block or "qDigits" not in block:
        ts = ts[:m.start()] + new_filtered_clients + ts[m.end():]
else:
    raise SystemExit("Patch TS: impossible de trouver le bloc 'filteredClients = computed(() => { ... });'")

# Ajout méthode clearClientSearch() après onClientSearch si elle n'existe pas
if "clearClientSearch()" not in ts:
    m2 = re.search(r'^(?P<indent>\s*)onClientSearch\s*\(.*?\)\s*\{[^\n]*\}\s*$',
                   ts, flags=re.M)
    if not m2:
        raise SystemExit("Patch TS: impossible de trouver la méthode onClientSearch(...)")
    indent = m2.group("indent")
    insert = (
        f"\n\n{indent}clearClientSearch() {{\n"
        f"{indent}  this.clientSearch.set('');\n"
        f"{indent}  // On vide aussi la sélection pour forcer un nouveau choix\n"
        f"{indent}  this.form.patchValue({{ clientId: '', clientName: '' }});\n"
        f"{indent}}}\n"
    )
    ts = ts[:m2.end()] + insert + ts[m2.end():]

# -----------------------------
# Patch HTML: bouton X rond + placeholder
# -----------------------------

# Si déjà patché, on ne touche pas
if 'clearClientSearch()' not in html:
    # On remplace la ligne <input ... clientSearch() ...> par un wrapper relative + bouton X
    pattern = re.compile(
        r'^(?P<indent>\s*)<input\s+type="text"\s+\[value\]="clientSearch\(\)"\s+\(input\)="onClientSearch\(\$event\)"\s+placeholder="[^"]*"\s+class="[^"]*">\s*$',
        flags=re.M
    )
    m3 = pattern.search(html)
    if not m3:
        raise SystemExit("Patch HTML: impossible de trouver l'input de recherche client (clientSearch).")

    indent = m3.group("indent")

    # NOTE: dans une f-string, { doit être écrit {{ pour sortir un { littéral
    replacement_lines = [
        f'{indent}<div class="relative mb-3">',
        f'{indent}  <input type="text" [value]="clientSearch()" (input)="onClientSearch($event)" placeholder="Nom, Prénom ou Téléphone..." class="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 outline-none focus:border-blue-400">',
        f'{indent}  @if (clientSearch()) {{',
        f'{indent}    <button type="button" (click)="clearClientSearch()" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center shadow-sm" aria-label="Vider la recherche client">',
        f'{indent}      <span class="material-icons text-[16px]">close</span>',
        f'{indent}    </button>',
        f'{indent}  }}',
        f'{indent}</div>',
    ]
    replacement = "\n".join(replacement_lines)

    html = html[:m3.start()] + replacement + html[m3.end():]

# Écritures seulement si changement
if ts != ts_original:
    ts_path.write_text(ts, encoding="utf-8")
    print(f"OK: patch TS appliqué -> {ts_path}")
else:
    print(f"OK: TS déjà patché -> {ts_path}")

if html != html_original:
    html_path.write_text(html, encoding="utf-8")
    print(f"OK: patch HTML appliqué -> {html_path}")
else:
    print(f"OK: HTML déjà patché -> {html_path}")
PY

echo ""
echo "✅ Patch terminé."
echo "🧷 Backups créés :"
echo " - $TS_FILE.bak.$STAMP"
echo " - $HTML_FILE.bak.$STAMP"
echo ""
echo "Tu peux relancer: ng serve"
