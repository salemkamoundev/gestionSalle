#!/bin/bash

# 1. Correction de l'erreur bloquante dans ClientFormComponent
TS_FILE="src/app/features/clients/client-form/client-form.component.ts"

echo "🛠 Correction de ClientFormComponent (Ajout de 'today')..."

cat > "$TS_FILE" << 'EOF'
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client-form.component.html',
  styles: []
})
export class ClientFormComponent implements OnInit {
  @Input() isModal = false; 
  @Input() clientId: string | null = null;
  @Output() finish = new EventEmitter<any>();

  fb = inject(FormBuilder);
  clientService = inject(ClientService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  ui = inject(UiService);
  location = inject(Location);

  form: FormGroup;
  isEditMode = false;
  loading = false;
  
  // ✅ Variable nécessaire pour le HTML [max]="today"
  today = new Date();

  constructor() {
    const phonePattern = '^[0-9]{8}$';
    const identityPattern = '^(\\d{8}|(?=.*[a-zA-Z])[a-zA-Z0-9]{6,12})$';

    this.form = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      telephone: ['', [Validators.required, Validators.pattern(phonePattern)]],
      telephone2: ['', [Validators.pattern(phonePattern)]], 
      email: ['', [Validators.email]],
      adresse: [''],
      ville: [''],
      cin: ['', [Validators.required, Validators.pattern(identityPattern)]],
      // Validation : Date <= Aujourd'hui
      dateCin: ['', [Validators.required, (c: AbstractControl) => {
        if (!c.value) return null;
        const selected = new Date(c.value);
        const today = new Date();
        today.setHours(0,0,0,0);
        return selected > today ? { futureDate: true } : null;
      }]],
      prenomMarie1: [''],
      prenomMarie2: [''],
      notes: ['']
    });
  }

  async ngOnInit() {
    const idFromRoute = this.route.snapshot.paramMap.get('id');
    const targetId = this.clientId || idFromRoute;

    if (targetId) {
      this.clientId = targetId; 
      this.isEditMode = true;
      await this.loadClient(targetId);
    }
  }

  async loadClient(id: string) {
    this.loading = true;
    try {
      this.clientService.getClient(id).subscribe(data => {
        if (data) this.form.patchValue(data);
      });
    } catch (e) { console.error(e); }
    this.loading = false;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    
    const clientData = this.form.value;
    
    // Vérification des doublons
    try {
        const clients = await firstValueFrom(this.clientService.getAll());
        
        const duplicatePhone = clients.find((c: any) => 
            c.telephone === clientData.telephone && c.id !== this.clientId
        );

        if (duplicatePhone) {
            this.ui.showToast('error', 'Ce numéro de téléphone existe déjà !');
            this.loading = false;
            return;
        }

        const duplicateCin = clients.find((c: any) => 
            c.cin === clientData.cin && c.id !== this.clientId
        );

        if (duplicateCin) {
            this.ui.showToast('error', 'Ce CIN ou Passeport est déjà enregistré !');
            this.loading = false;
            return;
        }

    } catch (e) {
        console.warn('Impossible de vérifier les doublons', e);
    }

    try {
      let res;
      if (this.isEditMode && this.clientId) {
        await this.clientService.updateClient(this.clientId, clientData);
        res = { id: this.clientId, ...clientData };
        this.ui.showToast('success', 'Client mis à jour');
      } else {
        const docRef = await this.clientService.addClient(clientData);
        res = { id: docRef.id, ...clientData };
        this.ui.showToast('success', 'Client créé');
      }

      if (this.isModal) {
        this.finish.emit(res);
      } else {
        this.router.navigate(['/admin/clients']);
      }
    } catch (error) {
      this.ui.showToast('error', 'Erreur lors de l\'enregistrement');
    }
    this.loading = false;
  }

  onCancel() {
    if (this.isModal) {
      this.finish.emit(null);
    } else {
      this.location.back();
    }
  }
}
EOF

# 2. Correction du Warning Dashboard (RouterLink inutilisé)
# On tente de le retirer proprement avec sed (version compatible Mac)
DASHBOARD_FILE="src/app/features/dashboard/dashboard.component.ts"
if [ -f "$DASHBOARD_FILE" ]; then
    echo "🧹 Nettoyage de DashboardComponent..."
    # Supprime 'RouterLink,' des imports
    sed -i '' 's/RouterLink, //g' "$DASHBOARD_FILE"
    # Au cas où il est à la fin ou seul
    sed -i '' 's/, RouterLink//g' "$DASHBOARD_FILE"
fi

echo "✅ Correctifs appliqués. L'application devrait compiler maintenant."