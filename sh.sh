#!/usr/bin/env bash
set -euo pipefail

# fix-fcm-sw.sh
# - Télécharge firebase-app-compat + firebase-messaging-compat en local (assets)
# - Patch firebase-messaging-sw.js pour importer depuis /assets (pas de gstatic au runtime)
# - Force une version stable pour Service Worker: 10.12.4
# - Assure la copie du SW dans angular.json
#
# Usage:
#   chmod +x fix-fcm-sw.sh
#   ./fix-fcm-sw.sh
#
# Option:
#   FIREBASE_JS_VERSION=10.12.4 ./fix-fcm-sw.sh

FIREBASE_JS_VERSION="${FIREBASE_JS_VERSION:-10.12.4}"

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
info(){ echo "ℹ️  $*"; }

[[ -f "angular.json" ]] || die "angular.json introuvable. Lance ce script à la racine du projet Angular."

# 1) Trouver le SW
SW_SRC=""
if [[ -f "src/firebase-messaging-sw.js" ]]; then
  SW_SRC="src/firebase-messaging-sw.js"
elif [[ -f "firebase-messaging-sw.js" ]]; then
  SW_SRC="firebase-messaging-sw.js"
else
  die "firebase-messaging-sw.js introuvable (cherché: src/firebase-messaging-sw.js ou firebase-messaging-sw.js)."
fi
ok "Service Worker: $SW_SRC"

# 2) Backups
cp -p "$SW_SRC" "$SW_SRC.bak"
cp -p "angular.json" "angular.json.bak"
ok "Backups créés: $SW_SRC.bak, angular.json.bak"

# 3) Préparer assets
ASSETS_DIR="src/assets/firebase"
mkdir -p "$ASSETS_DIR"
ok "Dossier assets: $ASSETS_DIR"

APP_JS="$ASSETS_DIR/firebase-app-compat.js"
MSG_JS="$ASSETS_DIR/firebase-messaging-compat.js"

download() {
  local url="$1"
  local out="$2"
  info "Téléchargement: $url"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --retry-delay 1 "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$out"
  else
    die "Ni curl ni wget dispo. Installe curl puis relance."
  fi
}

APP_URL="https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-app-compat.js"
MSG_URL="https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-messaging-compat.js"

download "$APP_URL" "$APP_JS" || die "Échec download app-compat (réseau bloque gstatic ?)."
download "$MSG_URL" "$MSG_JS" || die "Échec download messaging-compat (réseau bloque gstatic ?)."
ok "Scripts Firebase (v${FIREBASE_JS_VERSION}) copiés en local."

# 4) Patch SW: importScripts locaux en ABSOLU + suppression des anciens importScripts
tmp="$(mktemp)"
{
  echo "/* Auto-fixed by fix-fcm-sw.sh */"
  echo "importScripts(\"/assets/firebase/firebase-app-compat.js\");"
  echo "importScripts(\"/assets/firebase/firebase-messaging-compat.js\");"
  echo ""
  # Supprime toutes les lignes importScripts(...) existantes (CDN ou assets)
  grep -vE '^\s*(self\.)?importScripts\s*\(' "$SW_SRC"
} > "$tmp"
cp "$tmp" "$SW_SRC"
rm -f "$tmp"
ok "firebase-messaging-sw.js patché (importScripts depuis /assets/...)."

# 5) Assurer angular.json assets: src/assets + src/firebase-messaging-sw.js
python3 - <<'PY'
import json

path="angular.json"
with open(path, "r", encoding="utf-8") as f:
    data=json.load(f)

projects=data.get("projects", {})
if not projects:
    raise SystemExit("❌ angular.json: 'projects' introuvable.")

def ensure_str(assets, item):
    if any(isinstance(a, str) and a == item for a in assets):
        return False
    assets.append(item)
    return True

changed=False
for pname, proj in projects.items():
    targets = proj.get("architect") or proj.get("targets") or {}
    build = targets.get("build", {})
    configs=[]

    opts=build.get("options")
    if isinstance(opts, dict):
        configs.append(opts)

    confs=build.get("configurations", {})
    if isinstance(confs, dict):
        for _, cobj in confs.items():
            if isinstance(cobj, dict):
                configs.append(cobj)

    for cfg in configs:
        assets=cfg.get("assets")
        if assets is None:
            cfg["assets"]=["src/assets"]
            assets=cfg["assets"]
            changed=True
        if not isinstance(assets, list):
            continue

        if ensure_str(assets, "src/assets"):
            changed=True
        # Pour servir /firebase-messaging-sw.js à la racine
        if ensure_str(assets, "src/firebase-messaging-sw.js"):
            changed=True

if changed:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("✅ angular.json mis à jour (assets).")
else:
    print("ℹ️  angular.json déjà OK (assets).")
PY

cat <<'NEXT'

────────────────────────────────────────
✅ Terminé.

FAIS ÇA MAINTENANT (obligatoire) :
1) Stop + relance "ng serve"
2) DevTools → Application → Service Workers:
   - Unregister
   - puis Ctrl+Shift+R

Vérifie ensuite:
- http://localhost:4200/assets/firebase/firebase-app-compat.js
- http://localhost:4200/assets/firebase/firebase-messaging-compat.js
- http://localhost:4200/firebase-messaging-sw.js

Note:
- On force Firebase JS v10.12.4 car 10.12.5 a eu des régressions importScripts en SW.
────────────────────────────────────────
NEXT

ok "Script fini."
