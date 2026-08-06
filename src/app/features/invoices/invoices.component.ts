import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { Sale } from '../../core/models/models';
import { environment } from '../../../environments/environment';

export interface Invoice {
  id: number; invoiceNumber: string; saleId: number;
  customerName: string; customerEmail: string; customerPhone: string;
  subtotal: number; taxRate: number; taxAmount: number; totalAmount: number;
  notes: string; status: string; createdBy: string; createdAt: string;
  items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [FormsModule, DecimalPipe, SlicePipe],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.css'
})
export class InvoicesComponent implements OnInit {
  auth        = inject(AuthService);
  private http = inject(HttpClient);
  private saleSvc = inject(SaleService);

  invoices    = signal<Invoice[]>([]);
  sales       = signal<Sale[]>([]);
  detail      = signal<Invoice | null>(null);
  loading     = signal(true);
  showModal   = signal(false);
  generating  = signal(false);
  error       = signal('');
  page        = signal(1);
  pageSize    = 10;
  totalPages   = computed(() => Math.max(1, Math.ceil(this.invoices().length / this.pageSize)));
  paged        = computed(() => { const s = (this.page()-1)*this.pageSize; return this.invoices().slice(s, s+this.pageSize); });
  paidCount    = computed(() => this.invoices().filter(i => i.status === 'PAID').length);
  pendingCount = computed(() => this.invoices().filter(i => i.status === 'PENDING' || i.status === 'ISSUED').length);
  overdueCount = computed(() => this.invoices().filter(i => i.status === 'OVERDUE').length);
  totalRevenue = computed(() => this.invoices().filter(i => i.status === 'PAID').reduce((s, i) => s + (i.totalAmount || 0), 0));
  formatAmt(v: number): string { return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(v || 0); }
  exportInvoices(): void { /* placeholder */ }

  form = { saleId: 0, taxRate: 18, notes: '' };

  ngOnInit(): void {
    this.load();
    this.saleSvc.getAll().subscribe(d => this.sales.set(d));
  }

  load(): void {
    this.loading.set(true);
    this.http.get<Invoice[]>(`${environment.apiUrl}/invoices`).subscribe({
      next: d => { this.invoices.set(d); this.page.set(1); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setPage(p: number): void { this.page.set(Math.min(Math.max(p, 1), this.totalPages())); }

  openGenerate(): void {
    this.form = { saleId: 0, taxRate: 18, notes: '' };
    this.error.set('');
    this.showModal.set(true);
  }
  closeModal(): void { this.showModal.set(false); this.error.set(''); }

  openDetail(inv: Invoice): void { this.detail.set(inv); }
  closeDetail(): void { this.detail.set(null); }

  generate(): void {
    this.error.set('');
    if (!this.form.saleId || this.form.saleId === 0) { this.error.set('Please select a sale.'); return; }
    if (this.form.taxRate < 0 || this.form.taxRate > 100) { this.error.set('Tax rate must be between 0 and 100.'); return; }
    this.generating.set(true);
    this.http.post<Invoice>(`${environment.apiUrl}/invoices/from-sale/${this.form.saleId}`, {
      taxRate: this.form.taxRate, notes: this.form.notes
    }).subscribe({
      next: inv => { this.generating.set(false); this.closeModal(); this.load(); this.detail.set(inv); },
      error: err => { this.generating.set(false); this.error.set(err.error?.message ?? 'Failed to generate invoice.'); }
    });
  }

  updateStatus(id: number, status: string): void {
    this.http.patch<Invoice>(`${environment.apiUrl}/invoices/${id}/status`, { status }).subscribe({
      next: updated => { this.detail.set(updated); this.load(); },
      error: err => alert(err.error?.message ?? 'Failed to update status.')
    });
  }

  printInvoice(): void {
    const printArea = document.getElementById('invoice-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`<html><head><title>Invoice ${this.detail()?.invoiceNumber}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; background: #fff; }
      .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
      .brand-name { font-size: 28px; font-weight: 900; color: #00bcd4; }
      .inv-title { font-size: 32px; font-weight: 900; color: #1e293b; text-align: right; }
      .inv-number { font-size: 14px; color: #64748b; text-align: right; }
      .section { margin-bottom: 24px; }
      .section h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #94a3b8; margin-bottom: 6px; }
      .section p { font-size: 14px; color: #334155; line-height: 1.6; }
      table { width: 100%; border-collapse: collapse; margin: 24px 0; }
      th { padding: 10px 14px; background: #f8fafc; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #64748b; text-align: left; border-bottom: 2px solid #e2e8f0; }
      td { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
      .right { text-align: right; }
      .total-section { text-align: right; margin-top: 16px; }
      .total-row { display: flex; justify-content: flex-end; gap: 40px; padding: 6px 0; font-size: 14px; }
      .total-final { font-size: 20px; font-weight: 900; color: #00bcd4; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 6px; }
      .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .PAID { background: #dcfce7; color: #15803d; }
      .ISSUED { background: #dbeafe; color: #1d4ed8; }
      .CANCELLED { background: #fee2e2; color: #b91c1c; }
    </style></head><body>${printArea.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 300);
  }

  getSaleLabel(id: number): string {
    const s = this.sales().find(s => s.id === id);
    return s ? `#${s.id} — ${s.customerName || 'Walk-in'} (₹${s.totalAmount})` : `Sale #${id}`;
  }

  statusClass(s: string): string {
    return s === 'PAID' ? 'badge-success' : s === 'ISSUED' ? 'badge-info' : s === 'CANCELLED' ? 'badge-danger' : 'badge-warn';
  }
  fmt(v: number): string { return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(v || 0); }
}
