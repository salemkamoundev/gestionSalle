import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { map, switchMap, take } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap(user => {
      // 1. Pas connecté ? -> Login
      if (!user) {
        return of(router.createUrlTree(['/login']));
      }

      // 2. Cas spécial Admin Hardcodé (pour éviter d'attendre Firestore)
      if (user.email?.toLowerCase() === 'admin@gmail.com') {
        return of(true);
      }

      // 3. Vérification Firestore
      const userDocRef = doc(firestore, `users/${user.uid}`);
      return docData(userDocRef).pipe(
        take(1),
        map((userData: any) => {
          // Si le rôle est ADMIN, c'est bon
          if (userData && userData.role === 'ADMIN') {
            return true;
          }
          // Sinon, on redirige vers le planning Staff
          return router.createUrlTree(['/my-planning']);
        })
      );
    })
  );
};
