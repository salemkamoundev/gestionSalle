#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

TS_FILE="$ROOT/src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="$ROOT/src/app/features/calendar/reservation-form/reservation-form.component.html"

die() { echo "❌ $*" >&2; exit 1; }
ok() { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }

[[ -f "$TS_FILE" ]] || die "Fichier introuvable: $TS_FILE"
[[ -f "$HTML_FILE" ]] || die "Fichier introuvable: $HTML_FILE"

python3 - <<'PY'
import re, sys, pathlib

root = pathlib.Path(".")
ts_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
html_path = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
PY
python3 - "$TS_FILE" "$HTML_FILE" <<'PY'
import re, sys, pathlib

ts_file = pathlib.Path(sys.argv[1])
html_file = pathlib.Path(sys.argv[2])

ts = ts_file.read_text(encoding="utf-8")
html = html_file.read_text(encoding="utf-8")

# -----------------------------
# 1) Patch TS: import + standalone imports + state + handlers
# -----------------------------

# 1.a Add import ClientFormComponent if missing
if "ClientFormComponent" not in ts:
    # Insert after PaymentModalComponent import (exists in your file)
    # or after last import line as fallback.
    m = re.search(r"import\s+\{\s*PaymentModalComponent\s*\}\s+from\s+['\"][^'\"]+['\"];[ \t]*\r?\n", ts)
    if m:
        insert_at = m.end()
        ts = ts[:insert_at] + "import { ClientFormComponent } from '../../clients/client-form/client-form.component';\n" + ts[insert_at:]
    else:
        # fallback: add after last import
        m2 = list(re.finditer(r"^import .+?;\s*$", ts, flags=re.M))
        if not m2:
            raise SystemExit("TS: Impossible de trouver les imports pour insérer ClientFormComponent.")
        insert_at = m2[-1].end()
        ts = ts[:insert_at] + "\nimport { ClientFormComponent } from '../../clients/client-form/client-form.component';" + ts[insert_at:]

# 1.b Ensure standalone imports include ClientFormComponent (and keep existing)
# Current: imports: [CommonModule, ReactiveFormsModule],
def ensure_in_component_imports(ts: str) -> str:
    # Find @Component({ ... imports: [ ... ] ... })
    pat = r"@Component\(\{\s*([\s\S]*?)\}\)\s*export\s+class\s+ReservationFormComponent"
    m = re.search(pat, ts)
    if not m:
        raise SystemExit("TS: @Component(...) introuvable (ReservationFormComponent).")

    block = m.group(1)

    # Find imports: [ ... ]
    im = re.search(r"imports\s*:\s*\[([\s\S]*?)\]\s*,", block)
    if not im:
        raise SystemExit("TS: 'imports: [ ... ]' introuvable dans @Component.")

    inside = im.group(1)

    # Normalize list to check membership
    tokens = [t.strip() for t in inside.split(",") if t.strip()]
    need = ["ClientFormComponent"]
    for n in need:
        if n not in tokens:
            tokens.append(n)

    new_inside = ", ".join(tokens)
    new_block = block[:im.start(1)] + new_inside + block[im.end(1):]
    return ts[:m.start(1)] + new_block + ts[m.end(1):]

ts = ensure_in_component_imports(ts)

# 1.c Add modal state + handlers (idempotent)
if "showClientModal" not in ts:
    # Insert after showPaymentModal = signal(false);
    anchor = r"showPaymentModal\s*=\s*signal\(false\);\s*\r?\n"
    m = re.search(anchor, ts)
    if not m:
        raise SystemExit("TS: anchor showPaymentModal introuvable.")
    insert = (
        "\n  // --- MODAL AJOUT CLIENT (depuis la réservation) ---\n"
        "  showClientModal = signal(false);\n"
        "  openClientModal() { this.showClientModal.set(true); }\n"
        "  closeClientModal() { this.showClientModal.set(false); }\n"
        "\n"
        "  onClientModalFinish(created: any) {\n"
        "    this.showClientModal.set(false);\n"
        "    if (!created) return; // annulé\n"
        "\n"
        "    // Sélection immédiate du client créé (sans attendre le refresh Firestore)\n"
        "    const id = created.id;\n"
        "    const nom = (created.nom || '').toString().trim();\n"
        "    const prenom = (created.prenom || '').toString().trim();\n"
        "    const fullName = (nom + ' ' + prenom).trim();\n"
        "\n"
        "    if (id) {\n"
        "      this.form.patchValue({ clientId: id, clientName: fullName });\n"
        "      this.clientSearch.set(fullName);\n"
        "    }\n"
        "  }\n"
    )
    ts = ts[:m.end()] + insert + ts[m.end():]

# -----------------------------
# 2) Patch HTML: Add button + modal overlay using ClientFormComponent
# -----------------------------

# 2.a Add "Nouveau client" button in the client search panel header
# We target the block:
# <div class="p-4 bg-slate-50 ...">
#   <label ...>Rechercher le Client</label>
# We'll wrap label line into a flex row with the button.
if "openClientModal()" not in html:
    # Replace only the first occurrence in that panel.
    pattern = r'(<div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">\s*)\r?\n\s*(<label class="block text-\[10px\] font-black text-blue-600 uppercase mb-2">Rechercher le Client</label>)'
    m = re.search(pattern, html)
    if not m:
        raise SystemExit("HTML: bloc 'Rechercher le Client' introuvable pour insérer le bouton.")
    replacement = (
        m.group(1) + "\n"
        '          <div class="flex items-center justify-between gap-3 mb-2">\n'
        '            <label class="block text-[10px] font-black text-blue-600 uppercase">Rechercher le Client</label>\n'
        '            <button type="button"\n'
        '              (click)="openClientModal()"\n'
        '              class="text-[10px] font-black px-2 py-1 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 transition flex items-center gap-1">\n'
        '              <span class="material-icons text-[14px]">person_add</span>\n'
        '              Nouveau\n'
        '            </button>\n'
        '          </div>'
    )
    html = html[:m.start()] + replacement + html[m.end():]

# 2.b Add modal overlay at end of template (before final closing </div> of root)
if "<app-client-form" not in html:
    # Insert before the last closing root </div> (safe: file ends with </div>)
    # We'll append an @if block at the very end.
    modal_block = r"""
@if (showClientModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" (click)="closeClientModal()"></div>

    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 animate-fade-in">
      <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="material-icons text-blue-600">person_add</span>
          <h3 class="font-black text-slate-800">Nouveau client</h3>
        </div>
        <button type="button" (click)="closeClientModal()" class="text-slate-400 hover:text-slate-600 p-1">
          <span class="material-icons">close</span>
        </button>
      </div>

      <div class="p-5">
        <app-client-form [isModal]="true" (finish)="onClientModalFinish($event)"></app-client-form>
      </div>
    </div>
  </div>
}
""".lstrip("\n")

    # Insert before the last </div> in file
    last_div = html.rfind("</div>")
    if last_div == -1:
        raise SystemExit("HTML: impossible de trouver </div> final.")
    html = html[:last_div] + "\n\n" + modal_block + "\n" + html[last_div:]

# Write back
ts_file.write_text(ts, encoding="utf-8")
html_file.write_text(html, encoding="utf-8")
PY

echo "✅ Patch appliqué:"
echo "   - $TS_FILE"
echo "   - $HTML_FILE"
echo
echo "➡️  Ensuite: ng serve / ng build pour vérifier."
