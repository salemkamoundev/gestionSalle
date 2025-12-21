#!/bin/bash

# Couleurs pour le terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}--- Démarrage du script de réparation Angular ---${NC}"

# ==========================================
# 1. CRÉATION DU FICHIER MANQUANT
# ==========================================
FILE_PATH="src/app/features/staff-view/staff-calendar.component.html"
DIR_PATH=$(dirname "$FILE_PATH")

echo -e "${YELLOW}[1/2] Vérification de staff-calendar.component.html...${NC}"

if [ ! -d "$DIR_PATH" ]; then
    echo -e "Création du dossier : $DIR_PATH"
    mkdir -p "$DIR_PATH"
fi

# Création du contenu du fichier
cat <<EOF > "$FILE_PATH"
<div class="staff-calendar-container p-4">
  <div class="header mb-4 flex justify-between items-center">
    <h2 class="text-2xl font-bold">Calendrier du Personnel</h2>
    <div class="actions">
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Ajouter une disponibilité
        </button>
    </div>
  </div>
  
  <div class="calendar-wrapper bg-white shadow rounded-lg p-6 border border-gray-200">
    <div class="text-center py-10">
      <p class="text-gray-500 text-lg">Le calendrier s'affichera ici.</p>
      <p class="text-sm text-gray-400 mt-2">(Composant en cours de développement)</p>
    </div>
  </div>
</div>
EOF

echo -e "${GREEN}✅ Fichier créé : $FILE_PATH${NC}"

# ==========================================
# 2. CORRECTION DE AUTH.SERVICE.TS
# ==========================================
AUTH_FILE="src/app/core/services/auth.service.ts"

echo -e "${YELLOW}[2/2] Correction de l'Injection Context dans Auth.service.ts...${NC}"

if [ -f "$AUTH_FILE" ]; then
    # Créer un backup
    cp "$AUTH_FILE" "${AUTH_FILE}.bak_fix_script"
    echo "Backup créé : ${AUTH_FILE}.bak_fix_script"

    # Stratégie :
    # 1. Supprimer les anciennes lignes inject(...) mal placées pour éviter les doublons
    # 2. Insérer les bonnes lignes juste après la déclaration de la classe

    # Suppression des lignes contenant inject(Auth), inject(Firestore), inject(Router)
    # Note : On utilise un fichier temporaire pour la compatibilité sed (macOS/Linux)
    sed '/private auth = inject(Auth)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"
    sed '/private firestore = inject(Firestore)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"
    sed '/private router = inject(Router)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"
    
    # Suppression des versions "const" si elles existaient
    sed '/const auth = inject(Auth)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"
    sed '/const firestore = inject(Firestore)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"
    sed '/const router = inject(Router)/d' "$AUTH_FILE" > "${AUTH_FILE}.tmp" && mv "${AUTH_FILE}.tmp" "$AUTH_FILE"

    # Insertion des lignes correctes après "export class AuthService"
    # On cherche la ligne de définition de classe et on ajoute les propriétés juste après
    sed -i.tmp '/export class AuthService/a \
  private auth = inject(Auth);\
  private firestore = inject(Firestore);\
  private router = inject(Router);' "$AUTH_FILE"

    # Nettoyage du fichier temporaire créé par sed -i
    rm "${AUTH_FILE}.tmp"

    echo -e "${GREEN}✅ Injections déplacées en haut de la classe AuthService.${NC}"
else
    echo -e "${RED}❌ ERREUR : Fichier $AUTH_FILE introuvable.${NC}"
fi

echo -e "${YELLOW}-------------------------------------------${NC}"
echo -e "${GREEN}🎉 Opérations terminées. Tu peux relancer 'ng serve'.${NC}"