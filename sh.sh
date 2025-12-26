#!/bin/bash

# 2_cleanup_junk.sh
# Nettoyage des fichiers temporaires, backups et résidus.

echo "🧹 Nettoyage en cours..."

# 1. Supprimer les fichiers temporaires système bizarres (ex: .!92723!filename)
find src -type f -name ".!*" -delete

# 2. Supprimer les fichiers de backup (.bak, .bak_safe, .bak_final, .txt$)
find src -type f \( -name "*.bak" -o -name "*.bak_safe" -o -name "*.bak_final" -o -name "*.txt$" \) -delete

# 3. Supprimer les fichiers .DS_Store (Mac)
find . -name ".DS_Store" -delete

echo "✨ Nettoyage terminé."