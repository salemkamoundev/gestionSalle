#!/bin/bash

# Fichier cible
FILE="src/app/features/clients/client-form/client-form.component.ts"
TEMP_SED="fix_client_emit.sed"

# Vérification
if [ ! -f "$FILE" ]; then
    echo "❌ Erreur : Le fichier $FILE est introuvable."
    exit 1
fi

echo "🔧 Correction de l'émission des données client dans $FILE..."

# Création du fichier de commandes sed
cat > "$TEMP_SED" << 'EOF'
# Remplacer l'assignation simple par la récupération de l'ID et la construction de l'objet complet
s/res = await this.clientService.addClient(clientData);/const docRef = await this.clientService.addClient(clientData);\
        res = { id: docRef.id, ...clientData };/
EOF

# Application du correctif
sed -f "$TEMP_SED" "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"

# Nettoyage
rm "$TEMP_SED"

echo "✅ Correctif appliqué : Le formulaire renvoie maintenant l'objet client complet (avec nom/prénom) au lieu de la référence Firestore."