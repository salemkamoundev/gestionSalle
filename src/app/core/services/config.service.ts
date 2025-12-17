import { Injectable, signal, computed, WritableSignal, Signal } from '@angular/core';

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
  
  // Exemple : Saison Basse vs Haute Saison
  private _settings: WritableSignal<RoomGlobalSettings> = signal({
    creneaux: [
      // Période Standard (Janvier - Mai)
      { id: '1', label: 'Soirée (Basse Saison)', start: '18:00', end: '02:00', validFrom: '2025-01-01', validTo: '2025-05-31', price: 1000 },
      // Période Été (Juin - Aout) - Plus cher
      { id: '2', label: 'Soirée (Haute Saison)', start: '18:00', end: '03:00', validFrom: '2025-06-01', validTo: '2025-08-31', price: 2500 },
      // Reste de l'année
      { id: '3', label: 'Soirée (Hiver)', start: '18:00', end: '02:00', validFrom: '2025-09-01', validTo: '2025-12-31', price: 1200 },
      // Matinées (Toute l'année)
      { id: '4', label: 'Matinée', start: '08:00', end: '12:00', validFrom: '2025-01-01', validTo: '2025-12-31', price: 400 }
    ]
  });

  public readonly settings: Signal<RoomGlobalSettings> = this._settings.asReadonly();

  constructor() {}

  updateSettings(newSettings: RoomGlobalSettings) {
    this._settings.set(newSettings);
  }
}
