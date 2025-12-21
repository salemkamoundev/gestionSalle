import { Injectable, inject, signal, computed, Signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { NotificationService } from './notification.service';

export type UserRole = 'ADMIN' | 'SERVER' | null;

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  // Observable source (Firebase User)
  private user$ = user(this.auth);

  // CORRECTION ICI : Typage explicite du Signal pour inclure 'role'
  userState: Signal<AppUser | null | undefined> = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        
        // 1. Admin Hardcodé
        if (u.email?.toLowerCase() === 'admin@gmail.com') {
          return { uid: u.uid, email: u.email, role: 'ADMIN' } as AppUser;
        }

        // 2. Récupération du rôle depuis Firestore
        const userDocRef = doc(this.firestore, `users/${u.uid}`);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
           const userData = userSnap.data();
           return {
             uid: u.uid,
             email: u.email,
             role: (userData['role'] as UserRole) || 'SERVER'
           } as AppUser;
        } else {
           // Rôle par défaut
           return { uid: u.uid, email: u.email, role: 'SERVER' } as AppUser;
        }
      })
    ),
    { initialValue: undefined }
  );

  // Computed signals basés sur le userState typé
  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  async login(email: string, pass: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, pass);
    
    
    // Demande d'autorisation notifications + token FCM juste après login
    const uid = cred?.user?.uid;
    if (uid && (typeof window !== "undefined") && ("Notification" in window) && Notification.permission === "default") {
      try {
        await this.notificationService.ensurefcmTokensForUser(uid);} catch (e) {
        console.warn('[FCM] Permission/token échoué (non bloquant)', e);
      }
    }
// Redirection optimiste
    let targetRoute = '/my-planning';
    
    if (email.toLowerCase() === 'admin@gmail.com') {
      targetRoute = '/dashboard';
    } else {
      // Petite vérification rapide pour rediriger au bon endroit
      const snap = await getDoc(doc(this.firestore, `users/${cred.user.uid}`));
      if (snap.exists() && snap.data()['role'] === 'ADMIN') {
        targetRoute = '/dashboard';
      }
    }

    // Demande l'autorisation des notifications juste après login
    // (doit être déclenché par une action utilisateur : le clic 'Login' est OK)
    try {
      const uid = cred?.user?.uid;
      if (uid) {
        await this.notificationService.ensurefcmTokensForUser(uid);
      }
    } catch (e) {
      console.warn('[AuthService] Notifications permission/token failed', e);
    }

    
    this.router.navigate([targetRoute]);
}

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
}

  async verifyPassword(password: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user || !user.email) return false;

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (e) {
      console.error('Erreur vérification mot de passe', e);
      return false;
    }
  }
}
