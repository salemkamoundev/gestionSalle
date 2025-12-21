import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  // 👇 C'est ICI que ça corrige les erreurs NG8002 et NG8103
  imports: [
    CommonModule,          
    ReactiveFormsModule,   
    RouterModule           
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    // 1. Validation basique
    if (this.loginForm.invalid) return;

    // 2. DÉMARRAGE DU CHARGEMENT
    this.isLoading = true;
    this.errorMessage = null;

    const { email, password } = this.loginForm.value;

    try {
      console.log("Tentative de connexion avec:", email);
      
      // 3. Appel Firebase
      await this.afAuth.setPersistence('local');
      await this.afAuth.signInWithEmailAndPassword(email, password);
      
      console.log("Connexion réussie ! Redirection...");
      this.router.navigate(['/']); 

    } catch (error: any) {
      // 4. ARRÊT DU CHARGEMENT (C'est cette ligne qui manquait ou qui échouait)
      this.isLoading = false; 
      
      console.error("ERREUR LOGIN:", error);

      // 5. Affichage du message
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-email':
          this.errorMessage = "Email ou mot de passe incorrect.";
          break;
        case 'auth/too-many-requests':
          this.errorMessage = "Trop de tentatives. Réessayez plus tard.";
          break;
        case 'auth/network-request-failed':
          this.errorMessage = "Pas de connexion internet.";
          break;
        default:
          this.errorMessage = "Erreur: " + error.message;
      }
    }
  }
}
