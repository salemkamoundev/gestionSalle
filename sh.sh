#!/bin/bash

echo "🚀 Passage des Packs en mode Dynamique (Firestore)..."

# --- 1. REFONTE DU SERVICE PACK (Dynamique) ---
# On écrase le fichier actuel pour y mettre la logique Firestore
cat > src/app/core/services/pack.service.ts <<EOF
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Pack } from '../models/pack.model';

@Injectable({
  providedIn: 'root'
})
export class PackService {
  private firestore = inject(Firestore);
  private collectionName = 'packs';

  // Récupère tous les packs en temps réel
  getAll(): Observable<Pack[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }) as Observable<Pack[]>;
  }

  // Récupère un pack spécifique
  getById(id: string): Observable<Pack | undefined> {
    const docRef = doc(this.firestore, \`\${this.collectionName}/\${id}\`);
    return docData(docRef, { idField: 'id' }) as Observable<Pack>;
  }

  // Ajoute un pack dans Firestore
  add(pack: Pack): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    // On retire l'ID s'il est présent pour laisser Firestore le générer
    const { id, ...data } = pack;
    return addDoc(colRef, data).then(() => {}); 
  }

  // Met à jour un pack
  update(id: string, pack: Partial<Pack>): Promise<void> {
    const docRef = doc(this.firestore, \`\${this.collectionName}/\${id}\`);
    return updateDoc(docRef, pack);
  }

  // Supprime un pack
  delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, \`\${this.collectionName}/\${id}\`);
    return deleteDoc(docRef);
  }
}
EOF
echo "✅ src/app/core/services/pack.service.ts a été converti vers Firestore."

# --- 2. MISE A JOUR DU COMPOSANT RESERVATION ---
RES_FORM_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"

if [ -f "$RES_FORM_FILE" ]; then
    echo "🔧 Mise à jour de ReservationFormComponent..."

    # 1. Ajouter l'import de PackService si manquant (après l'import de TeamService)
    if ! grep -q "import { PackService }" "$RES_FORM_FILE"; then
        sed -i "/import { TeamService }/a import { PackService } from '../../../core/services/pack.service';" "$RES_FORM_FILE"
    fi

    # 2. Injecter PackService (après l'injection de TeamService)
    if ! grep -q "private packService" "$RES_FORM_FILE"; then
        sed -i "/private teamService/a \ \ private packService = inject(PackService);" "$RES_FORM_FILE"
    fi

    # 3. Remplacer l'appel teamService.getPacks() par packService.getAll()
    # Cela corrige à la fois la variable 'packs$' et l'appel dans 'ngOnInit'
    sed -i "s/this.teamService.getPacks()/this.packService.getAll()/g" "$RES_FORM_FILE"
    
    echo "✅ ReservationFormComponent utilise maintenant PackService."
else
    echo "⚠️  Fichier $RES_FORM_FILE introuvable."
fi

echo "🎉 Opération terminée ! Les packs sont maintenant synchronisés avec Firestore."