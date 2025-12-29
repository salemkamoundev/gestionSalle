#!/bin/bash

# --- CONFIGURATION ---
SEARCH_TEXT="Mes réservations" # Le texte exact visible dans le menu
ROUTES_FILE="src/app/app.routes.ts"

echo "🔍 Recherche de la page via le texte du menu : '$SEARCH_TEXT'..."

# 1. Trouver le fichier du menu (Sidebar ou Navbar)
MENU_FILE=$(grep -rFl "$SEARCH_TEXT" src/app --include="*.html")

if [ -z "$MENU_FILE" ]; then
  echo "❌ Erreur : Impossible de trouver le texte '$SEARCH_TEXT' dans les fichiers HTML."
  echo "   Vérifiez si le texte est écrit différemment (ex: 'Mes Réservations' ou dans un fichier de traduction)."
  exit 1
fi

echo "✅ Lien trouvé dans : $MENU_FILE"

# 2. Backup du fichier menu
cp "$MENU_FILE" "$MENU_FILE.bak"
echo "💾 Backup créé : $MENU_FILE.bak"

# 3. Supprimer le lien du menu
# On supprime la ligne contenant le texte (souvent un <li> ou un <a>)
echo "✂️  Suppression du lien dans l'interface..."
# Cette commande supprime la ligne contenant le texte "Mes réservations"
grep -v "$SEARCH_TEXT" "$MENU_FILE.bak" > "$MENU_FILE"

# 4. Tenter de trouver et désactiver la route
# On cherche si une route contient 'history' ou 'reservations' dans app.routes.ts
echo "🔍 Analyse des routes dans $ROUTES_FILE..."

if [ -f "$ROUTES_FILE" ]; then
    cp "$ROUTES_FILE" "$ROUTES_FILE.bak"
    
    # On cherche une ligne qui contient le path lié à l'historique ou réservation
    # Basé sur votre tree, c'est probablement 'history'
    if grep -q "path: 'history'" "$ROUTES_FILE"; then
        echo "⚠️  Route 'history' détectée."
        # On commente la ligne pour ne pas casser le fichier
        sed -i '' "s/path: 'history'/\/\/ path: 'history'/g" "$ROUTES_FILE" 2>/dev/null || sed -i "s/path: 'history'/\/\/ path: 'history'/g" "$ROUTES_FILE"
        echo "   -> Route désactivée (commentée)."
    elif grep -q "path: 'mes-reservations'" "$ROUTES_FILE"; then
        echo "⚠️  Route 'mes-reservations' détectée."
        sed -i '' "s/path: 'mes-reservations'/\/\/ path: 'mes-reservations'/g" "$ROUTES_FILE" 2>/dev/null || sed -i "s/path: 'mes-reservations'/\/\/ path: 'mes-reservations'/g" "$ROUTES_FILE"
        echo "   -> Route désactivée."
    else
        echo "ℹ️  Aucune route évidente trouvée automatiquement. Vérifiez $ROUTES_FILE manuellement."
    fi
fi

echo "--------------------------------------------------------"
echo "✅ Interface nettoyée. Le lien a disparu."
echo ""
echo "❓ Analyse pour la suppression des fichiers (Optionnel) :"
echo "   D'après votre arborescence, le code se trouve probablement ici :"
echo "   👉 src/app/features/history"
echo ""
echo "   Voulez-vous supprimer ce dossier ? (y/n)"
read -r REPONSE

if [ "$REPONSE" == "y" ]; then
    if [ -d "src/app/features/history" ]; then
        rm -rf "src/app/features/history"
        echo "🗑️  Dossier src/app/features/history supprimé."
    else
        echo "❌ Le dossier n'existe pas."
    fi
else
    echo "fichiers conservés."
fi

echo "--------------------------------------------------------"
echo "🚀 Terminé. Lancez 'ng build' pour vérifier."