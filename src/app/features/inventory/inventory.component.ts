import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ProductService } from '../../core/services/product.service';
import { InventoryItem, StockMovement, Product } from '../../core/models/models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  auth         = inject(AuthService);
  private svc  = inject(InventoryService);
  private pSvc = inject(ProductService);

  items      = signal<InventoryItem[]>([]);
  movements  = signal<StockMovement[]>([]);
  products   = signal<Product[]>([]);
  loading    = signal(true);

  inventory      = computed(() => this.items());
  inStockItems   = computed(() => this.items().filter(i => i.stockStatus === 'IN_STOCK').length);
  lowStockItems  = computed(() => this.items().filter(i => i.stockStatus === 'LOW_STOCK').length);
  outOfStockItems = computed(() => this.items().filter(i => i.stockStatus === 'OUT_OF_STOCK').length);
  formatStockValue(): string {
    const total = this.items().reduce((s, i) => s + (i.currentStock * ((i as any).unitPrice || 0)), 0);
    return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(total || 0);
  }
  view       = signal<'all' | 'low' | 'out' | 'moves'>('all');
  showModal  = signal(false);
  saving     = signal(false);
  error      = signal('');
  keyword    = signal('');
  page       = signal(1);
  pageSize   = 10;

  // Product search in modal
  productSearch   = signal('');
  showProdDrop    = signal(false);
  filteredProds   = computed(() => {
    const q = this.productSearch().toLowerCase().trim();
    if (!q) return this.products().slice(0, 12);
    return this.products().filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 12);
  });

  totalPages = computed(() => {
    const count = this.view() === 'moves' ? this.movements().length : this.displayItems().length;
    return Math.max(1, Math.ceil(count / this.pageSize));
  });
  displayItems = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    if (!kw) return this.items();
    return this.items().filter(i =>
      i.productName.toLowerCase().includes(kw) || i.sku?.toLowerCase().includes(kw)
    );
  });
  pagedItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.displayItems().slice(start, start + this.pageSize);
  });
  pagedMovements = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.movements().slice(start, start + this.pageSize);
  });

  adj = {
    productId: 0, quantity: 1,
    movementType: 'IN' as 'IN' | 'OUT',
    referenceType: 'ADJUSTMENT' as 'SALE' | 'PURCHASE' | 'ADJUSTMENT',
    notes: ''
  };

  ngOnInit(): void {
    this.setView('all');
    this.pSvc.getAll().subscribe(d => this.products.set(d));
  }

  setView(v: 'all' | 'low' | 'out' | 'moves'): void {
    this.view.set(v); this.page.set(1); this.loading.set(true); this.keyword.set('');
    if (v === 'all')   this.svc.getAll().subscribe({ next: d => { this.items.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
    if (v === 'low')   this.svc.getLowStock().subscribe({ next: d => { this.items.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
    if (v === 'out')   this.svc.getOutOfStock().subscribe({ next: d => { this.items.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
    if (v === 'moves') this.svc.getMovements().subscribe({ next: d => { this.movements.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  openAdjust(): void {
    this.adj = { productId: 0, quantity: 1, movementType: 'IN', referenceType: 'ADJUSTMENT', notes: '' };
    this.productSearch.set('');
    this.showProdDrop.set(false);
    this.error.set('');
    this.showModal.set(true);
  }
  closeModal(): void { this.showModal.set(false); this.error.set(''); this.showProdDrop.set(false); }

  selectProduct(p: Product): void {
    this.adj.productId = p.id;
    this.productSearch.set(`${p.name}  (${p.sku})`);
    this.showProdDrop.set(false);
  }

  hideDrop(): void { setTimeout(() => this.showProdDrop.set(false), 180); }

  getSelectedProduct(): Product | undefined {
    return this.products().find(p => p.id === Number(this.adj.productId));
  }

  adjust(): void {
    this.error.set('');
    if (!this.adj.productId || this.adj.productId === 0) {
      this.error.set('Please select a product.'); return;
    }
    if (!this.adj.quantity || this.adj.quantity < 1) {
      this.error.set('Quantity must be at least 1.'); return;
    }
    if (this.adj.quantity > 100000) {
      this.error.set('Quantity seems too large. Maximum is 100,000.'); return;
    }
    if (this.adj.movementType === 'OUT') {
      const product = this.getSelectedProduct();
      if (product && product.currentStock < this.adj.quantity) {
        this.error.set(`Cannot remove ${this.adj.quantity} units — only ${product.currentStock} available in stock.`); return;
      }
    }
    if (!this.adj.notes?.trim()) {
      this.error.set('Please provide a reason/notes for this adjustment.'); return;
    }
    this.saving.set(true);
    this.svc.adjustStock(this.adj).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.setView('all'); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message ?? 'Stock adjustment failed.'); }
    });
  }

  onKeywordChange(value: string): void { this.keyword.set(value); this.page.set(1); }
  onSearch(): void { this.page.set(1); }
  onClearSearch(): void { this.keyword.set(''); this.page.set(1); }

  setPage(p: number): void { this.page.set(Math.min(Math.max(p, 1), this.totalPages())); }
  statusClass(s: string): string {
    return s === 'IN_STOCK' ? 'badge-success' : s === 'LOW_STOCK' ? 'badge-warn' : 'badge-danger';
  }
}
