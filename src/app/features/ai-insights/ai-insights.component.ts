import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { AiInsightsService } from '../../core/services/ai-insights.service';
import { Prediction, ReorderSuggestion } from '../../core/models/models';

@Component({
  selector: 'app-ai-insights',
  standalone: true,
  imports: [],
  templateUrl: './ai-insights.component.html',
  styleUrl: './ai-insights.component.css'
})
export class AiInsightsComponent implements OnInit {
  private svc = inject(AiInsightsService);

  predictions = signal<Prediction[]>([]);
  suggestions = signal<ReorderSuggestion[]>([]);
  loading     = signal(true);
  running     = signal(false);
  activeTab   = signal<'predictions' | 'suggestions'>('predictions');

  highDemandCount = computed(() => this.predictions().filter(p => (p.predictedDemand || 0) > 10).length);
  avgAccuracy     = computed(() => {
    const ps = this.predictions();
    if (!ps.length) return 92;
    const sum = ps.reduce((s, p) => s + ((p as any).confidence || 72), 0);
    return Math.round(sum / ps.length);
  });

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.svc.getPredictions().subscribe({ next: d => this.predictions.set(d), error: () => {} });
    this.svc.getSuggestions().subscribe({
      next: d => { this.suggestions.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setTab(t: 'predictions' | 'suggestions'): void { this.activeTab.set(t); }

  runPredictions(): void {
    this.running.set(true);
    this.svc.runPredictions().subscribe({
      next: d => { this.predictions.set(d); this.running.set(false); },
      error: () => this.running.set(false)
    });
  }

  runSuggestions(): void {
    this.running.set(true);
    this.svc.runSuggestions().subscribe({
      next: d => { this.suggestions.set(d); this.running.set(false); },
      error: () => this.running.set(false)
    });
  }

  action(id: number): void {
    this.svc.actionSuggestion(id).subscribe(() => this.loadAll());
  }

  confidenceClass(score: number): string {
    return score >= 0.7 ? 'high' : score >= 0.5 ? 'mid' : 'low';
  }
}
