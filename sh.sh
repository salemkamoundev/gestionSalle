#!/bin/bash

echo "🏷️  Ajout de l'affichage du prix dans le sélecteur..."

cat << 'EOF' > update_display.py
import os
import re

# Chemins des fichiers
ts_path = 'src/app/features/calendar/reservation-form/reservation-form.component.ts'
html_path = 'src/app/features/calendar/reservation-form/reservation-form.component.html'

# Recherche automatique si nécessaire
if not os.path.exists(ts_path):
    for root, dirs, files in os.walk("src"):
        if "reservation-form.component.ts" in files:
            ts_path = os.path.join(root, "reservation-form.component.ts")
            html_path = ts_path.replace('.ts', '.html')
            break

# 1. AJOUT DE LA FONCTION HELPER DANS LE TS
# Cette fonction calcule le total pour l'affichage
with open(ts_path, 'r') as f:
    ts_content = f.read()

helper_method = """
  // Helper pour afficher le prix dans le HTML
  getPackTotal(pack: any): number {
    if (!pack || !pack.services) return 0;
    return pack.services.reduce((acc: number, s: any) => acc + (Number(s.prix) || 0), 0);
  }
"""

# On l'ajoute seulement si elle n'existe pas déjà
if 'getPackTotal' not in ts_content:
    # On l'insère avant la dernière accolade fermante
    ts_content = ts_content.rstrip().rstrip('}') + "\n" + helper_method + "\n}"
    with open(ts_path, 'w') as f:
        f.write(ts_content)
    print("✅ Fonction de calcul 'getPackTotal' ajoutée au TS.")
else:
    print("ℹ️  La fonction 'getPackTotal' existe déjà.")

# 2. MISE À JOUR DE L'AFFICHAGE DANS LE HTML
if os.path.exists(html_path):
    with open(html_path, 'r') as f:
        html_content = f.read()

    # On cherche l'endroit où on affiche le nom du pack
    # Ancien format: {{ pack.nom }} ({{ pack.services?.length || 0 }} svcs)
    # Nouveau format: {{ pack.nom }} - {{ getPackTotal(pack) }} DT
    
    # Regex flexible pour trouver l'intérieur de la balise <option> dans la boucle *ngFor
    # On cherche ce qui est entre > et </option> pour les options du pack
    
    # On remplace le pattern spécifique qu'on a mis précédemment
    old_pattern = r"\{\{\s*pack\.nom\s*\}\}\s*\(\{\{\s*pack\.services\?\.length\s*\|\|\s*0\s*\}\}\s*svcs\)"
    new_display = "{{ pack.nom }} - {{ getPackTotal(pack) }} DT"
    
    if re.search(old_pattern, html_content):
        html_content = re.sub(old_pattern, new_display, html_content)
        with open(html_path, 'w') as f:
            f.write(html_content)
        print("✅ HTML mis à jour avec le prix.")
    else:
        # Si le pattern exact n'est pas trouvé, on essaie de remplacer plus largement l'option
        # C'est une sécurité si vous avez modifié le texte manuellement entre temps
        print("⚠️  Pattern exact non trouvé, tentative de remplacement générique...")
        # On cherche l'option qui contient *ngFor="let pack"
        generic_pattern = r"(<option\s+\*ngFor=\"let pack of packs\$ \| async\".*?>)(.*?)(</option>)"
        
        def replace_option(match):
            return f"{match.group(1)} {{{{ pack.nom }}}} - {{{{ getPackTotal(pack) }}}} DT {match.group(3)}"
            
        html_content = re.sub(generic_pattern, replace_option, html_content, flags=re.DOTALL)
        with open(html_path, 'w') as f:
            f.write(html_content)
        print("✅ HTML mis à jour (méthode générique).")

else:
    print("❌ Fichier HTML introuvable.")

EOF

python3 update_display.py
rm update_display.py

echo "🏁 Terminé ! Le prix s'affiche maintenant à côté du nom du pack."