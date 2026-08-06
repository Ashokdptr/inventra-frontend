import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Prediction, ReorderSuggestion } from '../models/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private base = `${environment.apiUrl}/ai-insights`;
  constructor(private http: HttpClient) {}

  getPredictions(): Observable<Prediction[]>         { return this.http.get<Prediction[]>(`${this.base}/predictions`); }
  getSuggestions(): Observable<ReorderSuggestion[]>  { return this.http.get<ReorderSuggestion[]>(`${this.base}/suggestions`); }
  runPredictions(): Observable<Prediction[]>         { return this.http.post<Prediction[]>(`${this.base}/predictions/run`, {}); }
  runSuggestions(): Observable<ReorderSuggestion[]>  { return this.http.post<ReorderSuggestion[]>(`${this.base}/suggestions/run`, {}); }
  actionSuggestion(id: number): Observable<void>     { return this.http.patch<void>(`${this.base}/suggestions/${id}/action`, {}); }
}
