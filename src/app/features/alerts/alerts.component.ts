import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { Alert } from '../../core/models/models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [SlicePipe, RouterLink],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css'
})
export class AlertsComponent implements OnInit {
  private svc = inject(AlertService);

  alerts  = signal<Alert[]>([]);
  loading = signal(true);

  lowStockAlerts    = computed(() => this.alerts().filter(a => a.alertType === 'LOW_STOCK').length);
  outOfStockAlerts  = computed(() => this.alerts().filter(a => a.alertType === 'OUT_OF_STOCK').length);
  reorderSoonAlerts = computed(() => this.alerts().filter(a => a.alertType === 'REORDER_SOON').length);
  resolvedAlerts    = computed(() => this.alerts().filter(a => a.isRead).length);

  topLowStockItems = computed(() =>
    this.alerts().filter(a => a.alertType === 'LOW_STOCK' || a.alertType === 'OUT_OF_STOCK').slice(0, 6)
  );

  alertTrendPoints = computed(() => {
    const days = Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate()-(6-i));
      return { date:d.toISOString().slice(0,10), label:d.toLocaleDateString('en-IN',{weekday:'short'}) };
    });
    const counts = days.map(d => ({ label:d.label, count:this.alerts().filter(a=>(a.createdAt||'').startsWith(d.date)).length }));
    const max = Math.max(1,...counts.map(c=>c.count));
    const W=440,H=100,PL=30,PT=10,PB=18;
    return counts.map((c,i) => ({ x:PL+(i/(counts.length-1||1))*(W-PL), y:PT+(1-c.count/max)*(H-PT-PB), label:c.label, count:c.count }));
  });

  alertLinePath = computed(() => {
    const pts=this.alertTrendPoints();
    if(pts.length<2) return '';
    return pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  alertAreaPath = computed(() => {
    const pts=this.alertTrendPoints();
    if(pts.length<2) return '';
    const H=100,PB=18;
    const line=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return line+` L${pts[pts.length-1].x.toFixed(1)},${(H-PB).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-PB).toFixed(1)} Z`;
  });

  alertGridY = computed(() => {
    const H=100,PT=10,PB=18;
    return [0.75,0.5,0.25].map(p=>PT+(1-p)*(H-PT-PB));
  });

  severityBreakdown = computed(() => {
    const total=this.alerts().length||1;
    return [
      {label:'Critical', color:'#ef4444', type:'OUT_OF_STOCK'},
      {label:'High',     color:'#f59e0b', type:'LOW_STOCK'},
      {label:'Medium',   color:'#3b82f6', type:'REORDER_SOON'}
    ].map(s => ({...s, count:this.alerts().filter(a=>a.alertType===s.type).length, pct:Math.round(this.alerts().filter(a=>a.alertType===s.type).length/total*100)}));
  });

  severityDonut = computed(() => {
    const rows=this.severityBreakdown();
    const total=this.alerts().length||1;
    let cum=0;
    const stops=rows.map(r=>{const start=cum;cum+=(r.count/total)*100;return `${r.color} ${start.toFixed(1)}% ${cum.toFixed(1)}%`;});
    return {gradient:rows.some(r=>r.count)?`conic-gradient(${stops.join(', ')})`:'conic-gradient(#e2e8f0 0% 100%)'};
  });

  ngOnInit(): void {
    this.svc.getAll().subscribe({
      next: d => { this.alerts.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  markRead(id: number): void {
    this.svc.markRead(id).subscribe(() => this.ngOnInit());
  }

  markAllRead(): void {
    this.svc.markAllRead().subscribe(() => this.ngOnInit());
  }

  typeClass(type: string): string {
    return type === 'OUT_OF_STOCK' ? 'tag-danger' : type === 'LOW_STOCK' ? 'tag-warn' : 'tag-info';
  }
}
