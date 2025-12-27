#!/bin/bash

# Fichier cible
TARGET="src/app/features/calendar/reservation-form/reservation-form.component.ts"

# Vérification présence fichier
if [ ! -f "$TARGET" ]; then
    echo "❌ Erreur : Fichier $TARGET introuvable."
    exit 1
fi

echo "🔍 Correction de la logique de sauvegarde dans $TARGET..."

# Sauvegarde de sécurité
cp "$TARGET" "$TARGET.bak"

# La commande Perl cherche la ligne exacte "else await this.reservationService.addReservation(data);"
# et la remplace par le bloc qui capture l'ID, met à jour le mode édition et l'URL.

perl -i -pe 's/else await this.reservationService.addReservation\(data\);/else { const newId = await this.reservationService.addReservation(data); this.reservationId = newId; this.isEditMode.set(true); this.location.replaceState("\/reservations\/edit\/" + newId); }/' "$TARGET"

if [ $? -eq 0 ]; then
    echo "✅ Succès ! La logique de sauvegarde a été corrigée."
    echo "   Désormais, l'onglet 'Règlements' s'affichera immédiatement après le premier enregistrement."
else
    echo "❌ Échec de la modification."
    # Restauration
    mv "$TARGET.bak" "$TARGET"
fi