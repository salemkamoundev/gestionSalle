#!/usr/bin/env bash
set -euo pipefail

FILE="index.js"

if [[ ! -f "$FILE" ]]; then
  echo "❌ index.js introuvable dans ce dossier."
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
cp "$FILE" "$FILE.bak.$TS"
echo "📦 Backup: $FILE.bak.$TS"

PYBIN=""
if command -v python3 >/dev/null 2>&1; then PYBIN="python3"; elif command -v python >/dev/null 2>&1; then PYBIN="python"; else
  echo "❌ Python introuvable (python3/python)."
  exit 1
fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("index.js")
s = p.read_text(encoding="utf-8")
orig = s

# Remplace le bloc "const tokens = [] ... if (data.fcmToken) { tokens.push(...) }"
pattern = r"""
\s*const\s+usersSnapshot\s*=\s*await\s+db\.collection\('users'\)\.get\(\);\s*
\s*const\s+tokens\s*=\s*\[\];\s*
\s*usersSnapshot\.forEach\(\s*doc\s*=>\s*\{\s*
\s*const\s+data\s*=\s*doc\.data\(\);\s*
\s*if\s*\(\s*data\.fcmToken\s*\)\s*\{\s*
\s*tokens\.push\(\s*data\.fcmToken\s*\);\s*
\s*\}\s*
\s*\}\);\s*
""".strip()

replacement = """
    const usersSnapshot = await db.collection('users').get();

    // ✅ Support: lastFcmToken (string) + fcmTokens (array)
    const tokenSet = new Set();

    usersSnapshot.forEach(doc => {
      const data = doc.data() || {};

      // 1) lastFcmToken (prioritaire)
      if (typeof data.lastFcmToken === 'string' && data.lastFcmToken.trim()) {
        tokenSet.add(data.lastFcmToken.trim());
      }

      // 2) fcmTokens (array)
      if (Array.isArray(data.fcmTokens)) {
        for (const t of data.fcmTokens) {
          if (typeof t === 'string' && t.trim()) tokenSet.add(t.trim());
        }
      }
    });

    const tokens = Array.from(tokenSet);
""".rstrip()

s2 = re.sub(pattern, replacement, s, flags=re.S | re.X)

if s2 == s:
    # fallback: patch plus “large” si le code diffère légèrement
    s2 = s
    s2 = s2.replace("const tokens = [];", "const tokenSet = new Set();")
    s2 = s2.replace(
        "if (data.fcmToken) {\n        tokens.push(data.fcmToken);\n      }",
        """// ✅ Support: lastFcmToken + fcmTokens
      if (typeof data.lastFcmToken === 'string' && data.lastFcmToken.trim()) {
        tokenSet.add(data.lastFcmToken.trim());
      }
      if (Array.isArray(data.fcmTokens)) {
        for (const t of data.fcmTokens) {
          if (typeof t === 'string' && t.trim()) tokenSet.add(t.trim());
        }
      }"""
    )
    if "const tokens = Array.from(tokenSet);" not in s2:
        # ajoute conversion juste après le forEach
        s2 = re.sub(
            r"(usersSnapshot\.forEach\([\s\S]*?\);\s*)",
            r"\\1\n    const tokens = Array.from(tokenSet);\n",
            s2,
            count=1
        )

if s2 == orig:
    raise SystemExit("❌ Patch non appliqué: le pattern n'a pas été trouvé. Colle ton index.js et je patch au caractère près.")

# Ajouter un log pour voir 3 tokens
if "Exemples tokens" not in s2:
    s2 = s2.replace(
        "console.log(`🎯 Envoi à ${tokens.length} appareils...`);",
        "console.log(`🎯 Envoi à ${tokens.length} appareils...`);\n    console.log('🔎 Exemples tokens:', tokens.slice(0, 3));"
    )

p.write_text(s2, encoding="utf-8")
print("✅ index.js patché: lit lastFcmToken + fcmTokens[] et déduplique")
PY

echo "✅ OK. Relance:"
echo "   node index.js"
