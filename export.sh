#!/bin/bash

# Nom du fichier de sortie
OUTPUT_FILE="full_project_source.txt"

# Effacer le fichier de sortie s'il existe déjà
> "$OUTPUT_FILE"

echo "Début de la concaténation des fichiers source..."

# Trouver tous les fichiers .ts, .html, et .scss dans le dossier src
# On exclut les fichiers de tests (.spec.ts) pour plus de clarté
find src -type f \( -name "*.ts" -o -name "*.html" -o -name "*.scss" \) ! -name "*.spec.ts" | while read -r file; do
    echo "------------------------------------------------" >> "$OUTPUT_FILE"
    echo "FILE: $file" >> "$OUTPUT_FILE"
    echo "------------------------------------------------" >> "$OUTPUT_FILE"
    
    # Ajouter le contenu du fichier
    cat "$file" >> "$OUTPUT_FILE"
    
    # Ajouter un saut de ligne entre les fichiers
    echo -e "\n" >> "$OUTPUT_FILE"
done

echo "Terminé ! Le résultat est disponible dans : $OUTPUT_FILE"