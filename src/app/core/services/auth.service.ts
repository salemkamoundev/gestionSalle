import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, User, reauthenticateWithCredential, EmailAuthProvider } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  userState = toSignal(user(this.auth));

  async login(email: string, pass: string) {
    return await signInWithEmailAndPassword(this.auth, email, pass);
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  // NOUVELLE MÉTHODE : Vérifie le mot de passe de l'utilisateur actuel
  async verifyPassword(password: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user || !user.email) return false;

    try {
      // On crée les crédentials avec l'email actuel et le mot de passe saisi
      const credential = EmailAuthProvider.credential(user.email, password);
      // On tente de ré-authentifier
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (e) {
      console.error('Erreur vérification mot de passe', e);
      return false;
    }
  }
}
