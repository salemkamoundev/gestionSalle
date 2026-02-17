#!/bin/bash

# Définition des chemins relatifs (depuis la racine du projet)
MODEL_FILE="src/app/core/models/reservation.model.ts"
TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

# Vérification que l'on est bien à la racine
if [ ! -f "angular.json" ]; then
    echo "❌ Erreur : Veuillez exécuter ce script depuis la racine du projet Angular (là où se trouve angular.json)."
    exit 1
fi

# Création du script Python temporaire
cat > patch_maries.py << 'EOF'
import os

model_path = os.environ['MODEL_FILE']
ts_path = os.environ['TS_FILE']
html_path = os.environ['HTML_FILE']

# 1. Mise à jour du Modèle
print("🔄 Mise à jour du modèle Reservation...")
try:
    with open(model_path, 'r') as f:
        content = f.read()

    if 'brideName' not in content:
        content = content.replace('notes?: string;', 'notes?: string;\n  brideName?: string;\n  groomName?: string;')
        with open(model_path, 'w') as f:
            f.write(content)
        print("✅ Modèle mis à jour.")
    else:
        print("ℹ️ Le modèle contient déjà les champs.")
except FileNotFoundError:
    print(f"❌ Fichier introuvable : {model_path}")

# 2. Mise à jour du Component
print("🔄 Mise à jour du FormGroup...")
try:
    with open(ts_path, 'r') as f:
        content = f.read()

    if 'brideName' not in content:
        content = content.replace("notes: ['']", "notes: [''],\n    brideName: [''],\n    groomName: ['']")
        with open(ts_path, 'w') as f:
            f.write(content)
        print("✅ Component mis à jour.")
    else:
        print("ℹ️ Le component contient déjà les champs.")
except FileNotFoundError:
    print(f"❌ Fichier introuvable : {ts_path}")

# 3. Mise à jour du HTML
print("🔄 Mise à jour du Template HTML...")
try:
    with open(html_path, 'r') as f:
        content = f.read()

    target_block_start = '<div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">'
    html_to_insert = '''              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-sm font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
                  <span class="material-icons text-pink-500">favorite</span> Mariés
                </h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Marié</label>
                    <input formControlName="groomName" type="text" placeholder="Nom du marié..." class="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-pink-500 transition">
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Mariée</label>
                    <input formControlName="brideName" type="text" placeholder="Nom de la mariée..." class="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-pink-500 transition">
                  </div>
                </div>
              </div>
'''

    if 'formControlName="brideName"' not in content:
        if target_block_start in content:
            content = content.replace(target_block_start, html_to_insert + "\n" + target_block_start)
            with open(html_path, 'w') as f:
                f.write(content)
            print("✅ HTML mis à jour.")
        else:
            print("⚠️ Impossible de trouver l'endroit d'insertion dans le HTML.")
    else:
        print("ℹ️ Le HTML contient déjà les champs.")
except FileNotFoundError:
    print(f"❌ Fichier introuvable : {html_path}")

EOF

# Exécution
export MODEL_FILE
export TS_FILE
export HTML_FILE

python3 patch_maries.py

# Nettoyage
rm patch_maries.py

echo "🚀 Terminé !"