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
import { provideMessaging } from '@angular/fire/messaging';
import { getMessaging } from 'firebase/messaging';

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
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideMessaging(() => getMessaging()),
]
};
