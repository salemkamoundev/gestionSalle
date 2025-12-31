#!/bin/bash

echo "🚑 CORRECTION DE L'ERREUR TYPESCRIPT (UNDEFINED)..."

node <<'EOF'
const fs = require('fs');
const file = 'src/app/features/calendar/reservation-form/reservation-form.component.ts';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // L'erreur est ici : partner.serviceIds.includes(...)
  // On remplace par : (partner.serviceIds || []).includes(...)
  // Ce qui gère le cas où serviceIds est null ou undefined.

  const target = /partner\.serviceIds\.includes\((.*?)\)/g;
  const replacement = '(partner.serviceIds || []).includes($1)';

  if (target.test(content)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(file, content);
      console.log('✅ Erreur TS18048 corrigée (Null check ajouté).');
  } else {
      console.log('ℹ️ Code cible non trouvé (peut-être déjà corrigé).');
      
      // Tentative de correction alternative si le code diffère légèrement
      const altTarget = /partnerRemoved\.serviceIds\.includes\((.*?)\)/g;
      if (altTarget.test(content)) {
          content = content.replace(altTarget, '(partnerRemoved.serviceIds || []).includes($1)');
          fs.writeFileSync(file, content);
          console.log('✅ Erreur TS18048 corrigée (Alternative partnerRemoved).');
      }
  }
} else {
    console.error('❌ Fichier introuvable.');
}
EOF

echo "🚀 Terminée. Relancez la compilation."