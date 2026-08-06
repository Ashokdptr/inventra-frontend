import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AuditLog {
  id: number;
  module: string;
  action: string;
  description: string;
  performedBy: string | null;
  userRole: string | null;
  entityId: number | null;
  extraInfo: string | null;
  severity: string;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditPage {
  content: AuditLog[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface AuditStats {
  total: number;
  today: number;
  thisWeek: number;
  byModule: Record<string, number>;
}

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.css'
})
export class TransactionHistoryComponent implements OnInit {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/audit`;

  // Data
  logs     = signal<AuditLog[]>([]);
  stats    = signal<AuditStats | null>(null);
  total    = signal(0);
  pages    = signal(0);
  loading  = signal(true);
  selected = signal<AuditLog | null>(null);

  // Filters
  module   = '';
  severity = '';
  keyword  = '';
  fromDate = '';
  toDate   = '';
  page     = signal(0);
  pageSize = 25;

  // Module options
  modules  = ['AUTH','SALE','PURCHASE_ORDER','PRODUCT','SUPPLIER','INVENTORY','USER','PAYMENT','CATEGORY'];
  severities = ['INFO','SUCCESS','WARNING','DANGER'];

  ngOnInit(): void {
    this.loadStats();
    this.loadLogs();
  }

  loadStats(): void {
    this.http.get<AuditStats>(`${this.base}/stats`).subscribe({
      next: d => this.stats.set(d),
      error: () => {}
    });
  }

  loadLogs(): void {
    this.loading.set(true);
    const params: Record<string,string> = {
      page: String(this.page()),
      size: String(this.pageSize)
    };
    if (this.module)   params['module']   = this.module;
    if (this.severity) params['severity'] = this.severity;
    if (this.keyword)  params['keyword']  = this.keyword;
    if (this.fromDate) params['fromDate'] = this.fromDate;
    if (this.toDate)   params['toDate']   = this.toDate;

    const qs = new URLSearchParams(params).toString();
    this.http.get<AuditPage>(`${this.base}?${qs}`).subscribe({
      next: d => {
        this.logs.set(d.content);
        this.total.set(d.totalElements);
        this.pages.set(d.totalPages);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); }
    });
  }

  applyFilters(): void {
    this.page.set(0);
    this.loadLogs();
  }

  clearFilters(): void {
    this.module = ''; this.severity = ''; this.keyword = '';
    this.fromDate = ''; this.toDate = '';
    this.page.set(0);
    this.loadLogs();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.loadLogs();
  }

  pagesArray(): number[] {
    return Array.from({ length: this.pages() }, (_, i) => i);
  }

  openDetail(log: AuditLog): void { this.selected.set(log); }
  closeDetail(): void { this.selected.set(null); }

  // ── Display helpers ──────────────────────────────────────────────
  moduleIcon(m: string): string {
    const icons: Record<string,string> = {
      AUTH: '🔐', SALE: '🛒', PURCHASE_ORDER: '📦',
      PRODUCT: '🏷️', SUPPLIER: '🚚', INVENTORY: '🗄️',
      USER: '👤', PAYMENT: '💳', CATEGORY: '📂'
    };
    return icons[m] ?? '📋';
  }

  moduleLabel(m: string): string {
    const labels: Record<string,string> = {
      AUTH: 'Auth', SALE: 'Sales', PURCHASE_ORDER: 'Purchase Orders',
      PRODUCT: 'Products', SUPPLIER: 'Suppliers', INVENTORY: 'Inventory',
      USER: 'Users', PAYMENT: 'Payments', CATEGORY: 'Categories'
    };
    return labels[m] ?? m;
  }

  severityClass(s: string): string {
    return s === 'SUCCESS' ? 'sev-success'
      : s === 'WARNING' ? 'sev-warn'
      : s === 'DANGER' ? 'sev-danger'
      : 'sev-info';
  }

  actionClass(a: string): string {
    if (['CREATED','REGISTERED','COMPLETED','OTP_LOGIN'].includes(a)) return 'act-success';
    if (['DELETED','ACCOUNT_DELETED','REJECTED'].includes(a)) return 'act-danger';
    if (['SHIPPED','UPDATED','SALE_PAYMENT_UPDATED','PO_PAYMENT_UPDATED'].includes(a)) return 'act-warn';
    return 'act-info';
  }

  topModules(): Array<{module: string; count: number}> {
    const bm = this.stats()?.byModule ?? {};
    return Object.entries(bm)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  maxModuleCount(): number {
    const tops = this.topModules();
    return tops.length > 0 ? tops[0].count : 1;
  }

  /** Converts module name to CSS-safe class e.g. PURCHASE_ORDER -> purchase-order */
  moduleCssClass(m: string): string {
    return m.toLowerCase().replace(/_/g, '-');
  }
}
