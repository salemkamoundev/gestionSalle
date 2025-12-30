import { forceResetConfig } from './app/reset-config';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

forceResetConfig().then(() => bootstrapApplication(App, appConfig)).catch((err) => console.error(err));
