import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// --- IMPORTS FIREBASE ---
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

// --- IMPORT ENVIRONNEMENT ---
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // Optimisation Angular
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // Routing
    provideRouter(routes),

    // --- INIT FIREBASE ---
    // 1. Initialise l'app avec la config de environment.ts
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // 2. Fournit le service d'Authentification (C'est ce qui manquait !)
    provideAuth(() => getAuth()),
    
    // 3. Fournit la base de données Firestore
    provideFirestore(() => getFirestore())
  ]
};
