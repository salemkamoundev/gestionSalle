#!/bin/bash

ROUTES_FILE="src/app/app.routes.ts"

if [ ! -f "$ROUTES_FILE" ]; then
    echo "❌ Fichier $ROUTES_FILE introuvable."
    exit 1
fi

echo "🛠️ Ajout de la route Chat dans app.routes.ts..."

python3 -c "
import sys

file_path = '$ROUTES_FILE'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

content = ''.join(lines)

# 1. Ajout de l'import si manquant
import_line = \"import { ChatComponent } from './features/admin/chat/chat.component';\n\"
if 'ChatComponent' not in content:
    lines.insert(0, import_line)

# 2. Ajout de la route dans les children du layout
new_route = \"      { path: 'admin/chat', component: ChatComponent, canActivate: [adminGuard] },\n\"
if \"path: 'admin/chat'\" not in content:
    # On cherche l'endroit après 'admin/config' pour l'insérer proprement
    for i, line in enumerate(lines):
        if \"path: 'admin/config'\" in line:
            # On cherche la fin de cet objet de route (la ligne qui contient '}')
            for j in range(i, len(lines)):
                if '}' in lines[j]:
                    lines.insert(j + 1, new_route)
                    break
            break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('✅ Route ajoutée avec succès !')
"

# Nettoyage du cache pour forcer Angular à voir la nouvelle route
rm -rf .angular/cache
echo "🚀 Terminé. Relancez 'ng serve' et le bouton fonctionnera désormais."