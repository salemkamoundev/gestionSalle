#!/usr/bin/env bash
set -euo pipefail

# Supprime UNIQUEMENT les fichiers de backup/temporaires dans src/
# Anti-régression: preview + confirmation, et ne touche pas aux vrais fichiers .ts/.html/.scss

ROOT="$(pwd)"
[ -f "$ROOT/angular.json" ] || { echo "❌ Lance ce script à la racine du projet (angular.json introuvable)."; exit 1; }

echo "🧹 Nettoyage des backups dans src/ (SAFE)"
echo "----------------------------------------"
echo

# Patterns de backups/temporaires observés dans ton arbre
# - *.bak
# - *.bak.<timestamp>
# - *.DISABLED.<timestamp>
# - *.client-fix.bak
# - *.bak.fix
# - *.fix
PATTERNS=(
  -name "*.bak"
  -o -name "*.bak.*"
  -o -name "*.DISABLED.*"
  -o -name "*.client-fix.bak"
  -o -name "*.bak.fix"
  -o -name "*.fix"
)

echo "🔎 Liste des fichiers qui vont être supprimés :"
echo

# Preview
find "$ROOT/src" -type f \( "${PATTERNS[@]}" \) -print | sed 's|^'"$ROOT/"'||' || true

echo
COUNT="$(find "$ROOT/src" -type f \( "${PATTERNS[@]}" \) -print | wc -l | tr -d ' ')"
echo "➡️  Total: $COUNT fichier(s)"
echo

if [ "$COUNT" = "0" ]; then
  echo "✅ Rien à supprimer."
  exit 0
fi

read -r -p "👉 Confirmer la suppression ? (y/N) " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  echo "❌ Annulé."
  exit 0
fi

echo
echo "🗑️  Suppression..."
find "$ROOT/src" -type f \( "${PATTERNS[@]}" \) -print -delete

echo
echo "✅ Terminé. Conseil: lance 'ng build' pour vérifier."
