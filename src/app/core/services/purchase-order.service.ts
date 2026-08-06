import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PurchaseOrder } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private base = `${environment.apiUrl}/purchase-orders`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<PurchaseOrder[]> { return this.http.get<PurchaseOrder[]>(this.base); }
  getById(id: number): Observable<PurchaseOrder> { return this.http.get<PurchaseOrder>(`${this.base}/${id}`); }
  create(req: any): Observable<PurchaseOrder> { return this.http.post<PurchaseOrder>(this.base, req); }
  updateStatus(id: number, status: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/${id}/status`, { status });
  }
  updatePaymentStatus(id: number, paymentStatus: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/${id}/payment`, { paymentStatus });
  }
  supplierStatus(id: number, status: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/${id}/supplier-status`, { status });
  }
  supplierModify(id: number, req: { items: { itemId: number; quantity: number }[]; notes?: string }): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/${id}/supplier-modify`, req);
  }
}
