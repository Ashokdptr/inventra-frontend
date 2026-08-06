import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Supplier, SupplierWarehouseStock } from '../models/models';
import { environment } from '../../../environments/environment';

export interface WarehouseStockRequest {
  productId: number;
  availableQuantity: number;
  costPrice?: number;
  supplierSku?: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private base = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.base);
  }

  getById(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.base}/${id}`);
  }

  create(req: Partial<Supplier>): Observable<Supplier> {
    return this.http.post<Supplier>(this.base, req);
  }

  update(id: number, req: Partial<Supplier>): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.base}/${id}`, req);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Own profile for SUPPLIER role */
  getMyProfile(): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.base}/me`);
  }

  /** Warehouse stock endpoints */
  getWarehouse(id: number): Observable<SupplierWarehouseStock[]> {
    return this.http.get<SupplierWarehouseStock[]>(
      `${this.base}/${id}/warehouse`
    );
  }

  /** Admin-only read endpoint */
  getWarehouseAsAdmin(id: number): Observable<SupplierWarehouseStock[]> {
    return this.http.get<SupplierWarehouseStock[]>(
      `${this.base}/${id}/warehouse/admin`
    );
  }

  getMyWarehouse(): Observable<SupplierWarehouseStock[]> {
    return this.http.get<SupplierWarehouseStock[]>(
      `${this.base}/me/warehouse`
    );
  }

  upsertMyWarehouse(
    req: WarehouseStockRequest
  ): Observable<SupplierWarehouseStock> {
    return this.http.put<SupplierWarehouseStock>(
      `${this.base}/me/warehouse`,
      req
    );
  }

  /** Admin warehouse update */
  upsertWarehouse(
    supplierId: number,
    req: WarehouseStockRequest
  ): Observable<SupplierWarehouseStock> {
    return this.http.put<SupplierWarehouseStock>(
      `${this.base}/${supplierId}/warehouse`,
      req
    );
  }
}