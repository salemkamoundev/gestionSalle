#!/bin/bash

MODEL_FILE="src/app/core/models/reservation.model.ts"

echo "🔧 Ajout des champs financiers (totalPrice, advance) au modèle..."

# On réécrit le fichier modèle avec TOUS les champs nécessaires
cat << 'EOF' > "$MODEL_FILE"
export interface Reservation {
  id?: string;
  date?: any; 
  status?: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  
  // Infos Client
  clientId?: string;
  clientName?: string;
  customerName?: string;
  
  // Détails
  services?: any[];
  selectedSlotId?: string;
  slotId?: string;
  assignedServerIds?: string[];
  startTime?: string;
  endTime?: string;
  
  // Finances (Correction des erreurs TS4111)
  totalPrice?: number;
  advance?: number;

  // Index signature pour tout le reste
  [key: string]: any;
}
EOF

echo "✅ Modèle mis à jour avec totalPrice et advance."
echo "🚀 Vous pouvez relancer le build : ionic capacitor build android"