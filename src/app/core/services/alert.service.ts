import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Alert } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private base = `${environment.apiUrl}/alerts`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Alert[]>    { return this.http.get<Alert[]>(this.base); }
  getUnread(): Observable<Alert[]> { return this.http.get<Alert[]>(`${this.base}/unread`); }
  getUnreadCount(): Observable<{ unreadCount: number }> { return this.http.get<{ unreadCount: number }>(`${this.base}/count`); }
  markRead(id: number): Observable<Alert> { return this.http.patch<Alert>(`${this.base}/${id}/read`, {}); }
  markAllRead(): Observable<void>  { return this.http.patch<void>(`${this.base}/read-all`, {}); }
}
