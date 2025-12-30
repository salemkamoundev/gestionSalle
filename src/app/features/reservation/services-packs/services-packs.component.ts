import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { ServiceCatalog } from '../../../core/models/service-catalog.model';

@Component({
  selector: 'app-services-packs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services-packs.component.html',
  styles: []
})
export class ServicesPacksComponent implements OnInit {
  private serviceCatalogService = inject(ServiceCatalogService);

  // Données
  services: ServiceCatalog[] = [];
  filteredServices: ServiceCatalog[] = [];
  
  // Champs de recherche (Autocomplete)
  searchTerm: string = '';
  showSuggestions: boolean = false;

  loading = true;

  ngOnInit() {
    this.loadServices();
  }

  loadServices() {
    this.loading = true;
    this.serviceCatalogService.getAll().subscribe({
      next: (data) => {
        // On ne garde que les services actifs (si la propriété active existe)
        this.services = data.filter(s => s.active !== false);
        this.filteredServices = this.services;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des services', err);
        this.loading = false;
      }
    });
  }

  // Méthode de filtrage (Autocomplete logic)
  filterServices() {
    if (!this.searchTerm) {
      this.filteredServices = this.services;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredServices = this.services.filter(s => 
        s.nom.toLowerCase().includes(term)
      );
    }
  }

  // Sélection d'un service
  selectService(service: ServiceCatalog) {
    console.log('Service sélectionné:', service);
    // Ajoutez ici la logique pour ajouter le service à la réservation
    // ex: this.reservationService.addService(service);
  }
}
