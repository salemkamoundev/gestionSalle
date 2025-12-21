/**
 * Helper: enregistre /firebase-messaging-sw.js au scope "/"
 * et retourne la ServiceWorkerRegistration à passer à getToken().
 *
 * Usage (Firebase v9+):
 *   const reg = await ensureFcmServiceWorker();
 *   const token = await getToken(messaging, {
 *     vapidKey: environment.firebase.vapidKey,
 *     serviceWorkerRegistration: reg,
 *   });
 */
export async function ensureFcmServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers non supportés par ce navigateur.');
  }

  // On vise le scope racine pour éviter les scopes trop limités
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;

  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
}
