import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SaleService } from '../../core/services/sale.service';
import { InventoryService } from '../../core/services/inventory.service';
import { Sale, InventoryItem } from '../../core/models/models';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit {
  private saleSvc = inject(SaleService);
  private invSvc  = inject(InventoryService);

  sales      = signal<Sale[]>([]);
  inventory  = signal<InventoryItem[]>([]);
  loading    = signal(true);
  activeTab  = signal<'sales' | 'inventory' | 'stock'>('sales');

  // Computed counts — no arrow functions in templates
  inStockCount    = computed(() => this.inventory().filter(i => i.stockStatus === 'IN_STOCK').length);
  lowStockCount   = computed(() => this.inventory().filter(i => i.stockStatus === 'LOW_STOCK').length);
  outOfStockCount = computed(() => this.inventory().filter(i => i.stockStatus === 'OUT_OF_STOCK').length);

  ngOnInit(): void {
    this.saleSvc.getAll().subscribe({
      next: d => { this.sales.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.invSvc.getAll().subscribe(d => this.inventory.set(d));
  }

  setTab(t: 'sales' | 'inventory' | 'stock'): void { this.activeTab.set(t); }

  totalRevenue(): number { return this.sales().reduce((s, x) => s + (x.totalAmount || 0), 0); }
  totalTransactions(): number { return this.sales().length; }
  totalStockUnits(): number { return this.inventory().reduce((s, i) => s + i.currentStock, 0); }

  downloadCsv(): void {
    const rows = this.activeRows();
    this.download(`${this.activeTab()}-report.csv`, this.toDelimited(rows, ','), 'text/csv;charset=utf-8;');
  }

  downloadExcel(): void {
    const rows = this.activeRows();
    this.download(`${this.activeTab()}-report.xls`, this.toDelimited(rows, '\t'), 'application/vnd.ms-excel;charset=utf-8;');
  }

  statusClass(s: string): string {
    return s === 'IN_STOCK' ? 'badge-success' : s === 'LOW_STOCK' ? 'badge-warn' : 'badge-danger';
  }

  statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(v || 0);
  }

  private activeRows(): Record<string, string | number>[] {
    if (this.activeTab() === 'sales') {
      return this.sales().map(s => ({
        Date: s.saleDate,
        Customer: s.customerName || 'Walk-in',
        Email: s.customerEmail || '',
        Items: s.items.length,
        Amount: s.totalAmount,
        CreatedBy: s.createdBy ?? ''
      }));
    }
    if (this.activeTab() === 'inventory') {
      return this.inventory().map(i => ({
        Product: i.productName,
        SKU: i.sku,
        Stock: i.currentStock,
        ReorderLevel: i.reorderLevel,
        Status: this.statusLabel(i.stockStatus)
      }));
    }
    return [
      { Status: 'In Stock', Products: this.inStockCount() },
      { Status: 'Low Stock', Products: this.lowStockCount() },
      { Status: 'Out of Stock', Products: this.outOfStockCount() }
    ];
  }

  private toDelimited(rows: Record<string, string | number>[], separator: string): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(separator),
      ...rows.map(row => headers.map(h => this.escapeCell(row[h], separator)).join(separator))
    ];
    return lines.join('\n');
  }

  private escapeCell(value: string | number, separator: string): string {
    const text = String(value ?? '');
    if (separator === '\t') return text.replace(/\t/g, ' ');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
