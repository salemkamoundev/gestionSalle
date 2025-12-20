#!/usr/bin/env bash
set -euo pipefail

HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"
TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "❌ Fichier introuvable: $HTML_FILE"
  exit 1
fi

if [[ ! -f "$TS_FILE" ]]; then
  echo "❌ Fichier introuvable: $TS_FILE"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

html_path = Path("src/app/features/calendar/reservation-form/reservation-form.component.html")
ts_path   = Path("src/app/features/calendar/reservation-form/reservation-form.component.ts")

html = html_path.read_text(encoding="utf-8")
ts   = ts_path.read_text(encoding="utf-8")

# -----------------------------
# 1) Patch TS: imports + inject + method
# -----------------------------
if "onDeleteReservation(" not in ts:
    # Add import AuthService
    if "AuthService" not in ts:
        # Try to insert after UiService import if present, else after other service imports
        needle = "import { UiService } from '../../../core/services/ui.service';"
        ins    = "import { AuthService } from '../../../core/services/auth.service';\n"
        if needle in ts:
            ts = ts.replace(needle, needle + "\n" + ins)
        else:
            # fallback: insert after last import line
            lines = ts.splitlines(True)
            last_import_idx = 0
            for i, line in enumerate(lines):
                if line.startswith("import "):
                    last_import_idx = i
            lines.insert(last_import_idx + 1, ins)
            ts = "".join(lines)

    # Add injection: private auth = inject(AuthService);
    if "inject(AuthService)" not in ts:
        needle = "  private ui = inject(UiService);\n"
        if needle in ts:
            ts = ts.replace(needle, needle + "  private auth = inject(AuthService);\n")
        else:
            # fallback: inject after other inject lines
            needle2 = "  private configService = inject(ConfigService);\n"
            if needle2 in ts:
                ts = ts.replace(needle2, needle2 + "  private auth = inject(AuthService);\n")

    # Add delete method before class end
    method = """
  async onDeleteReservation() {
    if (!this.isEditMode() || !this.reservationId) return;

    // Demande de confirmation
    const confirmed = await this.ui.confirm(
      'Supprimer la réservation',
      'Cette action est irréversible. Continuer ?',
      'Supprimer',
      'Annuler'
    );
    if (!confirmed) return;

    // Exiger admin@gmail.com
    const email = (this.auth.userState()?.email || '').toLowerCase();
    if (email !== 'admin@gmail.com') {
      this.ui.showToast('error', 'Seul admin@gmail.com peut supprimer une réservation.');
      return;
    }

    // Demander mot de passe admin puis re-auth (Firebase)
    const password = window.prompt('Mot de passe admin (admin@gmail.com) :');
    if (!password) return;

    const ok = await this.auth.verifyPassword(password);
    if (!ok) {
      this.ui.showToast('error', 'Mot de passe incorrect.');
      return;
    }

    try {
      await this.reservationService.delete(this.reservationId);
      this.ui.showToast('success', 'Réservation supprimée.');
      this.onClose();
    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur lors de la suppression.');
    }
  }
"""

    # Insert method before last closing brace of class
    idx = ts.rfind("\n}")
    if idx == -1:
        raise SystemExit("❌ Impossible de trouver la fin du fichier TS (\\n})")
    ts = ts[:idx] + method + "\n" + ts[idx:]

else:
    print("ℹ️ TS déjà patché (onDeleteReservation déjà présent), skip.")

# Ensure onDeleteReservation is referenced by template? We'll do in HTML patch.

# -----------------------------
# 2) Patch HTML: add button in edit mode block
# -----------------------------
if "onDeleteReservation()" not in html:
    # We'll insert right after the "Règlement" button (click=openPaymentModal)
    # Find the closing </button> after openPaymentModal section.
    anchor = '(click)="openPaymentModal()"'
    pos = html.find(anchor)
    if pos == -1:
        raise SystemExit("❌ Impossible de trouver le bouton Règlement (openPaymentModal) dans le HTML.")

    # find the end of the button tag after this anchor
    end_btn = html.find("</button>", pos)
    if end_btn == -1:
        raise SystemExit("❌ Impossible de trouver la fin (</button>) du bouton Règlement dans le HTML.")
    end_btn += len("</button>")

    delete_btn = """
        <button type="button" (click)="onDeleteReservation()"
          class="flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-md bg-red-600 text-white hover:bg-red-700 transition">
          <span class="material-icons text-sm">delete</span>
          Supprimer réservation
        </button>
"""

    html = html[:end_btn] + "\n" + delete_btn + html[end_btn:]
else:
    print("ℹ️ HTML déjà patché (onDeleteReservation() déjà présent), skip.")

# Write back
ts_path.write_text(ts, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

print("✅ Patch appliqué avec succès.")
print(f" - {ts_path}")
print(f" - {html_path}")
PY

echo
echo "✅ Terminé."
echo "➡️ Lance ensuite: ng serve (ou ton script habituel) et teste une réservation en mode édition."
