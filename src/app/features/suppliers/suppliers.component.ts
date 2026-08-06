import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../core/services/supplier.service';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { Supplier, SupplierWarehouseStock, Product, Category } from '../../core/models/models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css'
})
export class SuppliersComponent implements OnInit {
  private svc    = inject(SupplierService);
  private prdSvc = inject(ProductService);
  private catSvc = inject(CategoryService);
  auth           = inject(AuthService);

  isSupplier = this.auth.userRole() === 'SUPPLIER';

  suppliers         = signal<Supplier[]>([]);
  products          = signal<Product[]>([]);
  /** Root categories with subcategories[] populated */
  categories        = signal<Category[]>([]);
  warehouse         = signal<SupplierWarehouseStock[]>([]);
  loading           = signal(true);
  showModal         = signal(false);
  showWarehouse     = signal(false);
  saving            = signal(false);
  editId            = signal<number | null>(null);
  warehouseSupplier = signal<Supplier | null>(null);
  error             = signal('');
  stockError        = signal('');
  successMsg        = signal('');

  activeSupplierCount = computed(() => this.suppliers().length);

  // ── Category / product selection state ──────────────────────────────────
  /** Selected category ID for filtering (0 = all, positive = root or sub) */
  selectedCategoryId = 0;
  productSearch      = '';
  selectedProduct    = signal<Product | null>(null);
  showProdDrop       = signal(false);
  filteredProducts   = signal<Product[]>([]);

  // ── Stock form fields ────────────────────────────────────────────────────
  stockQty    = 0;
  costPrice   = 0;
  supplierSku = '';

  // ── Supplier add/edit form ────────────────────────────────────────────────
  form = { name: '', email: '', phone: '', address: '', contactName: '' };

  ngOnInit(): void {
    // Load products with full detail (categoryId, categoryName, parentCategoryName)
    this.prdSvc.getAll().subscribe(d => this.products.set(d));
    // Load categories as tree (root → subcategories[])
    this.catSvc.getAll().subscribe(d => this.categories.set(d));

    if (this.isSupplier) {
      this.loading.set(false);
      this.loadMyWarehouse();
    } else {
      this.svc.getAll().subscribe({
        next: d => { this.suppliers.set(d); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    }
  }

  loadMyWarehouse(): void {
    this.loading.set(true);
    this.svc.getMyWarehouse().subscribe({
      next: d => { this.warehouse.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // ── Category changed → reset product search ──────────────────────────────
  onCategoryChange(): void {
    this.productSearch = '';
    this.selectedProduct.set(null);
    this.filteredProducts.set([]);
    this.showProdDrop.set(false);
  }

  // ── Filter products by category + keyword ────────────────────────────────
  filterProducts(q: string): void {
    this.productSearch = q;
    this.selectedProduct.set(null);
    const catId = this.selectedCategoryId;

    // Build pool: match by root category OR subcategory
    let pool: Product[];
    if (catId > 0) {
      // Find all category IDs that match: the selected ID itself OR any sub whose parent is selected
      const matchIds = new Set<number>();
      matchIds.add(catId);
      // Check subcategories in loaded tree
      for (const root of this.categories()) {
        if (root.id === catId) {
          // User selected a root category → include all its subcategories
          for (const sub of root.subcategories || []) matchIds.add(sub.id);
        }
        for (const sub of root.subcategories || []) {
          if (sub.id === catId) {
            // User selected a subcategory → include only that sub
            matchIds.add(sub.id);
          }
        }
      }
      pool = this.products().filter(p => p.categoryId != null && matchIds.has(p.categoryId));
    } else {
      pool = this.products();
    }

    const kw = q.trim().toLowerCase();
    const hits = kw
      ? pool.filter(p =>
          p.name.toLowerCase().includes(kw) ||
          p.sku.toLowerCase().includes(kw)
        ).slice(0, 15)
      : pool.slice(0, 15);

    this.filteredProducts.set(hits);
    this.showProdDrop.set(hits.length > 0);
  }

  pickProduct(p: Product): void {
    this.selectedProduct.set(p);
    this.productSearch  = p.name;
    this.costPrice      = p.costPrice ?? 0;
    this.showProdDrop.set(false);
  }

  hideDrop(): void { setTimeout(() => this.showProdDrop.set(false), 160); }

  quickEditWarehouse(w: SupplierWarehouseStock): void {
    const prod = this.products().find(p => p.id === w.productId);
    if (!prod) return;
    this.productSearch = w.productName;
    this.selectedProduct.set(prod);
    this.stockQty    = w.availableQuantity;
    this.costPrice   = w.costPrice ?? 0;
    this.supplierSku = w.supplierSku ?? '';
    this.stockError.set('');
    this.successMsg.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveMyStock(): void {
    this.stockError.set('');
    this.successMsg.set('');
    const prod = this.selectedProduct();
    if (!prod)                     { this.stockError.set('Please select a product from the dropdown.'); return; }
    if (this.stockQty < 0)         { this.stockError.set('Quantity must be 0 or more.'); return; }
    if (!Number.isInteger(Number(this.stockQty))) { this.stockError.set('Quantity must be a whole number.'); return; }
    this.saving.set(true);
    this.svc.upsertMyWarehouse({
      productId:         prod.id,
      availableQuantity: Number(this.stockQty),
      costPrice:         Number(this.costPrice) || undefined,
      supplierSku:       this.supplierSku || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set(`Stock updated: ${prod.name} set to ${this.stockQty} units.`);
        this.productSearch = '';
        this.selectedProduct.set(null);
        this.stockQty  = 0;
        this.costPrice = 0;
        this.supplierSku = '';
        this.loadMyWarehouse();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.stockError.set(err.error?.message ?? 'Failed to update stock.');
      }
    });
  }

  openWarehouse(s: Supplier): void {
    this.warehouseSupplier.set(s);
    this.productSearch = '';
    this.selectedProduct.set(null);
    this.stockQty    = 0;
    this.costPrice   = 0;
    this.supplierSku = '';
    this.stockError.set('');
    this.successMsg.set('');
    this.showWarehouse.set(true);
    this.svc.getWarehouseAsAdmin(s.id).subscribe(d => this.warehouse.set(d));
  }

  closeWarehouse(): void { this.showWarehouse.set(false); }

  saveAdminStock(): void {
    this.stockError.set('');
    this.successMsg.set('');
    const prod = this.selectedProduct();
    const sup  = this.warehouseSupplier();
    if (!prod) { this.stockError.set('Please select a product.'); return; }
    if (this.stockQty < 0) { this.stockError.set('Quantity must be 0 or more.'); return; }
    if (!sup) return;
    this.saving.set(true);
    this.svc.upsertWarehouse(sup.id, {
      productId:         prod.id,
      availableQuantity: Number(this.stockQty),
      costPrice:         Number(this.costPrice) || undefined,
      supplierSku:       this.supplierSku || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set(`Stock updated for ${prod.name}.`);
        this.productSearch = '';
        this.selectedProduct.set(null);
        this.stockQty  = 0;
        this.costPrice = 0;
        this.svc.getWarehouseAsAdmin(sup.id).subscribe(d => this.warehouse.set(d));
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.stockError.set(err.error?.message ?? 'Failed to update stock.');
      }
    });
  }

  openCreate(): void {
    this.form = { name: '', email: '', phone: '', address: '', contactName: '' };
    this.error.set('');
    this.editId.set(null);
    this.showModal.set(true);
  }

  openEdit(s: Supplier): void {
    this.form = {
      name: s.name, email: s.email ?? '',
      phone: s.phone ?? '', address: s.address ?? '',
      contactName: s.contactName ?? ''
    };
    this.error.set('');
    this.editId.set(s.id);
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.error.set(''); }

  save(): void {
    this.error.set('');
    if (!this.form.name.trim())               { this.error.set('Supplier name is required.'); return; }
    if (this.form.name.trim().length < 2)     { this.error.set('Name must be at least 2 characters.'); return; }
    if (this.form.email && !this.isValidEmail(this.form.email)) { this.error.set('Invalid email address.'); return; }
    if (this.form.phone && !this.isValidPhone(this.form.phone)) { this.error.set('Phone must be 6–20 digits.'); return; }
    if (this.form.phone && this.form.phone.trim()) {
      const dup = this.suppliers().find(s =>
        s.phone && s.phone.replace(/\s/g,'') === this.form.phone.trim().replace(/\s/g,'')
        && s.id !== this.editId()
      );
      if (dup) { this.error.set(`Phone already used by "${dup.name}".`); return; }
    }
    this.saving.set(true);
    const obs = this.editId()
      ? this.svc.update(this.editId()!, this.form)
      : this.svc.create(this.form);
    obs.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.ngOnInit(); },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(err.error?.message ?? 'Failed to save.');
      }
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this supplier? This cannot be undone.')) return;
    this.svc.delete(id).subscribe({
      next: () => this.ngOnInit(),
      error: (err: { error?: { message?: string } }) => alert(err.error?.message ?? 'Cannot delete.')
    });
  }

  isValidEmail(e: string): boolean { return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e.trim()); }
  isValidPhone(p: string): boolean { return /^[0-9+\-\s()]{6,20}$/.test(p.trim()); }
}
