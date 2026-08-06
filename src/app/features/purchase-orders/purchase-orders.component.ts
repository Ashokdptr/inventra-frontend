import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { PurchaseOrder, Supplier, Product, SupplierWarehouseStock, Category } from '../../core/models/models';
import { DecimalPipe, DatePipe } from '@angular/common';

interface PoItemForm { productId: number; quantity: number; unitPrice: number; selectedCategoryId: number; selectedSubcategoryId: number; }

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.css',
  providers: [DatePipe]

})
export class PurchaseOrdersComponent implements OnInit, OnDestroy {
  auth           = inject(AuthService);
  private svc    = inject(PurchaseOrderService);
  private supSvc = inject(SupplierService);
  private prdSvc = inject(ProductService);
  private catSvc = inject(CategoryService);
  private datePipe = inject(DatePipe);


  orders         = signal<PurchaseOrder[]>([]);
  suppliers      = signal<Supplier[]>([]);
  products       = signal<Product[]>([]);
  categories     = signal<Category[]>([]);   // root categories (tree)
  flatCategories = signal<Category[]>([]);   // ALL categories flat (for filtering)
  warehouseStock = signal<SupplierWarehouseStock[]>([]);
  suppliersForProduct = signal<{supplier: Supplier; stock: SupplierWarehouseStock}[]>([]);

  loading    = signal(true);
  showModal  = signal(false);
  saving     = signal(false);
  detail     = signal<PurchaseOrder | null>(null);
  error      = signal('');
  successMsg = signal('');
  supplierNotes = '';
  modifiedQty: Record<number, number> = {};
  private pollTimer: any = null;

  form = {
    supplierId: 0,
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: '',
    notes: '',
    items: [] as PoItemForm[]
  };

  get isSupplier(): boolean { return this.auth.userRole() === 'SUPPLIER'; }
  get pendingOrders(): PurchaseOrder[] { return this.orders().filter(o => o.status === 'PENDING'); }
  get approvedOrders(): PurchaseOrder[] { return this.orders().filter(o => o.status === 'APPROVED' || o.status === 'SHIPPED'); }
  get approvedCount(): number { return this.orders().filter(o => o.status === 'APPROVED').length; }
  get completedCount(): number { return this.orders().filter(o => o.status === 'COMPLETED').length; }
  get totalOrderValue(): number { return this.orders().reduce((s, o) => s + (o.totalAmount || 0), 0); }
  kpiData = () => ({ weekGrowth: 18, pendingGrowth: 5, approvedGrowth: 14, completedGrowth: 4, valueGrowth: 18 });
  formatCompactPO(val: number): string { return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(val || 0); }

  // ── PO Trend (7 days) ──
  poTrendPoints = computed(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().slice(0,10), label: d.toLocaleDateString('en-IN',{weekday:'short'}) };
    });
    const counts = days.map(d => ({ label: d.label, count: this.orders().filter(o => (o.orderDate||'').startsWith(d.date)).length }));
    const max = Math.max(1, ...counts.map(c => c.count));
    const W=440,H=120,PL=30,PT=10,PB=20;
    return counts.map((c, i) => ({
      x: PL + (i/(counts.length-1||1))*(W-PL),
      y: PT + (1 - c.count/max)*(H-PT-PB),
      label: c.label, count: c.count
    }));
  });

  poLinePath = computed(() => {
    const pts = this.poTrendPoints();
    if (pts.length < 2) return '';
    return pts.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  poAreaPath = computed(() => {
    const pts = this.poTrendPoints();
    if (pts.length < 2) return '';
    const H=120,PB=20;
    const line = pts.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return line + ` L${pts[pts.length-1].x.toFixed(1)},${(H-PB).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-PB).toFixed(1)} Z`;
  });

  poGridY = computed(() => {
    const H=120,PT=10,PB=20;
    return [0.75,0.5,0.25].map(p => PT+(1-p)*(H-PT-PB));
  });

  poBySupplier = computed(() => {
    const map = new Map<string,number>();
    for (const o of this.orders()) {
      const n = o.supplierName || 'Unknown';
      map.set(n, (map.get(n)||0) + (o.totalAmount||0));
    }
    const rows = Array.from(map, ([name,total]) => ({name,total})).sort((a,b) => b.total-a.total).slice(0,5);
    const max = Math.max(1, ...rows.map(r=>r.total));
    const colors = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6'];
    return rows.map((r,i) => ({...r, pct:(r.total/max)*100, color:colors[i%colors.length]}));
  });

  statusDistribution = computed(() => {
    const total = this.orders().length || 1;
    return [
      {label:'Pending',   color:'#f59e0b', status:'PENDING'},
      {label:'Approved',  color:'#3b82f6', status:'APPROVED'},
      {label:'Completed', color:'#16a34a', status:'COMPLETED'},
      {label:'Cancelled', color:'#ef4444', status:'CANCELLED'},
      {label:'Shipped',   color:'#8b5cf6', status:'SHIPPED'}
    ].map(s => ({
      ...s,
      count: this.orders().filter(o=>o.status===s.status).length,
      pct: Math.round(this.orders().filter(o=>o.status===s.status).length/total*100)
    })).filter(s => s.count > 0);
  });

  statusDonut = computed(() => {
    const rows = this.statusDistribution();
    const total = this.orders().length || 1;
    let cum = 0;
    const stops = rows.map(r => {
      const start=cum; cum += (r.count/total)*100;
      return `${r.color} ${start.toFixed(1)}% ${cum.toFixed(1)}%`;
    });
    return { gradient: rows.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)' };
  });

  ngOnInit(): void {
    this.load();
    this.supSvc.getAll().subscribe(d => this.suppliers.set(d));
    this.prdSvc.getAll().subscribe(d => this.products.set(d));
    // Load tree (for parent→subcategory picker)
    this.catSvc.getAll().subscribe(d => this.categories.set(d));
    // Load flat list (for correct product filtering at any level)
    this.catSvc.getAllFlat().subscribe(d => this.flatCategories.set(d));
    if (this.isSupplier) {
      this.pollTimer = setInterval(() => this.load(), 30000);
    }
  }

  ngOnDestroy(): void { if (this.pollTimer) clearInterval(this.pollTimer); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.orders.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate(): void {
    this.form = {
      supplierId: 0,
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: '',
      notes: '',
      items: [this.emptyItem()]
    };
    this.warehouseStock.set([]);
    this.suppliersForProduct.set([]);
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.error.set(''); }

  openDetail(o: PurchaseOrder): void {
    this.detail.set(o);
    this.supplierNotes = '';
    this.successMsg.set('');
    this.modifiedQty = {};
    o.items.forEach(i => this.modifiedQty[i.id] = i.quantity);
  }

  closeDetail(): void { this.detail.set(null); this.successMsg.set(''); }

  emptyItem(): PoItemForm { return { productId: 0, quantity: 1, unitPrice: 0, selectedCategoryId: 0, selectedSubcategoryId: 0 }; }
  addItem(): void { this.form.items.push(this.emptyItem()); }
  removeItem(i: number): void { if (this.form.items.length > 1) this.form.items.splice(i, 1); }

  /** Root-level categories only */
  get rootCategories(): Category[] {
    return this.categories().filter(c => !c.parentId);
  }

  /** Subcategories of a given parent (from tree or flat list) */
  getSubcategories(parentId: number): Category[] {
    const parent = this.categories().find(c => c.id === parentId);
    if (parent?.subcategories?.length) return parent.subcategories as unknown as Category[];
    return this.flatCategories().filter(c => c.parentId === parentId);
  }

  /** Collect all descendant category IDs (parent + subs) for broad matching */
  private getAllCategoryIds(catId: number): number[] {
    const ids = [catId];
    this.flatCategories().filter(c => c.parentId === catId).forEach(c => ids.push(c.id));
    this.getSubcategories(catId).forEach(s => ids.push(s.id));
    return [...new Set(ids)];
  }

  getProductsByCategory(catId: number, subCatId: number): Product[] {
    if (subCatId) return this.products().filter(p => p.categoryId === subCatId);
    if (catId) {
      const ids = this.getAllCategoryIds(catId);
      return this.products().filter(p => p.categoryId != null && ids.includes(p.categoryId));
    }
    return this.products();
  }

  onProductChange(item: PoItemForm): void {
    item.unitPrice = 0;
    if (!item.productId) return;
    if (this.form.supplierId) {
      const ws = this.warehouseStock().find(w => w.productId === item.productId);
      if (ws) item.unitPrice = ws.costPrice ?? this.products().find(p => p.id === item.productId)?.costPrice ?? 0;
    } else {
      this.loadSuppliersForProduct(item.productId, item);
    }
  }

  loadSuppliersForProduct(productId: number, item?: PoItemForm): void {
    const allSuppliers = this.suppliers();
    const result: {supplier: Supplier; stock: SupplierWarehouseStock}[] = [];
    let done = 0;
    if (!allSuppliers.length) { this.suppliersForProduct.set([]); return; }
    allSuppliers.forEach(sup => {
      this.supSvc.getWarehouse(sup.id).subscribe({
        next: stocks => {
          const ws = stocks.find(s => s.productId === productId);
          if (ws && ws.availableQuantity > 0) result.push({ supplier: sup, stock: ws });
          done++;
          if (done === allSuppliers.length) {
            this.suppliersForProduct.set(result);
            if (!this.form.supplierId && result.length === 1) {
              this.form.supplierId = result[0].supplier.id;
              this.onSupplierChange();
              if (item) item.unitPrice = result[0].stock.costPrice ?? item.unitPrice;
            }
          }
        },
        error: () => { done++; if (done === allSuppliers.length) this.suppliersForProduct.set(result); }
      });
    });
  }

  onSupplierChange(): void {
    if (this.form.supplierId) {
      this.supSvc.getWarehouse(this.form.supplierId).subscribe(d => {
        this.warehouseStock.set(d);
        this.form.items.forEach(item => {
          if (item.productId) {
            const ws = d.find(w => w.productId === item.productId);
            if (ws) item.unitPrice = ws.costPrice ?? item.unitPrice;
          }
        });
      });
    } else {
      this.warehouseStock.set([]);
    }
  }

  getAvailableQty(productId: number): number | null {
    const stock = this.warehouseStock().find(w => w.productId === productId);
    return stock ? stock.availableQuantity : null;
  }

  getOrderTotal(): number {
    return this.form.items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
  }

save(): void {
  this.error.set('');

  // ✅ Validate supplier
  if (!this.form.supplierId) { 
    this.error.set('Please select a supplier.'); 
    return; 
  }

  // ✅ Format orderDate properly
  this.form.orderDate = this.datePipe.transform(this.form.orderDate, 'yyyy-MM-dd') || '';
  if (!this.form.orderDate) { 
    this.error.set('Order date is required.'); 
    return; 
  }

  // ✅ Format expectedDate properly
  if (this.form.expectedDate) {
    this.form.expectedDate = this.datePipe.transform(this.form.expectedDate, 'yyyy-MM-dd') || '';
    if (this.form.expectedDate < this.form.orderDate) {
      this.error.set('Expected delivery date cannot be before order date.');
      return;
    }
  }

  // ✅ Validate items
  if (!this.form.items.length) { 
    this.error.set('At least one item is required.'); 
    return; 
  }
  for (let i = 0; i < this.form.items.length; i++) {
    const item = this.form.items[i];
    if (!item.productId) { 
      this.error.set(`Item ${i + 1}: Please select a product.`); 
      return; 
    }
    if (item.quantity < 1) { 
      this.error.set(`Item ${i + 1}: Quantity must be at least 1.`); 
      return; 
    }
    if (item.unitPrice < 0) { 
      this.error.set(`Item ${i + 1}: Unit price cannot be negative.`); 
      return; 
    }
    const avail = this.getAvailableQty(item.productId);
    if (avail !== null && item.quantity > avail) {
      const nm = this.products().find(p => p.id === item.productId)?.name ?? 'Product';
      this.error.set(`"${nm}" only has ${avail} units in supplier warehouse.`);
      return;
    }
  }

  // ✅ Prevent duplicate products
  const ids = this.form.items.map(i => i.productId);
  if (new Set(ids).size !== ids.length) { 
    this.error.set('Duplicate products in order.'); 
    return; 
  }

  // ✅ Build payload
  this.saving.set(true);
  const payload = {
    supplierId: this.form.supplierId,
    orderDate: this.form.orderDate,
    expectedDate: this.form.expectedDate || null,
    notes: this.form.notes,
    items: this.form.items.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice
    }))
  };

  // ✅ Send to backend
  this.svc.create(payload).subscribe({
    next: () => { 
      this.saving.set(false); 
      this.closeModal(); 
      this.load(); 
    },
    error: (err: any) => { 
      this.saving.set(false); 
      this.error.set(err.error?.message ?? 'Unable to create purchase order.'); 
    }
  });
}

  updateStatus(id: number, status: string): void {
    if (status === 'CANCELLED' && !confirm('Cancel this purchase order?')) return;
    if (status === 'COMPLETED' && !confirm('Confirm receipt? Products will be added to inventory.')) return;
    this.svc.updateStatus(id, status).subscribe({
      next: updated => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        if (this.detail()?.id === id) this.detail.set(updated);
        this.load();
      },
      error: (err: any) => alert(err.error?.message ?? 'Unable to update status.')
    });
  }

  updatePayment(id: number, paymentStatus: string): void {
    this.svc.updatePaymentStatus(id, paymentStatus).subscribe({
      next: updated => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        if (this.detail()?.id === id) this.detail.set(updated);
        this.successMsg.set(`Payment status updated to ${paymentStatus}.`);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: any) => alert(err.error?.message ?? 'Unable to update payment status.')
    });
  }

  supplierStatus(id: number, status: 'APPROVED' | 'REJECTED'): void {
    if (!confirm(`${status === 'APPROVED' ? 'Approve' : 'Reject'} this purchase order?`)) return;
    this.svc.supplierStatus(id, status).subscribe({
      next: updated => {
        this.successMsg.set(status === 'APPROVED'
          ? '✅ Order approved! Admin has been notified.'
          : '❌ Order rejected. Admin has been notified.');
        this.detail.set(updated);
        this.load();
      },
      error: (err: any) => alert(err.error?.message ?? 'Unable to update.')
    });
  }

  supplierModify(id: number): void {
    const order = this.detail();
    if (!order) return;
    for (const item of order.items) {
      if (!this.modifiedQty[item.id] || this.modifiedQty[item.id] < 1) {
        alert(`Quantity for "${item.productName}" must be at least 1.`);
        return;
      }
    }
    const items = order.items.map(i => ({ itemId: i.id, quantity: Number(this.modifiedQty[i.id] || i.quantity) }));
    this.svc.supplierModify(id, { items, notes: this.supplierNotes }).subscribe({
      next: updated => { this.successMsg.set('Quantities updated.'); this.openDetail(updated); this.load(); },
      error: (err: any) => alert(err.error?.message ?? 'Unable to modify.')
    });
  }

  statusClass(s: string): string {
    return ['COMPLETED', 'PAID'].includes(s) ? 'badge-success'
      : ['CANCELLED', 'REJECTED', 'FAILED'].includes(s) ? 'badge-danger'
      : ['SHIPPED'].includes(s) ? 'badge-shipped'
      : ['APPROVED', 'PROCESSING'].includes(s) ? 'badge-info'
      : 'badge-warn';
  }

  paymentBadgeClass(s: string): string {
    return s === 'PAID' ? 'badge-success'
      : s === 'FAILED' ? 'badge-danger'
      : s === 'PROCESSING' ? 'badge-info'
      : 'badge-warn';
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(v || 0);
  }
}
