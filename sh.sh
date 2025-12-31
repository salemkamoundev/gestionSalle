#!/bin/bash

echo "📦 CORRECTION IMPLEMENTATION PACK -> SERVICES ..."

node <<'EOF'
const fs = require('fs');
const file = 'src/app/features/calendar/reservation-form/reservation-form.component.ts';

if (!fs.existsSync(file)) {
    console.error("❌ Erreur : Fichier introuvable !");
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// LA NOUVELLE LOGIQUE COMPLÈTE
const correctSelectPack = `
  selectPack(packId: string | null | undefined, packData: any = null) {
    if (this.isPastReservation()) return;

    // 1. Identifier l'ancien et le nouveau pack
    const oldPackId = this.form.get('packId')?.value;
    const allPacks = this.packs();
    
    // Récupération des objets Packs complets
    const oldPack = oldPackId ? allPacks.find(p => p.id === oldPackId) : null;
    const newPack = packId ? allPacks.find(p => p.id === packId) : null;

    if (oldPackId === packId) return;

    this.form.patchValue({ packId });

    // Copie de travail des services actuels
    let currentServices = [...this.selectedServices()];
    let servicesToRemoveCount = 0;

    // 2. RETRAIT DES SERVICES DE L'ANCIEN PACK
    if (oldPack && oldPack.services && Array.isArray(oldPack.services)) {
        // On vérifie quels services sont "protégés" par le personnel assigné
        const staffIds = this.form.get('assignedServerIds')?.value || [];
        const staffServicesIds = new Set<string>();
        const allPartners = this.rawPartenaire();

        staffIds.forEach((sid: string) => {
            const partner = allPartners.find((p: any) => p.id === sid);
            if (partner && partner.serviceIds) {
                partner.serviceIds.forEach((srvId: string) => staffServicesIds.add(srvId));
            }
        });

        const oldPackServiceIds = oldPack.services.map((s: any) => s.id);
        const keptServices: any[] = [];

        currentServices.forEach(s => {
            const isFromOldPack = oldPackServiceIds.includes(s.id);
            const isNeededByStaff = staffServicesIds.has(s.id);

            // On retire le service SI il vient de l'ancien pack ET qu'il n'est pas requis par le staff
            if (isFromOldPack && !isNeededByStaff) {
                servicesToRemoveCount++;
            } else {
                keptServices.push(s);
            }
        });
        currentServices = keptServices;
    }

    // 3. AJOUT DES SERVICES DU NOUVEAU PACK
    let addedCount = 0;
    if (newPack && newPack.services && Array.isArray(newPack.services)) {
        newPack.services.forEach((s: any) => {
            // On ajoute si pas déjà présent
            if (!currentServices.some(curr => curr.id === s.id)) {
                // Normalisation pour affichage
                currentServices.push({
                    id: s.id,
                    name: s.name || s.nom || 'Service Pack',
                    price: Number(s.price !== undefined ? s.price : (s.prix !== undefined ? s.prix : 0)),
                    icon: s.icon || 'inventory_2'
                });
                addedCount++;
            }
        });
    }

    // 4. MISE À JOUR DE L'ETAT
    this.selectedServices.set(currentServices);
    this.form.patchValue({ services: currentServices });
    this.calculateTotal();

    // 5. NOTIFICATIONS
    if (addedCount > 0) {
        this.ui.showToast('success', \`\${addedCount} services ajoutés via le Pack \${newPack.nom}\`);
    }
    if (servicesToRemoveCount > 0) {
        this.ui.showToast('info', \`\${servicesToRemoveCount} services retirés (changement de pack)\`);
    }
  }
`;

// REMPLACEMENT CIBLÉ
// On cherche la fonction selectPack actuelle (celle qui est incomplète)
// Signature: selectPack(packId: string | null | undefined, packData: any = null) { ... }

const searchSignature = "selectPack(packId: string | null | undefined, packData: any = null) {";
const startIndex = content.indexOf(searchSignature);

if (startIndex !== -1) {
    // On cherche l'accolade fermante correspondante
    let braceCount = 0;
    let endIndex = -1;
    let foundStart = false;

    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            foundStart = true;
        } else if (content[i] === '}') {
            braceCount--;
        }

        if (foundStart && braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }

    if (endIndex !== -1) {
        const before = content.substring(0, startIndex);
        const after = content.substring(endIndex);
        const newContent = before + correctSelectPack + after;
        
        fs.writeFileSync(file, newContent);
        console.log("✅ Méthode selectPack corrigée et injectée avec succès.");
    } else {
        console.error("❌ Impossible de trouver la fin de la méthode selectPack.");
    }
} else {
    console.error("❌ Méthode selectPack introuvable. Vérifiez la signature.");
}
EOF

echo "🚀 Terminé. La sélection d'un pack ajoute maintenant correctement ses services."