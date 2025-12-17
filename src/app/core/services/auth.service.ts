import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

export type UserRole = 'ADMIN' | 'SERVER' | null;

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private user$ = user(this.auth);

  userState = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        
        // --- HARDCODE POUR DÉVELOPPEMENT ---
        if (u.email?.toLowerCase() === 'admin@gmail.com') {
          return { uid: u.uid, email: u.email, role: 'ADMIN' } as AppUser;
        }
        // -----------------------------------

        const userDocRef = doc(this.firestore, `users/${u.uid}`);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.data();
        
        return {
          uid: u.uid,
          email: u.email,
          role: (userData?.['role'] as UserRole) || 'SERVER'
        } as AppUser;
      })
    ),
    { initialValue: undefined }
  );

  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  async login(email: string, pass: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, pass);
    this.router.navigate(['/']); 
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  // Vérifie le mot de passe sans déconnecter l'utilisateur
  async verifyPassword(password: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user || !user.email) return false;

    try {
      // On crée un "Credential" avec l'email actuel et le mot de passe fourni
      const credential = EmailAuthProvider.credential(user.email, password);
      // On tente de ré-authentifier
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error) {
      console.error('Erreur vérification mot de passe', error);
      return false;
    }
  }
}
