import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardKpi } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = `${environment.apiUrl}/dashboard`;
  constructor(private http: HttpClient) {}

  getKpis(): Observable<DashboardKpi> { return this.http.get<DashboardKpi>(`${this.base}/kpis`); }
}
