import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InventoryItem, StockMovement, StockAdjustRequest } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private base = `${environment.apiUrl}/inventory`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<InventoryItem[]>      { return this.http.get<InventoryItem[]>(this.base); }
  getLowStock(): Observable<InventoryItem[]> { return this.http.get<InventoryItem[]>(`${this.base}/low-stock`); }
  getOutOfStock(): Observable<InventoryItem[]> { return this.http.get<InventoryItem[]>(`${this.base}/out-of-stock`); }
  getMovements(): Observable<StockMovement[]>  { return this.http.get<StockMovement[]>(`${this.base}/movements`); }
  adjustStock(req: StockAdjustRequest): Observable<InventoryItem> { return this.http.post<InventoryItem>(`${this.base}/adjust`, req); }
}
