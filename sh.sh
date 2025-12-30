#!/bin/bash

echo "🔐 FINALISATION DE LA LOGIQUE CRÉNEAUX (VERROUILLAGE & FILTRAGE)..."

node <<'EOF'
const fs = require('fs');
const file = 'src/app/features/calendar/reservation-form/reservation-form.component.ts';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. AJOUT DU SIGNAL DE RESTRICTION
  if (!content.includes('restrictedSlotType = signal')) {
    // On l'ajoute proprement après les autres signaux
    content = content.replace(
      /(pendingParams = signal.*?;)/,
      '$1\n  restrictedSlotType = signal<string | null>(null);'
    );
    modified = true;
    console.log('✅ Signal restrictedSlotType ajouté.');
  }

  // 2. REMPLACEMENT DU COMPUTED 'filteredSlots'
  // On remplace l'ancienne logique par le filtrage strict demandé
  const oldComputed = /filteredSlots = computed\(\(\) => \{[\s\S]*?return slots\.filter\(s => date >= s\.validFrom && date <= s\.validTo\);\s*\}\);/;
  
  const newComputed = `filteredSlots = computed(() => {
    const date = this.selectedDate();
    const slots = this.availableSlots();
    if (!date || !slots) return [];
    
    // 1. On garde uniquement les créneaux valides pour cette date (Saisons)
    let valid = slots.filter(s => date >= s.validFrom && date <= s.validTo);

    // 2. On applique la restriction du calendrier (Si clic depuis le calendrier)
    const restriction = this.restrictedSlotType();
    
    if (restriction === 'matin') {
       // Si Matin : On ne montre QUE Matin
       return valid.filter(s => s.id === 'matin');
    } 
    else if (restriction === 'soir') {
       // Si Soir : On ne montre QUE Soir
       return valid.filter(s => s.id === 'soir');
    } 
    else if (restriction === 'aprem') {
       // Si Aprem : On montre Aprem1 et Aprem2
       return valid.filter(s => s.id.startsWith('aprem'));
    }

    // Sinon (ex: nouvelle résa sans passer par calendrier), on montre tout
    return valid;
  });`;

  if (oldComputed.test(content)) {
    content = content.replace(oldComputed, newComputed);
    modified = true;
    console.log('✅ Logique de filtrage (Matin/Soir/Aprems) mise à jour.');
  }

  // 3. MISE À JOUR DE L'EFFET (Réception des paramètres URL)
  // C'est ici qu'on active ou désactive le champ (disable/enable)
  
  // On cherche le bloc 'effect(() => { ... })' et on remplace sa logique interne
  // Regex pour capturer le contenu du if(slots && ... params)
  const effectBlockRegex = /if \(slots && slots\.length > 0 && params\) \{([\s\S]*?)(this\.pendingParams\.set\(null\);)/;

  const newEffectLogic = `
        this.selectedDate.set(params.date);
        
        // On normalise le slot demandé (ex: 'aprem' ou 'matin')
        const reqSlot = (params.slot || '').toLowerCase();
        
        // RESET : On active le champ par défaut
        this.form.get('slotId')?.enable();
        this.restrictedSlotType.set(null);
        
        let targetId = '';

        if (reqSlot.includes('matin')) {
            // CAS MATIN -> Forcé & Verrouillé
            this.restrictedSlotType.set('matin');
            targetId = 'matin';
            this.form.get('slotId')?.disable(); // <--- VERROUILLAGE
        
        } else if (reqSlot.includes('soir')) {
            // CAS SOIR -> Forcé & Verrouillé
            this.restrictedSlotType.set('soir');
            targetId = 'soir';
            this.form.get('slotId')?.disable(); // <--- VERROUILLAGE
        
        } else if (reqSlot.includes('aprem')) {
            // CAS APREM -> Filtré mais Modifiable (Choix entre 1 et 2)
            this.restrictedSlotType.set('aprem');
            
            // On essaie de pré-selectionner aprem1 par défaut, mais l'user peut changer
            // Le champ reste ENABLED (actif)
            targetId = 'aprem1'; 
        } else {
            // Cas direct (ID précis)
            targetId = reqSlot;
        }

        // Application des valeurs
        // Note: patchValue fonctionne même sur un champ disabled
        this.form.patchValue({ 
            date: params.date, 
            slotId: targetId, 
            selectedSlotId: targetId 
        });
        
        // Mise à jour des horaires
        this.applySlotTimes(targetId);

        // Recalcul du prix
        setTimeout(() => this.calculateTotal(), 200);
        
        `;

  if (effectBlockRegex.test(content)) {
    content = content.replace(effectBlockRegex, `if (slots && slots.length > 0 && params) {${newEffectLogic}$2`);
    modified = true;
    console.log('✅ Logique de verrouillage (Disable/Enable) appliquée.');
  }

  if (modified) {
    fs.writeFileSync(file, content);
    console.log('🎉 Fichier reservation-form.component.ts mis à jour avec succès.');
  } else {
    console.log('ℹ️  Aucune modification effectuée (motifs non trouvés).');
  }
} else {
  console.error('❌ Fichier introuvable :', file);
}
EOF

echo "--------------------------------------------------------"
echo "✅ TERMINÉ."
echo "1. Lancez 'ng serve'."
echo "2. Testez :"
echo "   - Clic Matin -> Champ gris (non modifiable), valeur 'Matin'."
echo "   - Clic Soir -> Champ gris (non modifiable), valeur 'Soir'."
echo "   - Clic Aprem -> Champ blanc (modifiable), choix possibles : 'Aprem 1' ou 'Aprem 2'."
echo "--------------------------------------------------------"