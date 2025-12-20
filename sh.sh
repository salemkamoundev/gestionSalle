#!/bin/bash

# Configuration du moteur de remplacement selon l'OS (Mac vs Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_CMD=(sed -i '')
else
  SED_CMD=(sed -i)
fi

FILE_TS="src/app/features/calendar/reservation-form/reservation-form.component.ts"

echo "🛠️ Réparation des types TypeScript..."

if [ -f "$FILE_TS" ]; then
    # 1. Remettre 'nom' pour les Teams (t.label -> t.nom)
    "${SED_CMD[@]}" "s/t.label.toLowerCase/t.nom.toLowerCase/g" "$FILE_TS"
    
    # 2. Remettre 'nom' pour les Serveurs (s.label -> s.nom dans le contexte servers)
    # On cible spécifiquement la ligne qui contient 'this.servers'
    "${SED_CMD[@]}" "s/this.servers().filter(s => s.label/this.servers().filter(s => s.nom/g" "$FILE_TS"
    
    # 3. Remettre 'nom' pour les Clients (c.label -> c.nom)
    "${SED_CMD[@]}" "s/c.label/c.nom/g" "$FILE_TS"
    
    # 4. S'assurer que le Créneau (Slot) utilise BIEN 'label'
    # On cible spécifiquement la ligne de recherche du slotId
    "${SED_CMD[@]}" "s/s.nom.toLowerCase().includes(slotKeyword/s.label.toLowerCase().includes(slotKeyword/g" "$FILE_TS"

    echo "✅ Fichier TS réparé."
fi

echo "------------------------------------------------------------"
echo "🚀 Correction terminée. Lancez 'ng serve' pour compiler."
echo "------------------------------------------------------------"