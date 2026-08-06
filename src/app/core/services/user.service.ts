import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private base = `${environment.apiUrl}/users`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]>        { return this.http.get<User[]>(this.base); }
  getById(id: number): Observable<User> { return this.http.get<User>(`${this.base}/${id}`); }

  toggleActive(id: number): Observable<User> { return this.http.patch<User>(`${this.base}/${id}/toggle-active`, {}); }
  approve(id: number): Observable<User>       { return this.http.patch<User>(`${this.base}/${id}/approve`, {}); }
  reject(id: number): Observable<User>        { return this.http.patch<User>(`${this.base}/${id}/reject`, {}); }
  create(req: Record<string, unknown>): Observable<User> { return this.http.post<User>(this.base, req); }

  updateRole(id: number, roleName: string): Observable<User> {
    return this.http.patch<User>(`${this.base}/${id}/role`, { roleName });
  }
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword });
  }
  updateProfile(data: { name?: string; phone?: string; address?: string; department?: string }): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/auth/profile`, data);
  }
}
