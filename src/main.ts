import { seedSeasonalSlots } from './app/seed-seasons';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

seedSeasonalSlots().then(() => bootstrapApplication(App, appConfig)).catch((err) => console.error(err));
