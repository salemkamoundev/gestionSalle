#!/bin/bash

# Chemins des fichiers cibles
TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

echo "Suppression de la section 'Note Administrateur'..."

# 1. Nettoyage du fichier TypeScript (TS)
# Supprime la ligne contenant 'isAdmin = this.authService.isAdmin;'
sed -i '' "/isAdmin = this.authService.isAdmin;/d" "$TS_FILE"

# 2. Nettoyage du fichier Template (HTML)
# Utilisation de perl pour supprimer le bloc multi-ligne de @if (isAdmin...) jusqu'à sa fermeture }
# Cela cible spécifiquement le bloc contenant "Note Administrateur"
perl -i -0777 -pe 's/\@if\s*\((isAdminEmail|isAdmin)\(\)\)\s*\{[^}]*Note Administrateur[^}]*\}\s*\n//g' "$HTML_FILE"

echo "Nettoyage terminé. La section a été retirée du formulaire."