import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {NgxMonacoEditorConfig, provideMonacoEditor} from 'ngx-monaco-editor-v2';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {AuthInterceptor} from './services/auth.interceptor';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeng/themes/aura';

const monacoConfig: NgxMonacoEditorConfig = {
  baseUrl: '/monaco/vs',
  defaultOptions: { theme: 'vs-dark' },
  onMonacoLoad: () => {
    console.log('🎉 Monaco is ready!', (window as any).monaco);
  },
};
export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideMonacoEditor(monacoConfig),		provideHttpClient(withInterceptorsFromDi()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.p-dark' },
      },
    }),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },]

};
