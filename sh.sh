#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
ANGULAR_JSON="$ROOT/angular.json"

if [[ ! -f "$ANGULAR_JSON" ]]; then
  echo "❌ angular.json introuvable. Lance ce script à la racine du projet Angular."
  exit 1
fi

APP_COMPONENT="$(find "$ROOT/src/app" -maxdepth 4 -name "app.component.ts" -print -quit 2>/dev/null || true)"
if [[ -z "${APP_COMPONENT:-}" ]]; then
  echo "❌ app.component.ts introuvable."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ROOT/.fix-backups/$STAMP"
cp -f "$APP_COMPONENT" "$ROOT/.fix-backups/$STAMP/app.component.ts" 2>/dev/null || true

echo "==> 0) Assure PushInitService existe"
mkdir -p "$ROOT/src/app/push"
if [[ ! -f "$ROOT/src/app/push/push-init.service.ts" ]]; then
cat > "$ROOT/src/app/push/push-init.service.ts" <<'EOF'
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PushInitService {
  private readonly sessionKey = 'push_init_ran_v1';
  constructor(private router: Router) {}

  async initOnce(): Promise<void> {
    try {
      if (sessionStorage.getItem(this.sessionKey) === '1') return;

      const url = this.router.url || '';
      if (url === '/login' || url.includes('/login')) return;

      sessionStorage.setItem(this.sessionKey, '1');

      if (!('Notification' in window)) return;

      // Ne pas déclencher le prompt automatiquement ici (source fréquente de comportements bizarres)
      // const perm = Notification.permission;
      // if (perm === 'default') await Notification.requestPermission();

      // Si besoin: ne récupérer le token que si déjà "granted", sans redirect/reload.
      // if (Notification.permission === 'granted') { ... getToken ... }
    } catch (e) {
      console.warn('[PushInitService] initOnce error:', e);
    }
  }
}
EOF
  echo "✅ Created: src/app/push/push-init.service.ts"
else
  echo "ℹ️ PushInitService déjà présent."
fi

echo "==> 1) Patch AppComponent (crée constructor si absent + ajoute ngOnInit guardé)"
python3 - <<PY
import re, pathlib, sys

p = pathlib.Path("$APP_COMPONENT")
s = p.read_text(encoding="utf-8")

def ensure_import(module: str, names):
    global s
    m = re.search(rf"import\\s*\\{{([^}}]+)\\}}\\s*from\\s*'{re.escape(module)}';", s)
    if m:
        existing = [x.strip() for x in m.group(1).split(",") if x.strip()]
        changed = False
        for n in names:
            if n not in existing:
                existing.append(n)
                changed = True
        if changed:
            s = s[:m.start()] + f"import {{ {', '.join(existing)} }} from '{module}';" + s[m.end():]
    else:
        # insert after last import if any, else at top
        imports = list(re.finditer(r"^import[\\s\\S]*?;\\s*$", s, flags=re.M))
        ins_at = imports[-1].end() if imports else 0
        prefix = s[:ins_at] + ("\n" if ins_at else "")
        s = prefix + f"import {{ {', '.join(names)} }} from '{module}';\n" + s[ins_at:]

ensure_import("@angular/core", ["OnInit"])
ensure_import("@angular/router", ["Router", "NavigationEnd"])
ensure_import("rxjs/operators", ["filter"])

# Ensure PushInitService import (relative to app.component.ts)
if "PushInitService" not in s:
    imports = list(re.finditer(r"^import[\\s\\S]*?;\\s*$", s, flags=re.M))
    ins_at = imports[-1].end() if imports else 0
    prefix = s[:ins_at] + ("\n" if ins_at else "")
    s = prefix + "import { PushInitService } from './push/push-init.service';\n" + s[ins_at:]

# Find class AppComponent block start
mclass = re.search(r"export\\s+class\\s+AppComponent\\b([^\\{]*)\\{", s)
if not mclass:
    print("❌ Impossible de trouver `export class AppComponent {`.", file=sys.stderr)
    sys.exit(1)

class_decl = mclass.group(0)
tail = mclass.group(1)  # part between classname and "{"

# Ensure implements OnInit
if "implements" in tail:
    if "OnInit" not in tail:
        # append OnInit to implements list
        new_tail = re.sub(r"implements\\s+([^\\{]+)", lambda mm: f"implements {mm.group(1).strip()}, OnInit", tail)
        s = s[:mclass.start(1)] + new_tail + s[mclass.end(1):]
else:
    # add implements OnInit
    s = s[:mclass.start(1)] + " implements OnInit" + s[mclass.end(1):]

# Re-find class open after edits
mclass = re.search(r"export\\s+class\\s+AppComponent\\b[^\\{]*\\{", s)
class_open_idx = mclass.end()

# Detect if constructor exists
has_ctor = re.search(r"constructor\\s*\\(", s[class_open_idx:]) is not None

insert_after = class_open_idx

# If no constructor, create one near top of class
if not has_ctor:
    ctor = (
        "\n  constructor(\n"
        "    private router: Router,\n"
        "    private pushInit: PushInitService,\n"
        "  ) {}\n"
    )
    s = s[:insert_after] + ctor + s[insert_after:]
else:
    # ensure injections exist in existing constructor params
    mctor = re.search(r"constructor\\s*\\(([^)]*)\\)", s)
    if mctor:
        params = mctor.group(1).strip()
        def has(name): return re.search(rf"\\b{name}\\b", params) is not None
        add = []
        if not has("router"):
            add.append("private router: Router")
        if not has("pushInit"):
            add.append("private pushInit: PushInitService")
        if add:
            if params == "":
                new_params = ", ".join(add)
            else:
                new_params = params + ", " + ", ".join(add)
            s = s[:mctor.start(1)] + new_params + s[mctor.end(1):]

# Ensure ngOnInit exists and contains subscription
if "ngOnInit" not in s:
    # insert ngOnInit after constructor (first constructor end)
    mctor_block = re.search(r"constructor\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}\\s*", s)
    if not mctor_block:
        # if constructor is empty "{}" one-liner, try that
        mctor_block = re.search(r"constructor\\s*\\([^)]*\\)\\s*\\{\\s*\\}\\s*", s)
    if not mctor_block:
        print("❌ Constructor introuvable même après tentative de création.", file=sys.stderr)
        sys.exit(1)

    ng = (
        "\n  ngOnInit(): void {\n"
        "    this.router.events\n"
        "      .pipe(filter((e) => e instanceof NavigationEnd))\n"
        "      .subscribe(() => {\n"
        "        // Run push init once after we are NOT on /login\n"
        "        void this.pushInit.initOnce();\n"
        "      });\n"
        "  }\n"
    )
    s = s[:mctor_block.end()] + ng + s[mctor_block.end():]
else:
    if "pushInit.initOnce" not in s:
        s = re.sub(
            r"(ngOnInit\\s*\\(\\)\\s*:\\s*void\\s*\\{)",
            r"\\1\n    this.router.events\n      .pipe(filter((e) => e instanceof NavigationEnd))\n      .subscribe(() => { void this.pushInit.initOnce(); });\n",
            s,
            count=1
        )

p.write_text(s, encoding="utf-8")
print("✅ Patched:", str(p))
PY

echo "==> 2) (Optionnel) Désactive reload/location dans fichiers login/auth si présents"
LOGIN_FILES="$(find "$ROOT/src" -type f \( -name "*login*.ts" -o -name "*auth*.ts" \) 2>/dev/null || true)"
if [[ -n "${LOGIN_FILES:-}" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    rel="${f#$ROOT/}"
    mkdir -p "$ROOT/.fix-backups/$STAMP/$(dirname "$rel")"
    cp -f "$f" "$ROOT/.fix-backups/$STAMP/$rel" 2>/dev/null || true

    if grep -qE "location\.reload\(|window\.location|document\.location" "$f"; then
      python3 - <<PY
import pathlib, re
p=pathlib.Path("$f")
s=p.read_text(encoding="utf-8")
s=re.sub(r"(\\blocation\\.reload\\([^)]*\\)\\s*;?)", r"// [AUTO-FIX] disabled to prevent login loop: \\1", s)
s=re.sub(r"(\\bwindow\\.location\\b[^;]*;)", r"// [AUTO-FIX] disabled to prevent login loop: \\1", s)
s=re.sub(r"(\\bdocument\\.location\\b[^;]*;)", r"// [AUTO-FIX] disabled to prevent login loop: \\1", s)
p.write_text(s, encoding="utf-8")
print("✅ Disabled reload/location in:", str(p))
PY
    fi
  done <<< "$LOGIN_FILES"
fi

echo
echo "✅ Terminé. Backups: .fix-backups/$STAMP/"
echo "➡️ Ensuite: unregister SW + clear site data (DevTools > Application), puis re-test."
