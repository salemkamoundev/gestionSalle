#!/bin/bash

# Couleurs pour la lisibilité
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}   NETTOYAGE DU PROJET (SAUF app.ts ET app.html)                  ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# 1. Recherche des fichiers de sauvegarde et temporaires
# On cherche dans le dossier src/ les extensions .bak, .tmp, etc.
FIND_CMD="find src -type f \( -name '*.bak' -o -name '*.bak_*' -o -name '*.tmp' -o -name '*.tmp_*' \)"

# 2. Détection des fichiers résiduels spécifiques
EXTRA_FILES=""
if [ -f "src/app/app.component.ts" ]; then
    # NOTE : app.ts et app.html sont EXCLUS de la suppression suite à ta demande.
    
    # On vérifie uniquement si app.scss est un doublon (car app.component.scss existe)
    if [ -f "src/app/app.scss" ]; then 
        EXTRA_FILES="$EXTRA_FILES src/app/app.scss"
    fi
    
    # On vérifie si app.spec.ts est un doublon
    if [ -f "src/app/app.component.spec.ts" ]; then
         if [ -f "src/app/app.spec.ts" ]; then
             EXTRA_FILES="$EXTRA_FILES src/app/app.spec.ts"
         fi
    fi
fi

# Exécution de la recherche
FILES_TO_DELETE=$(eval $FIND_CMD)
ALL_FILES="$FILES_TO_DELETE $EXTRA_FILES"

# Vérification : Si la liste est vide, on s'arrête
if [ -z "$(echo $ALL_FILES | xargs)" ]; then
    echo -e "${GREEN}✅ Aucun fichier inutile trouvé. Ton projet est propre !${NC}"
    exit 0
fi

# Compter les fichiers
COUNT=$(echo $ALL_FILES | tr " " "\n" | grep -v "^$" | wc -l)

echo -e "${YELLOW}Les fichiers suivants ont été identifiés comme inutiles ($COUNT fichiers) :${NC}"
echo ""

# Affichage de la liste pour vérification visuelle
for file in $ALL_FILES; do
    echo -e "  ${RED}- $file${NC}"
done

echo ""
echo -e "${YELLOW}ATTENTION : Ces fichiers seront définitivement supprimés.${NC}"
read -p "Confirmer la suppression ? (o/N) : " confirm

# Vérification de la réponse
if [[ "$confirm" =~ ^[oO](ui)?$ ]]; then
    echo ""
    echo -e "${BLUE}Suppression en cours...${NC}"
    
    for file in $ALL_FILES; do
        if [ -f "$file" ]; then
            rm -v "$file"
        fi
    done

    echo ""
    echo -e "${GREEN}✅ Nettoyage terminé avec succès !${NC}"
else
    echo ""
    echo -e "${GREEN}❌ Opération annulée. Aucun fichier n'a été touché.${NC}"
fi