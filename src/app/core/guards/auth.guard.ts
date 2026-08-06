import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  inject(Router).navigate(['/auth/login']);
  return false;
};

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const allowed: string[] = route.data?.['roles'] ?? [];
  if (auth.isLoggedIn() && allowed.includes(auth.userRole() ?? '')) return true;
  inject(Router).navigate(['/dashboard']);
  return false;
};
