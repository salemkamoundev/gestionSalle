#!/bin/bash

echo "🚀 Début du nettoyage des fichiers inutiles dans src/..."

# 1. Supprime tous les fichiers contenant '.bak' (avec ou sans date/suffixe)
# Cela couvre : .bak, .bak.20251221, .bak_color, .bak_v2, etc.
find src -type f -name "*.bak*" -print -delete

# 2. Supprime les fichiers contenant '.corrupted.'
find src -type f -name "*.corrupted.*" -print -delete

# 3. Supprime les fichiers finissant par des guillemets simples (ex: reservation.model.ts'')
find src -type f -name "*''" -print -delete

# 4. Supprime les fichiers temporaires .tmp
find src -type f -name "*.tmp" -print -delete

# 5. Supprime les dossiers nommés 'backup' et leur contenu
# (Comme celui trouvé dans finances/expense-manager/backup)
find src -type d -name "backup" -exec rm -rf {} + -verbose

echo "✨ Nettoyage terminé ! Votre arborescence est maintenant propre."