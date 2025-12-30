#!/bin/bash

echo "🔒 APPLICATION DES RÈGLES MÉTIER CALENDRIER -> FORMULAIRE..."

# On utilise Node.js pour manipuler le fichier TypeScript proprement
node -e "
const fs = require('fs');
const file = 'src/app/features/calendar/reservation-form/reservation-form.component.ts';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. AJOUT DU SIGNAL 'restrictedSlotType' (pour stocker la contrainte)
  if (!content.includes('restrictedSlotType = signal')) {
    // On l'ajoute après pendingParams
    content = content.replace(
      /pendingParams = signal.*null\);\n/, 
      'pendingParams = signal<{date: string, slot: string} | null>(null);\n  restrictedSlotType = signal<string | null>(null);\n'
    );
    modified = true;
    console.log('✅ Signal restrictedSlotType ajouté.');
  }

  // 2. MISE À JOUR DE LA LOGIQUE 'filteredSlots' (Le filtre intelligent)
  // On remplace l'ancien computed par le nouveau qui regarde la restriction
  const oldComputedRegex = /filteredSlots = computed\(\(\) => \{[\s\S]*?return slots\.filter\(s => date >= s\.validFrom && date <= s\.validTo\);\s*\}\);/;
  
  const newComputed = \`filteredSlots = computed(() => {
    const date = this.selectedDate();
    const slots = this.availableSlots();
    if (!date || !slots) return [];
    
    // 1. Filtre par date
    let validSlots = slots.filter(s => date >= s.validFrom && date <= s.validTo);

    // 2. Filtre par restriction (règle calendrier)
    const restriction = this.restrictedSlotType();
    
    if (restriction === 'matin') {
      return validSlots.filter(s => s.id === 'matin');
    } else if (restriction === 'soir') {
      return validSlots.filter(s => s.id === 'soir');
    } else if (restriction === 'aprem') {
      // Montre toutes les options d'après-midi (aprem1, aprem2, etc.)
      return validSlots.filter(s => s.id.startsWith('aprem'));
    }

    return validSlots;
  });\`;

  if (oldComputedRegex.test(content)) {
     content = content.replace(oldComputedRegex, newComputed);
     modified = true;
     console.log('✅ Logique de filtrage (filteredSlots) mise à jour.');
  }

  // 3. MISE À JOUR DE L'EFFET (Réception des params du calendrier)
  // On remplace le bloc logique à l'intérieur de l'effect pour gérer le disable/enable
  
  const oldEffectLogic = /if \(slots && slots\.length > 0 && params\) \{[\s\S]*?this\.calculateTotal\(\), 200\);\s*\}/;

  const newEffectLogic = \`if (slots && slots.length > 0 && params) {
        this.selectedDate.set(params.date);
        const reqSlot = (params.slot || '').toLowerCase();
        
        // --- LOGIQUE DE RESTRICTION ---
        this.form.get('slotId')?.enable(); // Reset par défaut
        this.restrictedSlotType.set(null);

        let targetSlotId = '';

        if (reqSlot.includes('matin')) {
            // Cas MATIN : Verrouillé
            this.restrictedSlotType.set('matin');
            targetSlotId = 'matin';
            this.form.get('slotId')?.disable();
        
        } else if (reqSlot.includes('soir')) {
            // Cas SOIR : Verrouillé
            this.restrictedSlotType.set('soir');
            targetSlotId = 'soir';
            this.form.get('slotId')?.disable();
        
        } else if (reqSlot.includes('aprem')) {
            // Cas APRÈS-MIDI : Choix restreint mais modifiable entre aprem1/aprem2
            this.restrictedSlotType.set('aprem');
            
            // On pré-sélectionne aprem1 par défaut pour être gentil, mais l'user peut changer
            const aprem1 = slots.find(s => s.id === 'aprem1' && params.date >= s.validFrom && params.date <= s.validTo);
            targetSlotId = aprem1 ? 'aprem1' : ''; 
            
            // On laisse le champ ACTIF (enable) pour le choix
        } else {
            // Cas générique (ex: clic direct sur date sans créneau) : On essaie de trouver un match exact
            const match = slots.find(s => 
                s.id.toLowerCase() === reqSlot && 
                params.date >= s.validFrom && params.date <= s.validTo
            );
            if (match) targetSlotId = match.id;
        }

        // Application des valeurs
        this.form.patchValue({ 
            date: params.date, 
            slotId: targetSlotId, 
            selectedSlotId: targetSlotId 
        });

        // Si verrouillé, on force l'application des horaires car le valueChanges ne trigge pas toujours sur disable
        if (targetSlotId) {
            this.applySlotTimes(targetSlotId);
        }

        this.pendingParams.set(null);
        setTimeout(() => this.calculateTotal(), 200);
      }\`;

  if (oldEffectLogic.test(content)) {
     content = content.replace(oldEffectLogic, newEffectLogic);
     modified = true;
     console.log('✅ Logique de réception (Effect) mise à jour.');
  }

  if (modified) {
    fs.writeFileSync(file, content);
    console.log('🎉 Fichier reservation-form.component.ts sauvegardé avec succès !');
  } else {
    console.log('ℹ️  Aucune modification nécessaire ou patterns non trouvés.');
  }
} else {
  console.error('❌ Fichier introuvable :', file);
}
"

echo "--------------------------------------------------------"
echo "✅ Script terminé."
echo "1. Lancez 'ng serve'"
echo "2. Testez depuis le calendrier :"
echo "   - Clic sur 'Matin' -> Formulaire ouvert, 'Matin' sélectionné et GRISÉ."
echo "   - Clic sur 'Soir' -> Formulaire ouvert, 'Soir' sélectionné et GRISÉ."
echo "   - Clic sur 'Après-midi' -> Formulaire ouvert, liste restreinte à 'Aprem1' / 'Aprem2'."
echo "--------------------------------------------------------"