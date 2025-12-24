#!/bin/bash

echo "🧹 Démarrage du nettoyage du projet..."

# 1. Suppression des fichiers .bak simples
echo "--- Suppression des fichiers .bak ---"
find src -type f -name "*.bak" -print -delete

# 2. Suppression des fichiers de sauvegarde avec timestamp (.bak.2025...)
echo "--- Suppression des fichiers de sauvegarde datés ---"
find src -type f -name "*.bak.*" -print -delete

# 3. Nettoyage des fichiers obsolètes à la racine de src/app
# Angular utilise app.component.*. Les fichiers app.ts, app.html, app.scss sont des doublons inutiles.

# Nettoyage des fichiers config backup s'ils existent
rm -vf src/app/app.config.ts.bak
rm -vf src/app/app.routes.ts.bak

echo "------------------------------------------------"
echo "✅ Nettoyage terminé ! Votre dossier src est propre."
echo "------------------------------------------------"