import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';

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

  // Observable source
  private user$ = user(this.auth);

  // Signal réactif pour l'UI
  userState = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        
        // ADMIN HARDCODÉ
        if (u.email?.toLowerCase() === 'admin@gmail.com') {
          return { uid: u.uid, email: u.email, role: 'ADMIN' } as AppUser;
        }

        // FETCH FIRESTORE
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
           return { uid: u.uid, email: u.email, role: 'SERVER' } as AppUser;
        }
      })
    ),
    { initialValue: undefined } // Important: undefined au départ signifie "chargement"
  );

  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  async login(email: string, pass: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, pass);
    
    // REDIRECTION INTELLIGENTE IMMÉDIATE
    // On vérifie le rôle nous-même ici pour aller plus vite que le signal
    let targetRoute = '/my-planning'; // Par défaut Staff

    if (email.toLowerCase() === 'admin@gmail.com') {
      targetRoute = '/dashboard';
    } else {
      // Petite verif Firestore rapide
      const snap = await getDoc(doc(this.firestore, `users/${cred.user.uid}`));
      if (snap.exists() && snap.data()['role'] === 'ADMIN') {
        targetRoute = '/dashboard';
      }
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
    } catch (error) { return false; }
  }
}
