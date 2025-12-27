#!/bin/bash

TARGET="src/app/features/calendar/reservation-form/reservation-form.component.ts"

if [ ! -f "$TARGET" ]; then
    echo "❌ Fichier introuvable : $TARGET"
    exit 1
fi

echo "🔄 Passage au 'Soft Delete' (Annulation au lieu de Suppression)..."

# 1. Modification de la suppression simple (sans avoirs)
# On remplace deleteReservation par updateReservation({status: 'CANCELLED'})
# On cible spécifiquement la ligne dans onAdminAuthSuccess ou onDeleteReservation

perl -i -pe "s/await this.reservationService.deleteReservation\(this.reservationId\);/await this.reservationService.updateReservation(this.reservationId, { status: 'CANCELLED' });/g" "$TARGET"

# 2. Modification de la suppression complexe (avec génération d'avoirs)
# Dans processCancellationWithCredits, on remplace transaction.delete(...) par transaction.update(...)

# On cherche : transaction.delete(doc(this.firestore, 'reservations', this.reservationId!));
# On remplace par : transaction.update(doc(this.firestore, 'reservations', this.reservationId!), { status: 'CANCELLED' });

export SEARCH_DEL="transaction.delete\(doc\(this.firestore, 'reservations', this.reservationId!\)\);"
export REPLACE_UPD="transaction.update(doc(this.firestore, 'reservations', this.reservationId!), { status: 'CANCELLED' });"

perl -i -pe "s/\Q$SEARCH_DEL\E/$REPLACE_UPD/g" "$TARGET"

echo "✅ Terminé ! Les réservations seront désormais archivées avec le statut 'Annulé' au lieu d'être supprimées définitivement."
echo "ℹ️ Note : Les réservations déjà supprimées avant ce script sont perdues définitivement."