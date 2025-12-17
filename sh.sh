#!/bin/bash

# ==============================================================================
# TITRE : Fix Locale FR Error
# DESCRIPTION : Enregistrement des données locales 'fr' pour le DatePipe
# ==============================================================================

set -euo pipefail

# Couleurs
COLOR_RESET='\033[0m'
COLOR_SUCCESS='\033[0;32m'
COLOR_INFO='\033[0;36m'

log_info() { echo -e "${COLOR_INFO}[INFO] $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK] $1${COLOR_RESET}"; }

# Vérification racine
if [ ! -f "angular.json" ]; then
    echo "Erreur : Exécute ce script à la racine du projet."
    exit 1
fi

# ==============================================================================
# MISE À JOUR APP CONFIG
# ==============================================================================
log_info "Configuration de la locale FR dans app.config.ts..."

cat <<'EOF' > src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';

// --- IMPORTATION DE LA LOCALE FRANÇAISE ---
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Enregistrement global du français
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    
    // Définir le français comme langue par défaut de l'application
    { provide: LOCALE_ID, useValue: 'fr-FR' }
  ]
};
EOF

log_success "Locale 'fr' enregistrée avec succès !"
echo -e "${COLOR_INFO}👉 L'erreur NG0701 devrait disparaître et tes dates seront affichées en français.${COLOR_RESET}"