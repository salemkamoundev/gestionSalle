import { Component, OnInit , inject} from '@angular/core';
import { SeederService } from './core/services/seeder.service';

import { Router, NavigationEnd } from '@angular/router';

import { filter } from 'rxjs/operators';

import { PushInitService } from './push/push-init.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit{
  private seeder = inject(SeederService);

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
