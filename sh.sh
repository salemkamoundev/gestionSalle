#!/bin/bash

# Fichier cible (version calendar)
TARGET="src/app/features/calendar/reservation-form/reservation-form.component.html"

if [ ! -f "$TARGET" ]; then
    echo "❌ Erreur : Le fichier $TARGET est introuvable."
    exit 1
fi

echo "🔧 Correction du binding de l'événement AdminConfirmDialog dans $TARGET..."

# Remplacement de la ligne erronée par les bons écouteurs d'événements
# On cherche la balise app-admin-confirm-dialog avec l'ancien attribut (close)
# Et on la remplace par la version avec (confirmed) et (cancelled)
perl -i -pe 's|<app-admin-confirm-dialog \*ngIf="showAdminAuth\(\)" \(close\)="\$event \? onAdminAuthSuccess\(\) : showAdminAuth\.set\(false\)"></app-admin-confirm-dialog>|<app-admin-confirm-dialog *ngIf="showAdminAuth()" (confirmed)="onAdminAuthSuccess()" (cancelled)="showAdminAuth.set(false)"></app-admin-confirm-dialog>|g' "$TARGET"

# Vérification simple
if grep -q "(confirmed)=" "$TARGET"; then
    echo "✅ SUCCÈS : Le popup de confirmation est maintenant correctement relié."
    echo "   (confirmed) -> onAdminAuthSuccess()"
    echo "   (cancelled) -> showAdminAuth.set(false)"
else
    echo "⚠️ ATTENTION : Le remplacement automatique n'a pas trouvé la ligne exacte."
    echo "   Tentative de remplacement plus large..."
    
    # Tentative de secours si le formatage différait légèrement
    perl -0777 -i -pe 's/<app-admin-confirm-dialog.*?>/<app-admin-confirm-dialog *ngIf="showAdminAuth()" (confirmed)="onAdminAuthSuccess()" (cancelled)="showAdminAuth.set(false)"><\/app-admin-confirm-dialog>/sg' "$TARGET"
    
    if grep -q "(confirmed)=" "$TARGET"; then
        echo "✅ SUCCÈS (Méthode 2) : Correction appliquée."
    else
        echo "❌ ÉCHEC : Impossible d'appliquer le correctif. Vérifiez le contenu du fichier manuellement."
    fi
fi