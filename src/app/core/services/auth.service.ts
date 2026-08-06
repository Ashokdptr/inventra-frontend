import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterResponse } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'inv_token';
  private readonly USER_KEY  = 'inv_user';

  private _user = signal<AuthResponse | null>(this.loadUser());
  currentUser   = this._user.asReadonly();
  isLoggedIn    = computed(() => !!this._user());
  userRole      = computed(() => this._user()?.role ?? null);
  userName      = computed(() => this._user()?.name ?? '');
  isAdmin       = computed(() => this._user()?.role === 'ADMIN');
  isManager     = computed(() => ['ADMIN','MANAGER'].includes(this._user()?.role ?? ''));

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req)
      .pipe(tap(res => this.persist(res)));
  }

  register(req: { name: string; email: string; password: string; phone?: string; department?: string; role?: string }): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, req);
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, { token, newPassword });
  }

  requestOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/otp/request`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/otp/verify`, { email, otp });
  }

  deleteOwnAccount(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/auth/account`);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  getApiBase(): string      { return environment.apiUrl.replace('/api/v1', ''); }
  hasRole(...roles: string[]): boolean { return roles.includes(this._user()?.role ?? ''); }

  updateCurrentUser(patch: Partial<{ name: string; phone: string; address: string; department: string }>): void {
    const cur = this._user();
    if (!cur) return;
    const updated = { ...cur, ...patch };
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    this._user.set(updated);
  }

  persist(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res));
    this._user.set(res);
  }

  private loadUser(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
