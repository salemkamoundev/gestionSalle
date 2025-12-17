import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

export const authGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const auth = inject(Auth);
  const router = inject(Router);

  // On écoute l'état de l'authentification (Observable)
  return authState(auth).pipe(
    take(1), // On prend juste la première valeur (connecté ou pas) et on complète
    map(user => {
      // Si un utilisateur existe, on laisse passer
      if (user) {
        return true;
      }
      // Sinon, on redirige vers le login
      return router.createUrlTree(['/login']);
    })
  );
};
