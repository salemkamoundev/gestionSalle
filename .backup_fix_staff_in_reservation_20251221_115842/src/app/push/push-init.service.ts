import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PushInitService {
  private readonly sessionKey = 'push_init_ran_v1';

  constructor(private router: Router) {}

  /**
   * Prevents infinite loops:
   * - never runs on /login
   * - runs only once per tab/session
   * - does NOT reload or navigate
   */
  async initOnce(): Promise<void> {
    try {
      // Already ran in this tab/session
      if (sessionStorage.getItem(this.sessionKey) === '1') return;

      const url = this.router.url || '';
      if (url.includes('/login') || url === '/login') return;

      // Mark as ran early to avoid loops if something throws during init
      sessionStorage.setItem(this.sessionKey, '1');

      // If Notifications not supported, bail quietly
      if (!('Notification' in window)) return;

      // IMPORTANT: do not call requestPermission here unless you really want prompt outside login.
      // If you want prompting, do it only after user action (button) to reduce browser quirks.
      // Here we just "observe" permission state and exit.
      const perm = Notification.permission; // 'default' | 'granted' | 'denied'
      // If you must request permission automatically (not recommended), uncomment carefully:
      // if (perm === 'default') await Notification.requestPermission();

      // Place your FCM token retrieval here IF you already have permission granted,
      // but do not redirect/reload.
      // Example (pseudo):
      // if (Notification.permission === 'granted') { ... getToken ... }
    } catch (e) {
      // Never throw to avoid breaking routing; prevent loops
      console.warn('[PushInitService] initOnce error:', e);
    }
  }
}
