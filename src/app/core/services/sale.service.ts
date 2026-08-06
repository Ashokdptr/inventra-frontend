import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sale } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private base = `${environment.apiUrl}/sales`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Sale[]> { return this.http.get<Sale[]>(this.base); }
  getById(id: number): Observable<Sale> { return this.http.get<Sale>(`${this.base}/${id}`); }
  create(req: any): Observable<Sale> { return this.http.post<Sale>(this.base, req); }
  updatePaymentStatus(id: number, paymentStatus: string): Observable<Sale> {
    return this.http.patch<Sale>(`${this.base}/${id}/payment`, { paymentStatus });
  }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
