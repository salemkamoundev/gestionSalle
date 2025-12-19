#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

if [[ ! -f "$TS_FILE" ]]; then
  echo "❌ Fichier introuvable: $TS_FILE"
  exit 1
fi

if [[ ! -f "$HTML_FILE" ]]; then
  echo "❌ Fichier introuvable: $HTML_FILE"
  exit 1
fi

echo "✅ Projet détecté."
echo "➡️  Patch: bouton Règlement + ouverture modal paiements (prérempli)"

python3 - <<'PY'
import re
from pathlib import Path

ts_path = Path("src/app/features/calendar/reservation-form/reservation-form.component.ts")
html_path = Path("src/app/features/calendar/reservation-form/reservation-form.component.html")

ts = ts_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

# --------------------------
# 1) TS: import PaymentModalComponent
# --------------------------
if "PaymentModalComponent" not in ts:
    # insérer un import "propre" près des imports existants
    # (on évite de dépendre des chemins bizarres ./././ en utilisant un chemin standard)
    import_line = "import { PaymentModalComponent } from '../../payments/payment-modal/payment-modal.component';\n"
    # après le dernier import ...; avant @Component
    m = re.search(r"(\n@I?Component\s*\()", ts)
    if not m:
        raise SystemExit("❌ Impossible de trouver @Component() dans le TS.")
    insert_at = m.start()
    ts = ts[:insert_at] + import_line + ts[insert_at:]

# --------------------------
# 2) TS: ajouter PaymentModalComponent dans imports: [...]
# --------------------------
# Cherche imports: [CommonModule, ReactiveFormsModule] (ou variante) et ajoute PaymentModalComponent si absent
def add_to_component_imports(ts: str) -> str:
    # cible: imports: [ ... ]
    pattern = r"(imports\s*:\s*\[)([^\]]*)(\])"
    m = re.search(pattern, ts)
    if not m:
        raise SystemExit("❌ Impossible de trouver 'imports: [...]' dans @Component.")
    before, inside, after = m.group(1), m.group(2), m.group(3)
    if "PaymentModalComponent" in inside:
        return ts
    inside_new = inside.rstrip()
    # s'assurer qu'il y a une virgule si nécessaire
    if inside_new.strip() and not inside_new.strip().endswith(","):
        inside_new += ","
    inside_new += " PaymentModalComponent"
    return ts[:m.start()] + before + inside_new + after + ts[m.end():]

ts = add_to_component_imports(ts)

# --------------------------
# 3) TS: ajouter state + méthodes (showPaymentModal, currentReservation, open/close)
# --------------------------
if "showPaymentModal" not in ts:
    # ancrage: après staffSearch = signal('');
    anchor = re.search(r"staffSearch\s*=\s*signal\(\s*['\"]\s*['\"]\s*\)\s*;\s*", ts)
    if not anchor:
        # fallback: après clientSearch si besoin
        anchor = re.search(r"clientSearch\s*=\s*signal\(\s*['\"]\s*['\"]\s*\)\s*;\s*", ts)
    if not anchor:
        raise SystemExit("❌ Impossible de trouver un point d'ancrage (staffSearch/clientSearch) pour injecter le code.")

    inject = """
  // --- MODAL RÈGLEMENT (paiements) ---
  showPaymentModal = signal(false);

  // On reconstruit une Reservation "courante" à partir du form + id (pour préremplir le modal)
  currentReservation = computed(() => {
    if (!this.isEditMode() || !this.reservationId) return null;
    const v: any = this.form.value || {};
    return {
      id: this.reservationId,
      clientId: v.clientId,
      clientName: v.clientName,
      date: v.date,
      startTime: v.startTime,
      endTime: v.endTime,
      assignedTeamIds: v.assignedTeamIds || [],
      assignedServerIds: v.assignedServerIds || [],
      selectedSlotId: v.selectedSlotId,
      notes: v.notes || '',
      status: v.status || 'CONFIRMED',
      totalPrice: Number(v.totalPrice) || 0,
      advance: Number(v.advance) || 0,
      createdAt: v.createdAt
    };
  });

  openPaymentModal() {
    if (!this.isEditMode() || !this.reservationId) return;
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);

    // Rafraîchir l'avance après ajout/modif règlement (PaymentService met à jour reservation.advance)
    if (this.reservationId) {
      this.reservationService.getById(this.reservationId).subscribe(res => {
        if (res) {
          this.form.patchValue({ advance: (res as any).advance ?? 0 });
        }
      });
    }
  }
"""
    ts = ts[:anchor.end()] + inject + ts[anchor.end():]

# --------------------------
# 4) HTML: ajouter le bouton "Règlement" dans le header (uniquement en edit)
# --------------------------
if "openPaymentModal()" not in html:
    # On cherche le bouton "Imprimer Contrat" (dans @if isEditMode) puis on injecte notre bouton juste après.
    # On s'accroche au texte "Imprimer Contrat" pour être robuste.
    m = re.search(r"(<button[^>]*\(\s*click\s*\)\s*=\s*\"onPrint\(\)\"[\s\S]*?Imprimer\s+Contrat[\s\S]*?</button>)", html, re.IGNORECASE)
    if not m:
        raise SystemExit("❌ Impossible de trouver le bouton 'Imprimer Contrat' pour insérer 'Règlement'.")

    reg_btn = """
        <button type="button" (click)="openPaymentModal()"
          class="flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-md bg-emerald-600 text-white hover:bg-emerald-700 transition">
          <span class="material-icons text-sm">payments</span>
          Règlement
        </button>
"""
    html = html[:m.end()] + reg_btn + html[m.end():]

# --------------------------
# 5) HTML: afficher le modal (en bas de page)
# --------------------------
if "<app-payment-modal" not in html:
    modal_block = """

@if (showPaymentModal()) {
  <app-payment-modal
    [reservation]="currentReservation()"
    (onClose)="closePaymentModal()">
  </app-payment-modal>
}
"""
    html = html.rstrip() + "\n" + modal_block + "\n"

# --------------------------
# 6) Backup + write
# --------------------------
ts_path.write_text(ts, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo "✅ Patch appliqué:"
echo " - $TS_FILE"
echo " - $HTML_FILE"
echo ""
echo "➡️  Lancer:"
echo "   npm run build"
echo "   # ou"
echo "   ng serve"
