import { Injectable, signal, computed, WritableSignal, Signal } from '@angular/core';

export interface TimeSlot {
  id: string;      // Identifiant unique (ex: timestamp)
  label: string;   // ex: "Matinée", "Soirée"
  start: string;   // HH:mm
  end: string;     // HH:mm
}

export interface RoomGlobalSettings {
  creneaux: TimeSlot[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  
  // Configuration par défaut : 3 créneaux classiques
  private _settings: WritableSignal<RoomGlobalSettings> = signal({
    creneaux: [
      { id: '1', label: 'Matinée', start: '08:00', end: '12:00' },
      { id: '2', label: 'Après-midi', start: '13:00', end: '17:00' },
      { id: '3', label: 'Soirée', start: '19:00', end: '02:00' }
    ]
  });

  public readonly settings: Signal<RoomGlobalSettings> = this._settings.asReadonly();

  // Helper pour les dropdowns (affiche "Label (Start - End)")
  public readonly selectableOptions = computed(() => {
    return this.settings().creneaux.map(c => ({
      value: c.start, // On garde l'heure de début comme clé principale pour simplifier
      label: `${c.label} (${c.start} - ${c.end})`,
      fullObj: c
    }));
  });

  constructor() {}

  updateSettings(newSettings: RoomGlobalSettings) {
    this._settings.set(newSettings);
  }
}
