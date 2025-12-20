#!/usr/bin/env bash
set -euo pipefail

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
info(){ echo "ℹ️  $*"; }

[ -f "angular.json" ] || die "angular.json introuvable (lance à la racine du projet)"

PACK_FORM="src/app/features/packs/pack-form/pack-form.component.ts"
[ -f "$PACK_FORM" ] || die "Introuvable: $PACK_FORM"

TS="$(date +%Y%m%d_%H%M%S)"
cp -a "$PACK_FORM" "$PACK_FORM.bak.$TS"
ok "Backup: $PACK_FORM.bak.$TS"

python3 - "$PACK_FORM" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1) Ensure helper method exists: prefillPriceForServiceGroup(group)
# ------------------------------------------------------------
HELPER_METHOD = r"""
  private prefillPriceForServiceGroup(group: any) {
    if (!group) return;

    const nom = String(group.get?.('nom')?.value ?? '').trim();
    if (!nom) return;

    const suggested = Number((this as any).servicePriceByName?.[nom] ?? 0);
    if (!suggested) return;

    const current = group.get?.('prix')?.value;
    const currentNum = Number(current ?? 0);

    // Anti-régression: ne pas écraser un prix déjà saisi (non nul)
    if (current === '' || current == null || currentNum === 0) {
      group.patchValue?.({ prix: suggested });
    }
  }
"""

def ensure_helper(s: str) -> str:
    if re.search(r'^\s*private\s+prefillPriceForServiceGroup\s*\(', s, flags=re.M):
        return s
    # insert before last closing brace of class
    return re.sub(r'\n\}\s*$', "\n" + HELPER_METHOD + "\n}\n", s, count=1)

src = ensure_helper(src)

# ------------------------------------------------------------
# 2) Patch addService(...) to subscribe to nom.valueChanges
#    We only patch PackForm addService (should exist).
# ------------------------------------------------------------
# Find addService(...) { ... this.servicesArray.push(this.fb.group({ ... })) ... }
m = re.search(r'^\s*addService\s*\(\s*data\?\s*:\s*any\s*\)\s*\{', src, flags=re.M)
if not m:
    # fallback: addService(data?: any) without types
    m = re.search(r'^\s*addService\s*\(\s*data\?\s*\)\s*\{', src, flags=re.M)

if not m:
    print("❌ addService(...) introuvable dans PackForm", file=sys.stderr)
    sys.exit(2)

# Extract method block with brace counting
start = m.end()
i = start
depth = 1
while i < len(src):
    ch = src[i]
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            end = i
            break
    i += 1
else:
    print("❌ addService(...) braces non équilibrés", file=sys.stderr)
    sys.exit(3)

body = src[start:end]

# If already patched, do nothing
if "nomCtrl.valueChanges" in body or "prefillPriceForServiceGroup" in body and "valueChanges" in body:
    path.write_text(src, encoding="utf-8")
    print(f"NOOP: {path} (addService déjà patché)")
    sys.exit(0)

# Try to rewrite addService in a safe way:
# Replace pattern: this.servicesArray.push(this.fb.group({...}));
# with: const group = this.fb.group({...}); group.get('nom')?.valueChanges.subscribe(...); this.servicesArray.push(group);
push_pat = re.compile(r'this\.servicesArray\.push\(\s*this\.fb\.group\(\s*\{([\s\S]*?)\}\s*\)\s*\)\s*;\s*', re.M)

pm = push_pat.search(body)
if not pm:
    # fallback: if code different, inject subscription AFTER a "const group" if it exists, else add minimal patch near push
    if "const group" in body and "this.servicesArray.push(group" in body:
        # insert subscription after const group declaration block end (after first ';' following const group = ...)
        body2 = re.sub(
            r'(const\s+group\s*=\s*this\.fb\.group\([\s\S]*?\);\s*)',
            r"\1\n    const nomCtrl = group.get('nom');\n    nomCtrl?.valueChanges?.subscribe(() => this.prefillPriceForServiceGroup(group));\n    // Préremplir immédiatement si nom déjà présent (edit)\n    this.prefillPriceForServiceGroup(group);\n",
            body,
            count=1
        )
        body = body2
    else:
        # last resort: find push line and wrap around it (best effort)
        body = body.replace(
            "this.servicesArray.push(",
            "const __srvGroup = "
        )
        # if too risky, error out
        print("❌ Structure addService inattendue. Patch stoppé (anti-régression).", file=sys.stderr)
        sys.exit(4)
else:
    inner = pm.group(1)
    replacement = (
        "const group = this.fb.group({"
        + inner +
        "});\n"
        "    const nomCtrl = group.get('nom');\n"
        "    nomCtrl?.valueChanges?.subscribe(() => this.prefillPriceForServiceGroup(group));\n"
        "    // Préremplir immédiatement si nom déjà présent (edit)\n"
        "    this.prefillPriceForServiceGroup(group);\n"
        "    this.servicesArray.push(group);\n"
    )
    body = body[:pm.start()] + replacement + body[pm.end():]

# Write back method
src = src[:start] + body + src[end:]

# ------------------------------------------------------------
# 3) Ensure template has at least one safe trigger (optional)
#    Not required anymore, but harmless and helps UX: (change) handler.
#    We'll add only if input has neither (input) nor (change) already.
# ------------------------------------------------------------
def add_change_handler(s: str) -> str:
    pat = re.compile(r'(<input[\s\S]*?formControlName="nom"[\s\S]*?list="serviceSuggestions"[\s\S]*?>)', re.M)
    def f(m):
        tag = m.group(1)
        if "serviceSuggestions" not in tag:
            return tag
        if "(input)=" in tag or "(change)=" in tag:
            return tag
        return tag.replace('list="serviceSuggestions"', 'list="serviceSuggestions" (change)="prefillPriceForServiceGroup(servicesArray.at($index))"')
    return pat.sub(f, s, count=10)

src = add_change_handler(src)

path.write_text(src, encoding="utf-8")
print(f"PATCHED: {path}")
PY

ok "PackForm patché: préremplissage prix via nom.valueChanges (fiable avec datalist)"
info "Relance: ng build"
