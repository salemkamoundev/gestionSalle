import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { PushInitService } from './push/push-init.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App  implements OnInit {
  protected readonly title = signal('gestion-salle');
  constructor(
    private router: Router,
    private pushInit: PushInitService,
  ) {}
  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        // Run push init once after we are NOT on /login
        void this.pushInit.initOnce();
      });
  }
}
