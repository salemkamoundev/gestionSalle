#!/bin/bash

# Fichier cible
TARGET_FILE="src/app/core/services/config.service.ts"

cat > $TARGET_FILE <<EOF
import { Injectable, inject, signal, computed, WritableSignal, Signal } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';
import { Subscription } from 'rxjs';

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

  // État initial vide, sera rempli par Firestore
  private _settings: WritableSignal<RoomGlobalSettings> = signal({
    creneaux: [] 
  });

  public readonly settings: Signal<RoomGlobalSettings> = this._settings.asReadonly();

  constructor() {
    this.loadSettings();
  }

  // Écoute en temps réel (Realtime)
  private loadSettings() {
    docData(this.configDocRef).pipe(
      map(data => {
        // Si le doc existe, on retourne les données, sinon un tableau vide
        return data ? (data as RoomGlobalSettings) : { creneaux: [] };
      })
    ).subscribe({
      next: (data) => {
        console.log('Configuration chargée depuis Firestore:', data.creneaux.length, 'créneaux');
        this._settings.set(data);
      },
      error: (err) => console.error('Erreur chargement config:', err)
    });
  }

  // Sauvegarde globale
  async updateSettings(newSettings: RoomGlobalSettings) {
    try {
      await setDoc(this.configDocRef, newSettings);
      // Pas besoin de this._settings.set() car le docData() le fera automatiquement
    } catch (e) {
      console.error('Erreur sauvegarde config:', e);
      throw e;
    }
  }

  // Méthodes utilitaires pour faciliter la gestion depuis les composants
  async addSlot(slot: TimeSlot) {
    const current = this._settings().creneaux;
    const updated = [...current, slot];
    await this.updateSettings({ creneaux: updated });
  }

  async deleteSlot(slotId: string) {
    const current = this._settings().creneaux;
    const updated = current.filter(s => s.id !== slotId);
    await this.updateSettings({ creneaux: updated });
  }
}
EOF

echo "ConfigService connecté à Firestore (config/general) !"