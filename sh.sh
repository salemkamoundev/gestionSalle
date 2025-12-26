#!/bin/bash

# cleanup_project.sh
# Nettoie le projet des fichiers inutiles, backups et doublons.

echo "🧹 Démarrage du nettoyage..."

# 1. Supprimer les fichiers de backup (.bak, .bak_safe, .bak_final, .txt$)
echo "🗑️ Suppression des fichiers de backup..."
find src -type f \( -name "*.bak" -o -name "*.bak_safe" -o -name "*.bak_final" -o -name "*.txt" -o -name "*.txt$" \) -delete

# 2. Nettoyage spécifique dans reservation-form (garder uniquement la version active)
echo "🗑️ Nettoyage du dossier reservation-form..."
# On supprime les sous-dossiers composants s'ils ne sont plus utilisés dans la version monolithique
# (Assurez-vous que votre version monolithique n'en a plus besoin avant d'exécuter ceci)
# rm -rf src/app/features/calendar/reservation-form/components/step-* # rm -rf src/app/features/calendar/reservation-form/components/reservation-tabs

# 3. Supprimer les fichiers doublons potentiels (si nécessaire)
# Par exemple, si vous aviez `reservation-form.component.ts` ailleurs par erreur.
# Ici, on garde la structure saine.

# 4. Suppression des fichiers temporaires systèmes (si présents)
find . -name ".DS_Store" -delete

echo "✅ Nettoyage terminé."
echo "Fichiers restants dans reservation-form :"
ls -R src/app/features/calendar/reservation-form/