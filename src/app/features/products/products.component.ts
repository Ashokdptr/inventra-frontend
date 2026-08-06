import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { SupplierService } from '../../core/services/supplier.service';
import { Product, ProductRequest, Category, Supplier } from '../../core/models/models';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  auth           = inject(AuthService);
  private svc    = inject(ProductService);
  private catSvc = inject(CategoryService);
  private supSvc = inject(SupplierService);

  products   = signal<Product[]>([]);
  filtered   = signal<Product[]>([]);
  // Tree categories (for 2-step picker)
  categories    = signal<Category[]>([]);
  // Selected main category in form
  selectedMainCatId = signal<number | undefined>(undefined);
  // Subcategories computed from selected main
  subcategories = computed(() => {
    const main = this.categories().find(c => c.id === this.selectedMainCatId());
    return main?.subcategories ?? [];
  });
  suppliers  = signal<Supplier[]>([]);
  loading    = signal(true);
  showModal  = signal(false);
  saving     = signal(false);
  editId     = signal<number | null>(null);
  error      = signal('');
  page       = signal(1);
  pageSize   = 10;

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  pagedProducts = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  total         = computed(() => this.products().length);
  inStockCount  = computed(() => this.products().filter(p => (p as any).stockStatus === 'IN_STOCK' || (p as any).currentStock > ((p as any).reorderLevel || 0)).length);
  lowStockCount = computed(() => this.products().filter(p => (p as any).stockStatus === 'LOW_STOCK').length);
  outOfStockCount = computed(() => this.products().filter(p => (p as any).stockStatus === 'OUT_OF_STOCK' || (p as any).currentStock === 0).length);
  newThisMonth  = computed(() => {
    const month = new Date().toISOString().slice(0, 7);
    return this.products().filter(p => (p as any).createdAt?.startsWith(month)).length;
  });

  keyword          = '';
  selectedCategory = '';
  selectedSupplier = '';
  searching        = false;

  form: ProductRequest = this.emptyForm();

  ngOnInit(): void {
    this.load();
    this.catSvc.getAll().subscribe(d => this.categories.set(d));
    this.supSvc.getAll().subscribe(d => this.suppliers.set(d));
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.products.set(d); this.filtered.set(d); this.page.set(1); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  search(): void {
    const kw  = this.keyword.trim() || undefined;
    const cat = this.selectedCategory ? +this.selectedCategory : undefined;
    const sup = this.selectedSupplier ? +this.selectedSupplier : undefined;
    if (!kw && !cat && !sup) { this.filtered.set(this.products()); this.page.set(1); return; }
    this.searching = true;
    this.svc.search(kw, cat, sup).subscribe({
      next: d => { this.filtered.set(d); this.page.set(1); this.searching = false; },
      error: () => this.searching = false
    });
  }

  clearSearch(): void {
    this.keyword = ''; this.selectedCategory = ''; this.selectedSupplier = '';
    this.filtered.set(this.products()); this.page.set(1);
  }

  openCreate(): void {
    this.form = { ...this.emptyForm(), currentStock: 0 };
    this.selectedMainCatId.set(undefined);
    this.error.set(''); this.editId.set(null); this.showModal.set(true);
  }

  openEdit(p: Product): void {
    this.form = {
      name: p.name, sku: p.sku, barcode: p.barcode, description: p.description,
      imageUrl: p.imageUrl, expiryDate: p.expiryDate,
      categoryId: p.categoryId, supplierId: p.supplierId,
      price: p.price, costPrice: p.costPrice, reorderLevel: p.reorderLevel, currentStock: p.currentStock
    };
    // Restore main cat from subcategory
    if (p.categoryId) {
      const main = this.categories().find(c =>
        c.subcategories?.some(s => s.id === p.categoryId)
      );
      this.selectedMainCatId.set(main?.id);
    } else {
      this.selectedMainCatId.set(undefined);
    }
    this.error.set('');
    this.editId.set(p.id);
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.error.set(''); }

  save(): void {
    this.error.set('');
    // ── Validations ──────────────────────────────────────
    if (!this.form.name?.trim()) { this.error.set('Product name is required.'); return; }
    if (this.form.name.trim().length < 2) { this.error.set('Product name must be at least 2 characters.'); return; }
    if (this.form.name.trim().length > 120) { this.error.set('Product name must be 120 characters or fewer.'); return; }

    if (this.form.sku?.trim()) {
      if (!/^[A-Za-z0-9\-_]{2,40}$/.test(this.form.sku.trim())) {
        this.error.set('SKU must be 2–40 alphanumeric characters (hyphens/underscores allowed).'); return;
      }
      const duplicate = this.products().some(p => p.sku === this.form.sku?.trim() && p.id !== this.editId());
      if (duplicate) { this.error.set('A product with this SKU already exists.'); return; }
    }

    if (this.form.price === null || this.form.price === undefined || isNaN(Number(this.form.price))) {
      this.error.set('Selling price is required.'); return;
    }
    if (Number(this.form.price) < 0) { this.error.set('Selling price cannot be negative.'); return; }

    if (this.form.costPrice === null || this.form.costPrice === undefined || isNaN(Number(this.form.costPrice))) {
      this.error.set('Cost price is required.'); return;
    }
    if (Number(this.form.costPrice) < 0) { this.error.set('Cost price cannot be negative.'); return; }

    if (Number(this.form.price) < Number(this.form.costPrice)) {
      this.error.set('⚠️ Selling price is less than cost price — check before saving.'); return;
    }

    if (this.form.reorderLevel !== undefined && Number(this.form.reorderLevel) < 0) {
      this.error.set('Reorder level cannot be negative.'); return;
    }
    // Stock must be 0 when creating a new product; it is updated only via purchase orders
    if (!this.editId()) {
      this.form.currentStock = 0;
    } else if (this.form.currentStock !== undefined && Number(this.form.currentStock) < 0) {
      this.error.set('Stock quantity cannot be negative.'); return;
    }

    this.saving.set(true);
    const obs = this.editId() ? this.svc.update(this.editId()!, this.form) : this.svc.create(this.form);
    obs.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to save product. Please try again.'); }
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this product? This action cannot be undone.')) return;
    this.svc.delete(id).subscribe({
      next: () => this.load(),
      error: err => alert(err.error?.message ?? 'Cannot delete this product (may be referenced by sales or purchase orders).')
    });
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  statusClass(s: string): string {
    return s === 'IN_STOCK' ? 'badge-success' : s === 'LOW_STOCK' ? 'badge-warn' : 'badge-danger';
  }
  statusLabel(s: string): string {
    return s === 'IN_STOCK' ? 'In Stock' : s === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock';
  }

  private isValidUrl(url: string): boolean {
    return /^https?:\/\/.+\..+/.test(url);
  }

  private emptyForm(): ProductRequest {
    return { name: '', sku: '', barcode: '', description: '', imageUrl: '', expiryDate: '', price: 0, costPrice: 0, reorderLevel: 0, currentStock: 0 };
  }
}
