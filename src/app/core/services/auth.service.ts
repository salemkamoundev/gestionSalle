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
