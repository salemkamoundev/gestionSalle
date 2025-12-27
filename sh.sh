#!/bin/bash

# Fichier cible
FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
TEMP_SED="update_calendar_form.sed"

# Vérification
if [ ! -f "$FILE" ]; then
    echo "❌ Erreur : Le fichier $FILE est introuvable."
    exit 1
fi

echo "🔧 Mise à jour de $FILE avec ConfigService..."

cat > "$TEMP_SED" << 'EOF'
# 1. Ajouter l'import de ConfigService
/import { AuthService }/a\
import { ConfigService } from '../../../core/services/config.service';

# 2. Injecter le service ConfigService
/private authService = inject(AuthService);/a\
  private configService = inject(ConfigService);

# 3. Remplacer availableSlots par la version dynamique
# On supprime le bloc availableSlots existant (multiligne)
/availableSlots = signal(\[/,/\]);/c\
  availableSlots = computed(() => this.configService.settings().creneaux);

# 4. Mettre à jour getDynamicSlotPrice pour utiliser le prix de la configuration
# On remplace tout le corps de la fonction jusqu'au return
/getDynamicSlotPrice(dateStr: string, slotId: string): number {/,/return Math.round(price);/c\
  getDynamicSlotPrice(dateStr: string, slotId: string): number {\
    if (!dateStr || !slotId) return 0;\
    // On récupère le créneau sélectionné dans la config\
    const slot = this.availableSlots().find(s => s.id === slotId);\
    // On retourne son prix défini (ou 0)\
    return slot ? Number(slot.price) : 0;

EOF

# Application du script
sed -f "$TEMP_SED" "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"

# Nettoyage
rm "$TEMP_SED"

echo "✅ Le formulaire de réservation (Calendar) utilise maintenant les créneaux et tarifs de la Configuration."