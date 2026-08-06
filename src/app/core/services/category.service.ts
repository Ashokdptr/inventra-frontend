import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private base = `${environment.apiUrl}/categories`;
  constructor(private http: HttpClient) {}

  // Tree: root categories with subcategories[]
  getAll(): Observable<Category[]> { return this.http.get<Category[]>(this.base); }

  // Flat list: every category with parentId/parentName (for product dropdowns)
  getAllFlat(): Observable<Category[]> { return this.http.get<Category[]>(`${this.base}/flat`); }

  // Subcategories of a parent
  getSubcategories(parentId: number): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/${parentId}/subcategories`);
  }

  create(req: { name: string; description?: string; parentId?: number }): Observable<Category> {
    return this.http.post<Category>(this.base, req);
  }
  update(id: number, req: { name: string; description?: string; parentId?: number | null }): Observable<Category> {
    return this.http.put<Category>(`${this.base}/${id}`, req);
  }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
