#!/bin/bash

echo "🚀 Démarrage des corrections automatiques..."

# ---------------------------------------------------------
# 1. Correction du Modèle Reservation (Erreurs TS4111)
# ---------------------------------------------------------
# On réécrit le fichier pour inclure explicitement 'customerPhone' et 'advancePayment'
# afin que TypeScript les reconnaisse sans passer par l'index signature.

cat << 'EOF' > src/app/core/models/reservation.model.ts
export interface Reservation {
  id?: string;
  date?: any; 
  status?: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  
  // Infos Client
  clientId?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string; // Ajouté pour corriger TS4111
  
  // Détails
  services?: any[];
  selectedSlotId?: string;
  slotId?: string;
  assignedServerIds?: string[];
  startTime?: string;
  endTime?: string;
  
  // Finances
  totalPrice?: number;
  advance?: number;
  advancePayment?: number; // Ajouté pour corriger TS4111

  // Index signature pour tout le reste
  [key: string]: any;
}
EOF

echo "✅ src/app/core/models/reservation.model.ts mis à jour."

# ---------------------------------------------------------
# 2. Correction de StaffNotificationsComponent (Erreur TS2554)
# ---------------------------------------------------------
# On utilise sed pour remplacer l'appel erroné markAsRead(id) par markAsRead(uid, id)
# Le chemin cible est celui indiqué dans vos logs d'erreur.

TARGET_FILE="src/app/features/staff-view/staff-notifications/staff-notifications.component.ts"

if [ -f "$TARGET_FILE" ]; then
    # Remplacement de la ligne problématique
    # On cherche 'this.notifService.markAsRead(notif.id);' et on remplace par la version avec 'this.currentUid'
    sed -i 's/this.notifService.markAsRead(notif.id);/this.notifService.markAsRead(this.currentUid, notif.id);/' "$TARGET_FILE"
    
    echo "✅ Correction appliquée à $TARGET_FILE"
else
    echo "⚠️ Attention : Le fichier $TARGET_FILE n'a pas été trouvé."
fi

echo "🎉 Corrections terminées !"