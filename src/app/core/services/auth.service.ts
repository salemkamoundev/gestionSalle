import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
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

  // Observable de l'état Auth Firebase brut
  private user$ = user(this.auth);

  // Signal dérivé qui récupère le rôle dans Firestore
  userState = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        
        // Récupération du rôle dans Firestore
        const userDocRef = doc(this.firestore, `users/${u.uid}`);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.data();
        
        return {
          uid: u.uid,
          email: u.email,
          role: (userData?.['role'] as UserRole) || 'SERVER' // Default role
        } as AppUser;
      })
    ),
    { initialValue: undefined } // undefined = loading
  );

  // Helpers
  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  async login(email: string, pass: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.router.navigate(['/']); 
    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  hasRole(role: UserRole): boolean {
    return this.userState()?.role === role;
  }
}
