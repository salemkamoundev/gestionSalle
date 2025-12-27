import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// CORRECTION DES IMPORTS ICI (3 niveaux)
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
  @Output() finish = new EventEmitter<any>();

  fb = inject(FormBuilder);
  clientService = inject(ClientService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  ui = inject(UiService);
  location = inject(Location);

  form: FormGroup;
  isEditMode = false;
  clientId: string | null = null;
  loading = false;

  constructor() {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      telephone: ['', [Validators.required, Validators.pattern('^[0-9 ]*$')]],
      telephone2: ['', [Validators.pattern('^[0-9 ]*$')]], 
      email: ['', [Validators.email]],
      adresse: [''],
      ville: [''],
      cin: [''],
      // On garde ces champs dans le formulaire même s'ils ne sont pas affichés dans le HTML pour ne pas perdre la donnée
      dateCin: [''],
      prenomMarie1: [''],
      prenomMarie2: [''],
      notes: ['']
    });
  }

  async ngOnInit() {
    if (!this.isModal) {
      this.clientId = this.route.snapshot.paramMap.get('id');
      if (this.clientId) {
        this.isEditMode = true;
        await this.loadClient(this.clientId);
      }
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
    if (this.form.invalid) return;
    this.loading = true;
    
    const clientData = this.form.value;
    
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
