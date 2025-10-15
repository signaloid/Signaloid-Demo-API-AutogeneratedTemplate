import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import {from, mergeMap, Observable} from 'rxjs';
import {SignaloidWrapperService} from './signaloid-wrapper.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private signaloidWrapper: SignaloidWrapperService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return from(this.signaloidWrapper.getAuthHeader()).pipe(
      mergeMap((authHeader) => {
        const authReq = authHeader?.headers ? req.clone({ setHeaders: authHeader.headers }) : req;
        console.log(authHeader);
        return next.handle(authReq);
      }),
    );
  }
}
 
