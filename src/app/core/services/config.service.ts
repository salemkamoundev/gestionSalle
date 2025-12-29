import { Injectable, inject, signal, WritableSignal, Signal } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { map, retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface TimeSlot {
  id: string;
  label: string;
  start: string;     // HH:mm
  end: string;       // HH:mm
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
  price: number;
}

export interface RoomGlobalSettings {
  creneaux: TimeSlot[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private firestore = inject(Firestore);
  
  // Référence vers le document unique de configuration
  private configDocRef = doc(this.firestore, 'config/general');

  // État initial vide
  private _settings: WritableSignal<RoomGlobalSettings> = signal({
    creneaux: [] 
  });

  public readonly settings: Signal<RoomGlobalSettings> = this._settings.asReadonly();

  constructor() {
    this.loadSettings();
  }

  // Écoute en temps réel avec tolérance aux pannes
  private loadSettings() {
    docData(this.configDocRef).pipe(
      // Si le document n'existe pas ou erreur, on renvoie une structure vide par défaut
      map(data => {
        return data ? (data as RoomGlobalSettings) : { creneaux: [] };
      }),
      // En cas d'erreur (ex: permissions temporairement bloquées), on réessaie 3 fois
      retry(3),
      catchError(err => {
        console.error('Erreur critique chargement config (vérifiez firestore.rules):', err);
        return of({ creneaux: [] } as RoomGlobalSettings);
      })
    ).subscribe({
      next: (data) => {
        // Mise à jour du signal seulement si les données changent
        this._settings.set(data);
      }
    });
  }

  async updateSettings(newSettings: RoomGlobalSettings) {
    try {
      await setDoc(this.configDocRef, newSettings);
      console.log('Configuration sauvegardée avec succès');
    } catch (e) {
      console.error('Erreur sauvegarde config:', e);
      throw e;
    }
  }
}
