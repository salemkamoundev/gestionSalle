#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Patch "password prompt" -> jolie popup (modal) dans Angular
# - Ajoute UiService.prompt() + promptData
# - Ajoute le rendu de la modale dans UiContainerComponent
# - Remplace window.prompt(...) dans reservation-form.component.ts
# -----------------------------------------------------------------------------

ROOT="${1:-.}"

UI_SERVICE="$ROOT/src/app/core/services/ui.service.ts"
UI_CONTAINER="$ROOT/src/app/shared/components/ui-container.component.ts"
RES_FORM="$ROOT/src/app/features/calendar/reservation-form/reservation-form.component.ts"

echo "==> Vérification des fichiers…"
for f in "$UI_SERVICE" "$UI_CONTAINER" "$RES_FORM"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Fichier introuvable: $f"
    echo "   Astuce: lance le script depuis la racine du projet, ou passe la racine en argument:"
    echo "   ./patch-popup-delete.sh /chemin/vers/projet"
    exit 1
  fi
done

echo "==> Backup des fichiers…"
cp -n "$UI_SERVICE"   "$UI_SERVICE.bak"   || true
cp -n "$UI_CONTAINER" "$UI_CONTAINER.bak" || true
cp -n "$RES_FORM"     "$RES_FORM.bak"     || true

python3 - <<'PY'
import re
from pathlib import Path

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

def write(p: Path, s: str):
    p.write_text(s, encoding="utf-8")

def ensure_once(haystack: str, needle: str, err: str):
    if needle not in haystack:
        raise SystemExit(err)

root = Path(".").resolve()

ui_service = Path("src/app/core/services/ui.service.ts")
ui_container = Path("src/app/shared/components/ui-container.component.ts")
res_form = Path("src/app/features/calendar/reservation-form/reservation-form.component.ts")

s_ui = read(ui_service)
s_cont = read(ui_container)
s_res = read(res_form)

# --------------------------------------------------------------------
# 1) UiService: ajouter PromptData + promptData + prompt()
# --------------------------------------------------------------------
# Sanity check: confirmData existe
ensure_once(s_ui, "confirmData = signal<ConfirmData | null>(null);",
            "UiService: confirmData introuvable, structure inattendue.")

# Si déjà patché, on skip proprement
already = ("export interface PromptData" in s_ui) or ("promptData = signal<PromptData | null>(null);" in s_ui)
if not already:
    # Injecter l'interface PromptData juste après ConfirmData
    s_ui = re.sub(
        r"(export interface ConfirmData\s*\{[\s\S]*?\}\s*)",
        r"""\1

export interface PromptData {
  title: string;
  message: string;
  placeholder?: string;
  type?: 'text' | 'password';
  confirmLabel: string;
  cancelLabel: string;

  // Gestion de la valeur sans FormsModule (via closures)
  setValue: (val: string) => void;
  getValue: () => string;

  resolve: (val: string | null) => void;
}
""",
        s_ui,
        count=1
    )

    # Ajouter promptData signal après confirmData signal
    s_ui = s_ui.replace(
        "confirmData = signal<ConfirmData | null>(null);\n",
        "confirmData = signal<ConfirmData | null>(null);\n\n  // Gestion de la Modale de Saisie (Prompt)\n  promptData = signal<PromptData | null>(null);\n"
    )

    # Ajouter méthode prompt() avant confirm()
    # On insère avant le commentaire "Remplace window.confirm()"
    prompt_method = r"""
  // Remplace window.prompt() par une Promesse (modale custom)
  prompt(
    title: string,
    message: string,
    opts: { placeholder?: string; type?: 'text' | 'password'; confirmLabel?: string; cancelLabel?: string } = {}
  ): Promise<string | null> {
    return new Promise((resolve) => {
      let current = '';
      const setValue = (val: string) => { current = val; };
      const getValue = () => current;

      this.promptData.set({
        title,
        message,
        placeholder: opts.placeholder ?? '',
        type: opts.type ?? 'text',
        confirmLabel: opts.confirmLabel ?? 'Valider',
        cancelLabel: opts.cancelLabel ?? 'Annuler',
        setValue,
        getValue,
        resolve: (val: string | null) => {
          this.promptData.set(null); // Fermer la modale
          resolve(val);
        }
      });
    });
  }

"""
    s_ui = s_ui.replace(
        "  // Remplace window.confirm() par une Promesse\n",
        prompt_method + "  // Remplace window.confirm() par une Promesse\n"
    )

# --------------------------------------------------------------------
# 2) UiContainerComponent: rendre la modale promptData
# --------------------------------------------------------------------
ensure_once(s_cont, "@if (ui.confirmData())", "UiContainer: bloc confirmData introuvable, structure inattendue.")

if "@if (ui.promptData())" not in s_cont:
    # On insère le bloc prompt juste AVANT le bloc confirm (ou juste après les toasts)
    insert_point = s_cont.find("@if (ui.confirmData())")
    if insert_point == -1:
        raise SystemExit("UiContainer: point d'insertion introuvable.")

    prompt_block = r"""
    @if (ui.promptData()) {
      <div class="fixed inset-0 z-[111] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">

          <div class="flex flex-col items-center pt-6 pb-2">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-200">
              <span class="material-icons text-slate-700 text-3xl">lock</span>
            </div>
            <h3 class="text-xl font-bold text-slate-800 text-center px-6">
              {{ ui.promptData()?.title }}
            </h3>
          </div>

          <div class="px-8 py-2 text-center">
            <p class="text-slate-500 text-sm leading-relaxed">
              {{ ui.promptData()?.message }}
            </p>
          </div>

          <div class="px-8 pb-2 pt-3">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Saisie</label>
            <input
              class="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              [type]="ui.promptData()?.type || 'text'"
              [placeholder]="ui.promptData()?.placeholder || ''"
              (input)="ui.promptData()?.setValue($any($event.target).value)"
              (keydown.enter)="ui.promptData()?.resolve(ui.promptData()?.getValue() || null)"
              autocomplete="current-password"
            />
            <p class="mt-2 text-[11px] text-slate-400">
              Appuie sur Entrée pour valider.
            </p>
          </div>

          <div class="p-6 flex gap-3">
            <button
              (click)="ui.promptData()?.resolve(null)"
              class="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              {{ ui.promptData()?.cancelLabel }}
            </button>

            <button
              (click)="ui.promptData()?.resolve(ui.promptData()?.getValue() || null)"
              class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow"
            >
              {{ ui.promptData()?.confirmLabel }}
            </button>
          </div>

        </div>
      </div>
    }

"""
    s_cont = s_cont[:insert_point] + prompt_block + s_cont[insert_point:]

# --------------------------------------------------------------------
# 3) reservation-form.component.ts: remplacer window.prompt par ui.prompt
# --------------------------------------------------------------------
# On remplace le bloc exact (très probable) :
# const password = window.prompt('Mot de passe admin (admin@gmail.com) :');
# if (!password) return;
pattern = r"const\s+password\s*=\s*window\.prompt\(\s*'Mot de passe admin \(admin@gmail\.com\) :'\s*\);\s*\n\s*if\s*\(\s*!password\s*\)\s*return;\s*"
if re.search(pattern, s_res):
    repl = """const password = await this.ui.prompt(
      'Authentification requise',
      'Saisis le mot de passe admin pour confirmer la suppression.',
      { placeholder: 'Mot de passe', type: 'password', confirmLabel: 'Continuer', cancelLabel: 'Annuler' }
    );
    if (!password) return;
"""
    s_res = re.sub(pattern, repl, s_res, count=1)
else:
    # fallback: si le texte diffère légèrement, on remplace juste window.prompt(...)
    s_res2 = s_res.replace(
        "const password = window.prompt('Mot de passe admin (admin@gmail.com) :');",
        "const password = await this.ui.prompt(\n"
        "      'Authentification requise',\n"
        "      'Saisis le mot de passe admin pour confirmer la suppression.',\n"
        "      { placeholder: 'Mot de passe', type: 'password', confirmLabel: 'Continuer', cancelLabel: 'Annuler' }\n"
        "    );"
    )
    if s_res2 == s_res:
        raise SystemExit("ReservationForm: window.prompt(...) introuvable (structure inattendue).")
    s_res = s_res2

# Ecriture des fichiers
write(ui_service, s_ui)
write(ui_container, s_cont)
write(res_form, s_res)

print("✅ Patch appliqué sur:")
print(" -", ui_service)
print(" -", ui_container)
print(" -", res_form)
PY

echo "==> Format (optionnel) : si tu as prettier/eslint, lance tes scripts habituels."
echo "==> Terminé ✅"
echo ""
echo "Pour annuler: restaure les .bak :"
echo "  mv '$UI_SERVICE.bak' '$UI_SERVICE'"
echo "  mv '$UI_CONTAINER.bak' '$UI_CONTAINER'"
echo "  mv '$RES_FORM.bak' '$RES_FORM'"
