import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { AuthService } from '../../core/services/auth.service';
import { Sale, Product } from '../../core/models/models';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [FormsModule, SlicePipe, DecimalPipe, RouterLink],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.css'
})
export class SalesComponent implements OnInit {
  auth         = inject(AuthService);
  private svc  = inject(SaleService);
  private pSvc = inject(ProductService);

  // ── State ─────────────────────────────────────
  sales      = signal<Sale[]>([]);
  products   = signal<Product[]>([]);
  loading    = signal(true);
  showNew    = signal(false);
  saving     = signal(false);
  selected   = signal<Sale | null>(null);
  page       = signal(1);
  pageSize   = 10;
  totalPages = computed(() => Math.max(1, Math.ceil(this.sales().length / this.pageSize)));
  pagedSales = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.sales().slice(start, start + this.pageSize);
  });

  // ── New Sale Form ──────────────────────────────
  customerName  = '';
  customerEmail = '';
  saleDate      = new Date().toISOString().slice(0, 10);
  paymentStatus: 'PENDING' | 'APPROVED' | 'FAILED' = 'PENDING';
  cart          = signal<CartItem[]>([]);
  productSearch = '';
  filteredProducts = signal<Product[]>([]);
  showDropdown  = false;
  errorMsg      = signal('');

  // ── Computed ───────────────────────────────────
  cartTotal = computed(() =>
    this.cart().reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  );

  cartItemCount = computed(() =>
    this.cart().reduce((sum, i) => sum + i.quantity, 0)
  );
  canRemoveSale = computed(() => ['ADMIN', 'MANAGER'].includes((this.auth.userRole() as string) || ''));
  salesBars = computed(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const totals = days.map(date => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
      amount: this.sales().filter(s => s.saleDate === date).reduce((sum, s) => sum + (s.totalAmount || 0), 0)
    }));
    const max = Math.max(1, ...totals.map(x => x.amount));
    return totals.map(x => ({ ...x, height: Math.max(8, (x.amount / max) * 100) }));
  });

  trendPoints = computed(() => {
    const bars = this.salesBars();
    const max = Math.max(1, ...bars.map(b => b.amount));
    const W = 450, H = 130, PAD_L = 40, PAD_T = 15, PAD_B = 25;
    return bars.map((b, i) => ({
      x: PAD_L + (i / (bars.length - 1 || 1)) * (W - PAD_L),
      y: PAD_T + (1 - b.amount / max) * (H - PAD_T - PAD_B),
      label: b.label,
      amount: b.amount
    }));
  });

  trendLinePath = computed(() => {
    const pts = this.trendPoints();
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  trendAreaPath = computed(() => {
    const pts = this.trendPoints();
    if (pts.length < 2) return '';
    const H = 130, PAD_B = 25;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return line + ` L${pts[pts.length-1].x.toFixed(1)},${(H-PAD_B).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-PAD_B).toFixed(1)} Z`;
  });

  trendGridY = computed(() => {
    const bars = this.salesBars();
    const max = Math.max(1, ...bars.map(b => b.amount));
    const H = 130, PAD_T = 15, PAD_B = 25;
    return [0.75, 0.5, 0.25].map(pct => PAD_T + (1 - pct) * (H - PAD_T - PAD_B));
  });

  trendGridLabel(y: number): string {
    const bars = this.salesBars();
    const max = Math.max(1, ...bars.map(b => b.amount));
    const H = 130, PAD_T = 15, PAD_B = 25;
    const pct = 1 - (y - PAD_T) / (H - PAD_T - PAD_B);
    return this.formatCompact(pct * max);
  }

  topSelling = computed(() => {
    const map = new Map<string, number>();
    const week = this.salesBars().map(b => b.date);
    for (const s of this.sales().filter(s => week.includes(s.saleDate))) {
      for (const item of s.items || []) {
        map.set(item.productName, (map.get(item.productName) || 0) + item.subtotal);
      }
    }
    const rows = Array.from(map, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r.total));
    return rows.map(r => ({ ...r, pct: (r.total / max) * 100 }));
  });

  paymentStatusBreakdown = computed(() => {
    const all = this.sales();
    const total = all.length || 1;
    return [
      { label: 'Paid',    color: '#16a34a', status: 'PAID' },
      { label: 'Pending', color: '#f59e0b', status: 'PENDING' },
      { label: 'Cancelled', color: '#ef4444', status: 'CANCELLED' }
    ].map(s => ({
      ...s,
      count: all.filter(x => x.paymentStatus === s.status).length,
      pct: Math.round((all.filter(x => x.paymentStatus === s.status).length / total) * 100)
    }));
  });

  paymentDonut = computed(() => {
    const breakdown = this.paymentStatusBreakdown();
    const total = this.sales().length || 1;
    let cum = 0;
    const stops = breakdown.map(b => {
      const start = cum;
      cum += (b.count / total) * 100;
      return `${b.color} ${start.toFixed(1)}% ${cum.toFixed(1)}%`;
    });
    return { gradient: `conic-gradient(${stops.join(', ')})` };
  });

  categoryBreakdown = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.sales()) {
      for (const item of s.items || []) {
        const cat = item.categoryName || 'Other';
        map.set(cat, (map.get(cat) || 0) + item.subtotal);
      }
    }
    const rows = Array.from(map, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0) || 1;
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length], pct: Math.round((r.total / grandTotal) * 100) }));
  });

  categoryDonut = computed(() => {
    const rows = this.categoryBreakdown();
    const total = rows.reduce((s, r) => s + r.total, 0) || 1;
    let cum = 0;
    const stops = rows.map(r => {
      const start = cum;
      cum += (r.total / total) * 100;
      return `${r.color} ${start.toFixed(1)}% ${cum.toFixed(1)}%`;
    });
    return {
      gradient: rows.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)',
      totalPct: rows.length ? rows[0].pct : 0
    };
  });

  recentActivity = computed(() => {
    return [...this.sales()]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 6)
      .map(s => ({
        id: s.id,
        type: s.paymentStatus === 'PAID' ? 'completed' : s.paymentStatus === 'CANCELLED' ? 'cancelled' : 'pending',
        title: s.paymentStatus === 'PAID' ? 'New sale completed' : s.paymentStatus === 'CANCELLED' ? 'Sale cancelled' : 'Payment received',
        sub: `Sale #INV-${s.id} for ₹${this.formatCurrency(s.totalAmount)}`,
        time: s.saleDate || ''
      }));
  });

  formatCompact(val: number): string {
    return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(val || 0);
  }

  ngOnInit(): void {
    this.loadSales();
    this.pSvc.getAll().subscribe(d => {
      this.products.set(d.filter(p => p.currentStock > 0));
      this.filteredProducts.set(this.products());
    });
  }

  loadSales(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.sales.set(d); this.page.set(1); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // ── Product Search in New Sale ─────────────────
  onProductSearch(): void {
    const term = this.productSearch.toLowerCase();
    this.filteredProducts.set(
      this.products().filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
      )
    );
    this.showDropdown = true;
  }

  addToCart(product: Product): void {
    this.productSearch = '';
    this.showDropdown  = false;
    this.filteredProducts.set(this.products());

    const existing = this.cart().find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.currentStock) {
        this.errorMsg.set(`Max available stock for "${product.name}": ${product.currentStock}`);
        return;
      }
      this.cart.update(c => c.map(i =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      this.cart.update(c => [...c, {
        product,
        quantity: 1,
        unitPrice: product.price
      }]);
    }
    this.errorMsg.set('');
  }

  removeFromCart(productId: number): void {
    this.cart.update(c => c.filter(i => i.product.id !== productId));
  }

  updateQty(productId: number, qty: number): void {
    if (qty < 1) { this.removeFromCart(productId); return; }
    const item = this.cart().find(i => i.product.id === productId);
    if (item && qty > item.product.currentStock) {
      this.errorMsg.set(`Only ${item.product.currentStock} units available for "${item.product.name}"`);
      return;
    }
    this.cart.update(c => c.map(i =>
      i.product.id === productId ? { ...i, quantity: qty } : i
    ));
    this.errorMsg.set('');
  }

  updatePrice(productId: number, price: number): void {
    this.cart.update(c => c.map(i =>
      i.product.id === productId ? { ...i, unitPrice: price } : i
    ));
  }

  openNewSale(): void {
    this.customerName  = '';
    this.customerEmail = '';
    this.saleDate      = new Date().toISOString().slice(0, 10);
    this.paymentStatus = 'PENDING';
    this.cart.set([]);
    this.errorMsg.set('');
    this.showNew.set(true);
  }

  closeNew(): void { this.showNew.set(false); }

  submitSale(): void {
    this.errorMsg.set('');

    if (this.cart().length === 0) {
      this.errorMsg.set('Add at least one product to the sale.'); return;
    }
    if (!this.saleDate) {
      this.errorMsg.set('Sale date is required.'); return;
    }
    if (new Date(this.saleDate) > new Date()) {
      this.errorMsg.set('Sale date cannot be in the future.'); return;
    }
    if (this.customerEmail && !this.isValidEmail(this.customerEmail)) {
      this.errorMsg.set('Enter a valid customer email address.'); return;
    }
    for (const item of this.cart()) {
      if (item.quantity < 1) {
        this.errorMsg.set(`Quantity for "${item.product.name}" must be at least 1.`); return;
      }
      if (item.quantity > item.product.currentStock) {
        this.errorMsg.set(`Only ${item.product.currentStock} units of "${item.product.name}" available.`); return;
      }
      if (item.unitPrice < 0) {
        this.errorMsg.set(`Unit price for "${item.product.name}" cannot be negative.`); return;
      }
    }
    if (this.cartTotal() <= 0) {
      this.errorMsg.set('Cart total must be greater than zero.'); return;
    }

    const payload = {
      customerName:  this.customerName  || undefined,
      customerEmail: this.customerEmail || undefined,
      saleDate:      this.saleDate,
      paymentStatus: this.paymentStatus,
      items: this.cart().map(i => ({
        productId: i.product.id,
        quantity:  i.quantity,
        unitPrice: i.unitPrice
      }))
    };

    this.saving.set(true);
    this.svc.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeNew();
        this.loadSales();
        // Refresh product stock counts
        this.pSvc.getAll().subscribe(d => this.products.set(d.filter(p => p.currentStock > 0)));
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message ?? 'Sale failed. Check stock availability.');
      }
    });
  }

  viewDetail(s: Sale): void { this.selected.set(s); }
  closeDetail(): void { this.selected.set(null); }

  deleteSale(s: Sale): void {
    if (!confirm(`Remove sale #${s.id}? Stock quantities will be restored.`)) return;
    this.svc.delete(s.id).subscribe(() => {
      this.selected.set(null);
      this.loadSales();
      this.pSvc.getAll().subscribe(d => this.products.set(d.filter(p => p.currentStock > 0)));
    });
  }

  updatePayment(s: Sale, paymentStatus: string): void {
    this.svc.updatePaymentStatus(s.id, paymentStatus).subscribe(updated => {
      this.sales.update(list => list.map(item => item.id === updated.id ? updated : item));
      if (this.selected()?.id === updated.id) this.selected.set(updated);
    });
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  /** Used by template: returns array of length n for *ngFor pagination */
  pagesArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  /** Today date string yyyy-mm-dd for [max] binding */
  todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  todaySalesCount(): number {
    const today = this.todayStr();
    return this.sales().filter(s => s.saleDate === today).length;
  }

  totalRevenue(): number {
    return this.sales().reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }

  avgOrderValue(): number {
    const total = this.totalRevenue();
    return this.sales().length ? total / this.sales().length : 0;
  }

  grossProfit(): number {
    return this.totalRevenue() * 0.22;
  }

  salesDateRange(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    return `${fmt(start)} - ${fmt(now)}`;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(val || 0);
  }

  hideDropdown(): void {
    setTimeout(() => { this.showDropdown = false; }, 200);
  }

  private isValidEmail(email: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim());
  }
}
