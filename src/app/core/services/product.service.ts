import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductRequest } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private base = `${environment.apiUrl}/products`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Product[]> { return this.http.get<Product[]>(this.base); }

  getById(id: number): Observable<Product> { return this.http.get<Product>(`${this.base}/${id}`); }

  // Unified search: keyword can be name, SKU, or ID
  search(keyword?: string, categoryId?: number, supplierId?: number): Observable<Product[]> {
    let params = new HttpParams();
    if (keyword)    params = params.set('keyword', keyword);
    if (categoryId) params = params.set('categoryId', String(categoryId));
    if (supplierId) params = params.set('supplierId', String(supplierId));
    return this.http.get<Product[]>(`${this.base}/search`, { params });
  }

  create(req: ProductRequest): Observable<Product> { return this.http.post<Product>(this.base, req); }
  update(id: number, req: ProductRequest): Observable<Product> { return this.http.put<Product>(`${this.base}/${id}`, req); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
