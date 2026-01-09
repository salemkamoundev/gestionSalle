#!/bin/bash

echo "🔒 Sécurisation de l'authentification Admin..."

# 1. Correction du AuthService (src/app/core/services/auth.service.ts)
# On remplace la méthode 'verifyAdminPassword' factice par une vraie vérification Firebase.
cat << 'EOF' > src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed, Signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { NotificationService } from './notification.service';

export type UserRole = 'ADMIN' | 'SERVER' | null;

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  
  private user$ = user(this.auth);

  userState: Signal<AppUser | null | undefined> = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        if (u.email?.toLowerCase() === 'admin@gmail.com') {
          return { uid: u.uid, email: u.email, role: 'ADMIN', displayName: u.displayName || 'Admin' } as AppUser;
        }
        const snap = await getDoc(doc(this.firestore, `users/${u.uid}`));
        if (snap.exists()) {
           const data = snap.data();
           return { uid: u.uid, email: u.email, role: (data['role'] as UserRole) || 'SERVER', displayName: data['nom'] || u.displayName } as AppUser;
        }
        return { uid: u.uid, email: u.email, role: 'SERVER', displayName: u.displayName } as AppUser;
      })
    ),
    { initialValue: undefined }
  );

  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  currentUser(): AppUser | null | undefined {
    return this.userState();
  }

  async login(email: string, pass: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, pass);
    const uid = cred.user.uid;

    try {
      await setDoc(doc(this.firestore, `users/${uid}`), { 
        email: email 
      }, { merge: true });
    } catch (e) {
      console.error('❌ [AuthService] Erreur sauvegarde email:', e);
    }

    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        await this.notificationService.ensurefcmTokensForUser(uid);
      }
    } catch(e) { console.warn("FCM init skipped", e); }

    let route = '/my-planning';
    if (email.toLowerCase() === 'admin@gmail.com') route = '/dashboard';
    else {
       const snap = await getDoc(doc(this.firestore, `users/${uid}`));
       if (snap.exists() && snap.data()['role'] === 'ADMIN') route = '/dashboard';
    }
    this.router.navigate([route]);
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  async verifyPassword(password: string): Promise<boolean> {
    const u = this.auth.currentUser;
    if (!u || !u.email) return false;
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
      return true;
    } catch { return false; }
  }

  // --- CORRECTION DE SÉCURITÉ ---
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const targetEmail = 'admin@gmail.com';
      const currentUser = this.auth.currentUser;

      // Cas 1 : L'utilisateur est déjà connecté en tant qu'admin@gmail.com
      // On vérifie simplement que le mot de passe correspond à la session active (Ré-authentification)
      if (currentUser?.email?.toLowerCase() === targetEmail) {
        const cred = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, cred);
        return true;
      } 
      
      // Cas 2 : Un autre utilisateur tente une action Admin (ou session expirée)
      // On tente une connexion explicite sur le compte Admin
      // ATTENTION : Cela connectera l'utilisateur en tant qu'Admin s'il réussit
      await signInWithEmailAndPassword(this.auth, targetEmail, password);
      return true;

    } catch (e) {
      console.error('❌ Echec authentification Admin:', e);
      return false;
    }
  }
}
EOF

# 2. Correction du Dialog (src/app/shared/components/admin-confirm-dialog/admin-confirm-dialog.component.ts)
# Suppression du fallback "password === 'admin'" qui permettait de contourner la sécurité.
cat << 'EOF' > src/app/shared/components/admin-confirm-dialog/admin-confirm-dialog.component.ts
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './admin-confirm-dialog.component.html'
})
export class AdminConfirmDialogComponent {
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private authService = inject(AuthService);

  password = '';
  loading = false;
  errorMessage = '';

  async onConfirm() {
    this.errorMessage = '';
    
    if (!this.password) {
      this.errorMessage = 'Veuillez entrer le mot de passe.';
      return;
    }

    this.loading = true;

    try {
      // Appel direct au service sécurisé
      const isValid = await this.authService.verifyAdminPassword(this.password);
      
      if (isValid) {
        this.confirmed.emit();
      } else {
        this.errorMessage = 'Mot de passe incorrect.';
        this.loading = false;
      }
    } catch (e) {
      console.error('Erreur Auth:', e);
      this.errorMessage = 'Erreur technique. Réessayez.';
      this.loading = false;
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
}
EOF

echo "✅ Fichiers mis à jour avec la logique d'authentification stricte."