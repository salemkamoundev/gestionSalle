#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 est requis"
  exit 1
fi

TS="src/app/features/payments/payment-list/payment-list.component.ts"
if [[ ! -f "$TS" ]]; then
  TS="$(find . -type f -path "*/src/app/features/payments/payment-list/payment-list.component.ts" -print -quit 2>/dev/null || true)"
fi

if [[ -z "${TS:-}" || ! -f "$TS" ]]; then
  echo "❌ Introuvable: payment-list.component.ts"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
cp -f "$TS" "$TS.bak.$STAMP"

python3 - "$TS" <<'PY'
import sys, re
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8", errors="ignore")

# 1) Assurer computed dans import @angular/core
m = re.search(r"^import\s+\{\s*([^}]+)\s*\}\s+from\s+'@angular/core';\s*$", s, flags=re.M)
if m:
    syms = [x.strip() for x in m.group(1).split(",") if x.strip()]
    if "computed" not in syms:
        syms.append("computed")
        new_line = "import { " + ", ".join(syms) + " } from '@angular/core';"
        s = s[:m.start()] + new_line + s[m.end():]

# 2) Supprimer TOUTES les defs focusedClient (où qu'elles soient)
s = re.sub(
    r"\n?\s*focusedClient\s*=\s*computed\(\(\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*;\s*\n?",
    "\n",
    s,
    flags=re.M
)

# 3) Insérer focusedClient immédiatement après "export class ... {"
#    (ça garantit que c'est DANS la classe)
block = """
  // Client lié à la réservation "focus" (reservationId -> reservation.clientId)
  focusedClient = computed(() => {
    const r: any = (this as any).focusedReservation ? (this as any).focusedReservation() : null;
    const list: any[] = (this as any).clients ? (this as any).clients() : [];
    const cid = r?.clientId;
    if (!cid) return null;
    return (list.find((c: any) => c?.id === cid) || null);
  });

"""

# on cible PaymentListComponent si possible, sinon premier export class
mcls = re.search(r"(export\s+class\s+PaymentListComponent\s*\{\s*\n)", s)
if not mcls:
    mcls = re.search(r"(export\s+class\s+\w+\s*\{\s*\n)", s)

if not mcls:
    raise SystemExit("❌ Impossible: export class ... { introuvable")

# éviter double-insertion si relancé
if "Client lié à la réservation" not in s:
    s = s[:mcls.end()] + block + s[mcls.end():]

# 4) Nettoyage lignes vides excessives
s = re.sub(r"\n{4,}", "\n\n\n", s)

p.write_text(s, encoding="utf-8")
print("OK: focusedClient forcé dans la classe PaymentListComponent")
PY

echo "✅ OK: focusedClient est maintenant dans la classe."
echo "🧷 Backup: $TS.bak.$STAMP"
echo "👉 Relance: ng serve"
