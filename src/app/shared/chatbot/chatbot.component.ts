import { Component, computed, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ProductService } from '../../core/services/product.service';
import { SupplierService } from '../../core/services/supplier.service';
import { CategoryService } from '../../core/services/category.service';
import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { SaleService } from '../../core/services/sale.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product, ProductRequest, InventoryItem } from '../../core/models/models';

export type MsgFrom = 'bot' | 'user';
export type MsgType = 'text' | 'table' | 'chips' | 'alert';

export interface TableData { headers: string[]; rows: (string | number)[]; }
export interface ChatMessage {
  from: MsgFrom;
  type: MsgType;
  text?: string;
  table?: TableData;
  chips?: { label: string; prompt: string; icon?: string }[];
  alertLevel?: 'info' | 'warn' | 'danger' | 'success';
  time: string;
}

type PendingIntent =
  | 'ADD_PRODUCT' | 'ADD_PRODUCT_CATEGORY' | 'DELETE_PRODUCT' | 'UPDATE_INVENTORY'
  | 'ADD_WAREHOUSE_STOCK' | 'CONFIRM_DELETE'
  | null;

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('bodyRef') bodyRef!: ElementRef<HTMLDivElement>;

  private auth          = inject(AuthService);
  private productsSvc   = inject(ProductService);
  private inventorySvc  = inject(InventoryService);
  private suppliersSvc  = inject(SupplierService);
  private catSvc        = inject(CategoryService);
  private purchaseOrdSvc= inject(PurchaseOrderService);
  private dashboardSvc  = inject(DashboardService);
  private saleSvc       = inject(SaleService);
  private alertSvc      = inject(AlertService);
  private notifSvc      = inject(NotificationService);
  private router        = inject(Router);

  open   = signal(false);
  busy   = signal(false);
  draft  = '';
  private pendingIntent: PendingIntent = null;
  private pendingDeleteId: number | null = null;
  private scrollNeeded = false;

  role = computed(() => this.auth.userRole() as string ?? '');
  userName = computed(() => (this.auth.userName() as string).split(' ')[0] || 'there');
  canManage = computed(() => ['ADMIN','MANAGER'].includes(this.role()));
  isSupplier = computed(() => this.role() === 'SUPPLIER');

  messages = signal<ChatMessage[]>([this.buildWelcome()]);

  quickChips = computed((): { label: string; prompt: string; icon: string }[] => {
    if (this.isSupplier()) {
      return [
        { label: 'Show low stock items', prompt: 'show low stock',          icon: '📦' },
        { label: 'My warehouse',          prompt: 'open warehouse',          icon: '🏭' },
        { label: 'Purchase requests',     prompt: 'show purchase orders',    icon: '📋' },
        { label: 'Add warehouse stock',   prompt: 'add warehouse stock',     icon: '➕' },
      ];
    }
    if (this.canManage()) {
      return [
        { label: 'Show low stock items',  prompt: 'show low stock',         icon: '📦' },
        { label: 'Dashboard summary',     prompt: 'dashboard summary',      icon: '📊' },
        { label: 'What is out of stock?', prompt: 'out of stock',           icon: '🚫' },
        { label: 'Recent sales overview', prompt: 'recent sales',           icon: '💰' },
        { label: 'Top products',          prompt: 'top products',           icon: '🏆' },
        { label: 'Inventory value',       prompt: 'inventory value',        icon: '💎' },
        { label: 'Reorder alerts',        prompt: 'reorder alerts',         icon: '⚠️' },
        { label: 'Help me navigate',      prompt: 'help',                   icon: '🧭' },
      ];
    }
    return [
      { label: 'Open sales',           prompt: 'open sales',          icon: '💰' },
      { label: 'Check inventory',      prompt: 'check inventory',     icon: '📦' },
      { label: 'Reorder alerts',       prompt: 'reorder alerts',      icon: '⚠️' },
    ];
  });

  private buildWelcome(): ChatMessage {
    const firstName = (this.auth.userName() as string).split(' ')[0] || 'there';
    const role = this.auth.userRole() ?? 'user';
    let text = `👋 Hi ${firstName}! I'm **Inventra AI**, your smart inventory assistant.\n\nI can help you with:\n🟢 Stock levels & inventory status\n📊 Sales data & revenue insights\n⚠️ Low stock & reorder alerts\n🏆 Top-performing products\n🧭 Navigating the system`;
    if (role === 'SUPPLIER') {
      text = `👋 Hi ${firstName}! I'm **Inventra AI**.\n\nAs a supplier you can:\n🏭 Manage your warehouse stock\n📦 Add products to your warehouse\n📋 View & action purchase orders\n✅ Approve or reject supply requests\n\nWhat would you like to do?`;
    } else if (role === 'STAFF') {
      text = `👋 Hi ${firstName}! I'm **Inventra AI**.\n\nI can help you:\n💰 Record & view sales\n📦 Check inventory levels\n⚠️ View reorder alerts\n\nWhat would you like to know?`;
    }
    return { from: 'bot', type: 'text', text, time: this.now() };
  }

  ngAfterViewChecked(): void {
    if (this.scrollNeeded && this.bodyRef) {
      const el = this.bodyRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.scrollNeeded = false;
    }
  }

  toggle(): void {
    this.open.update(v => !v);
    if (this.open()) setTimeout(() => this.scrollBottom(), 50);
  }

  clearChat(): void {
    this.messages.set([this.buildWelcome()]);
    this.pendingIntent = null;
    this.pendingDeleteId = null;
  }

  useChip(prompt: string): void { this.draft = prompt; this.send(); }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.shiftKey) return;
    ke.preventDefault();
    this.send();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.busy()) return;
    this.addMsg({ from: 'user', type: 'text', text, time: this.now() });
    this.draft = '';
    if (this.pendingIntent) { this.handlePending(text); return; }
    this.dispatch(text);
  }

  private dispatch(input: string): void {
    const q = input.toLowerCase();

    if (this.isSupplier()) { this.handleSupplier(input, q); return; }

    // Navigate
    if (q === 'help' || q.includes('navigate') || q.includes('navigation')) { this.showHelp(); return; }
    if (q.includes('open sales') || q.includes('go to sales')) { this.navigate('/sales', '💰 Opening Sales page.'); return; }
    if (q.includes('open inventory') || q.includes('go to inventory')) { this.navigate('/inventory', '📦 Opening Inventory page.'); return; }
    if (q.includes('open purchase') || q.includes('go to purchase')) { this.navigate('/purchase-orders', '📋 Opening Purchase Orders page.'); return; }
    if (q.includes('open supplier') || q.includes('go to supplier')) { this.navigate('/suppliers', '🏭 Opening Suppliers page.'); return; }
    if (q.includes('open dashboard') || q.includes('go to dashboard')) { this.navigate('/dashboard', '📊 Opening Dashboard.'); return; }

    // Data queries
    if (q.includes('dashboard') || q.includes('summary') || q.includes('kpi')) { this.getDashboard(); return; }
    if ((q.includes('low stock') || q.includes('low-stock')) && !q.includes('add')) { this.getLowStock(); return; }
    if (q.includes('out of stock') || q.includes('out-of-stock')) { this.getOutOfStock(); return; }
    if (q.includes('reorder alert') || q.includes('reorder') && q.includes('alert')) { this.getReorderAlerts(); return; }
    if (q.includes('inventory value') || (q.includes('inventory') && q.includes('value'))) { this.getInventoryValue(); return; }
    if ((q.includes('check inventory') || q.includes('inventory status') || q.includes('stock level'))) { this.checkInventory(); return; }
    if (q.includes('recent sales') || q.includes('sales overview') || (q.includes('sales') && q.includes('today'))) { this.getRecentSales(); return; }
    if (q.includes('top product') || q.includes('best product') || q.includes('popular')) { this.getTopProducts(); return; }

    if (!this.canManage()) { this.handleStaff(q); return; }

    // CRUD
    if (q.startsWith('add product') || q.startsWith('create product')) { this.handleAddProduct(input, q); return; }
    if (q.startsWith('edit product') || q.startsWith('update product')) { this.editProduct(input); return; }
    if (q.startsWith('delete product') || q.startsWith('remove product')) { this.handleDeleteProduct(input); return; }
    if (q.startsWith('add supplier') || q.startsWith('create supplier')) { this.addSupplier(input); return; }
    if (q.includes('update inventory') || q.includes('adjust stock') || q.includes('update stock')) {
      this.pendingIntent = 'UPDATE_INVENTORY';
      this.bot('📦 Send inventory update like: **product 5 stock 40** (or **+10** / **-5** for adjustment).', 'info');
      return;
    }

    this.bot('🤔 I didn\'t understand that. Try asking about:\n• **Dashboard summary** – KPI overview\n• **Low stock items** – products needing restock\n• **Add product** Name price 499 cost 300\n• **Recent sales** overview\n• Type **help** for full guide.', 'info');
  }

  /* ======================== SUPPLIER HANDLERS ======================== */
  private handleSupplier(input: string, q: string): void {
    if (q.includes('warehouse') || q.includes('my stock') || q.includes('my warehouse')) {
      this.navigate('/suppliers', '🏭 Opening your warehouse. You can view and update your available stock.');
      return;
    }
    if (q.includes('purchase') || q.includes('order') || q.includes('request')) {
      const id = this.extractFirstNumber(q);
      if (q.includes('approve') && id) {
        this.busy.set(true);
        this.purchaseOrdSvc.supplierStatus(id, 'APPROVED').subscribe({
          next: () => { this.busy.set(false); this.bot('✅ Purchase Order #${id} **approved** successfully! The admin has been notified and can now complete the order.', 'success'); },
          error: err => { this.busy.set(false); this.bot(err.error?.message || `❌ Could not approve PO #${id}.`, 'danger'); }
        });
        return;
      }
      if (q.includes('reject') && id) {
        this.busy.set(true);
        this.purchaseOrdSvc.supplierStatus(id, 'REJECTED').subscribe({
          next: () => { this.busy.set(false); this.bot('❌ Purchase Order #${id} **rejected**. The admin has been notified.', 'warn'); },
          error: err => { this.busy.set(false); this.bot(err.error?.message || `Could not reject PO #${id}.`, 'danger'); }
        });
        return;
      }
      this.navigate('/purchase-orders', '📋 Opening purchase orders. You can approve, reject, or modify quantities there.');
      return;
    }
    if (q.includes('add') && (q.includes('stock') || q.includes('product') || q.includes('warehouse'))) {
      this.pendingIntent = 'ADD_WAREHOUSE_STOCK';
      this.bot('📦 To add/update warehouse stock, tell me:\n**product** [ID or name] **qty** [quantity]\n\nExample: **product 3 qty 50**\n\nOr type **open warehouse** to use the visual form.', 'info');
      return;
    }
    if (q.includes('low stock') || q.includes('low-stock')) { this.getLowStock(); return; }
    this.bot('As a supplier you can:\n• **open warehouse** – manage your stock quantities\n• **add warehouse stock** – update product quantities via chat\n• **show purchase orders** – view pending requests\n• **approve purchase [ID]** – approve a PO\n• **reject purchase [ID]** – reject a PO\n• **show low stock** – see low stock items', 'info');
  }

  /* ======================== DASHBOARD ======================== */
  private getDashboard(): void {
    this.busy.set(true);
    forkJoin({ kpi: this.dashboardSvc.getKpis() }).subscribe({
      next: ({ kpi }) => {
        this.busy.set(false);
        this.addTable(
          ['Metric', 'Value'],
          [
            '📦 Total Products', kpi.totalProducts,
            '🟡 Low Stock',      kpi.lowStockCount,
            '🔴 Out of Stock',   kpi.outOfStockCount,
            '📋 Pending Orders', kpi.pendingPurchaseOrders,
            '💰 Sales Today',    kpi.totalSalesToday,
            '💎 Inventory Value','₹' + this.fmt(kpi.totalInventoryValue),
            '🔔 Unread Alerts',  kpi.unreadAlerts,
          ],
          'Dashboard Summary'
        );
      },
      error: () => { this.busy.set(false); this.bot('Could not load dashboard data.', 'danger'); }
    });
  }

  /* ======================== LOW STOCK ======================== */
  private getLowStock(): void {
    this.busy.set(true);
    this.inventorySvc.getLowStock().subscribe({
      next: items => {
        this.busy.set(false);
        if (!items.length) { this.bot('✅ No low stock items! All products are well stocked.', 'success'); return; }
        const rows: (string | number)[] = [];
        items.slice(0, 10).forEach(i => rows.push(i.productName, i.sku, i.currentStock, i.reorderLevel, this.stockStatus(i)));
        this.addTable(['Product', 'SKU', 'Stock', 'Reorder At', 'Status'], rows, `⚠️ Low Stock (${items.length} items)`);
      },
      error: () => { this.busy.set(false); this.bot('Could not load low stock data.', 'danger'); }
    });
  }

  /* ======================== OUT OF STOCK ======================== */
  private getOutOfStock(): void {
    this.busy.set(true);
    this.inventorySvc.getOutOfStock().subscribe({
      next: items => {
        this.busy.set(false);
        if (!items.length) { this.bot('✅ No products are out of stock!', 'success'); return; }
        const rows: (string | number)[] = [];
        items.forEach(i => rows.push(i.productName, i.sku, '0', i.reorderLevel));
        this.addTable(['Product', 'SKU', 'Stock', 'Reorder At'], rows, `🔴 Out of Stock (${items.length})`);
      },
      error: () => { this.busy.set(false); this.bot('Could not load out-of-stock data.', 'danger'); }
    });
  }

  /* ======================== REORDER ALERTS ======================== */
  private getReorderAlerts(): void {
    this.busy.set(true);
    this.inventorySvc.getLowStock().subscribe({
      next: items => {
        this.busy.set(false);
        if (!items.length) { this.bot('✅ No reorder alerts at this time.', 'success'); return; }
        const rows: (string | number)[] = [];
        items.slice(0, 8).forEach(i => rows.push(
          i.productName, i.currentStock, i.reorderLevel,
          Math.max(0, i.reorderLevel * 2 - i.currentStock) + ' units'
        ));
        this.addTable(['Product', 'Current Stock', 'Reorder At', 'Suggested Order'], rows, `🔔 Reorder Alerts`);
      },
      error: () => { this.busy.set(false); this.bot('Could not load reorder data.', 'danger'); }
    });
  }

  /* ======================== INVENTORY VALUE ======================== */
  private getInventoryValue(): void {
    this.busy.set(true);
    forkJoin({ all: this.inventorySvc.getAll(), kpi: this.dashboardSvc.getKpis() }).subscribe({
      next: ({ all, kpi }) => {
        this.busy.set(false);
        this.bot('💎 Total Inventory Value: **₹${this.fmt(kpi.totalInventoryValue)}**\n📦 ${all.length} products tracked\n🟡 ${kpi.lowStockCount} low stock, 🔴 ${kpi.outOfStockCount} out of stock.', 'info');
      },
      error: () => { this.busy.set(false); this.bot('Could not load inventory value.', 'danger'); }
    });
  }

  /* ======================== CHECK INVENTORY ======================== */
  private checkInventory(): void {
    this.busy.set(true);
    forkJoin({ all: this.inventorySvc.getAll(), low: this.inventorySvc.getLowStock(), out: this.inventorySvc.getOutOfStock() }).subscribe({
      next: ({ all, low, out }) => {
        this.busy.set(false);
        const total = all.reduce((s, i) => s + i.currentStock, 0);
        const rows: (string | number)[] = [];
        ['✅ In Stock', all.length - low.length - out.length,
         '🟡 Low Stock', low.length,
         '🔴 Out of Stock', out.length,
         '📦 Total Units', total].forEach((v, i, a) => { if (i % 2 === 0) rows.push(v, a[i+1]); });
        this.addTable(['Category', 'Count'], rows, '📦 Inventory Status');
        if (low.length > 0) {
          this.bot('⚠️ **${low.length} items** need restocking. Top: ${low.slice(0,3).map(i => i.productName).join(\', \')}. Type **show low stock** for details.', 'warn');
        }
      },
      error: () => { this.busy.set(false); this.bot('Could not check inventory.', 'danger'); }
    });
  }

  /* ======================== RECENT SALES ======================== */
  private getRecentSales(): void {
    this.busy.set(true);
    this.saleSvc.getAll().subscribe({
      next: sales => {
        this.busy.set(false);
        if (!sales.length) { this.bot('No sales data found.', 'info'); return; }
        const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const recent = sorted.slice(0, 5);
        const total = sales.reduce((s, sale) => s + sale.totalAmount, 0);
        const rows: (string | number)[] = [];
        recent.forEach(s => rows.push('#' + s.id, s.customerName || 'Walk-in', '₹' + this.fmt(s.totalAmount), s.paymentStatus, s.saleDate));
        this.addTable(['ID', 'Customer', 'Amount', 'Payment', 'Date'], rows, `💰 Recent Sales (${sales.length} total, ₹${this.fmt(total)} revenue)`);
      },
      error: () => { this.busy.set(false); this.bot('Could not load sales data.', 'danger'); }
    });
  }

  /* ======================== TOP PRODUCTS ======================== */
  private getTopProducts(): void {
    this.busy.set(true);
    this.productsSvc.getAll().subscribe({
      next: products => {
        this.busy.set(false);
        if (!products.length) { this.bot('No products found.', 'info'); return; }
        const top = [...products]
          .filter(p => p.currentStock > 0)
          .sort((a, b) => b.currentStock - a.currentStock)
          .slice(0, 8);
        const rows: (string | number)[] = [];
        top.forEach(p => rows.push(p.name, p.sku, p.currentStock, '₹' + this.fmt(p.price), p.stockStatus));
        this.addTable(['Product', 'SKU', 'Stock', 'Price', 'Status'], rows, `🏆 Top Products by Stock`);
      },
      error: () => { this.busy.set(false); this.bot('Could not load products.', 'danger'); }
    });
  }

  /* ======================== ADD PRODUCT ======================== */
  private handleAddProduct(input: string, q: string): void {
    if (!this.hasProductRequirements(input)) {
      this.pendingIntent = 'ADD_PRODUCT';
      this.bot('📦 Please provide product details:\n\n**name** [name] **price** [price] **cost** [cost] **stock** [qty] **reorder** [qty]\n\nExample: Mouse price 499 cost 300 stock 20\n\n(sku, stock, reorder are optional)', 'info');
      return;
    }
    this.doAddProduct(input);
  }

  private doAddProduct(input: string): void {
    const name = this.extractName(input, 'add product', ['sku','price','cost','stock','reorder','category'])
               || this.extractName(input, 'create product', ['sku','price','cost','stock','reorder','category'])
               || this.extractName(input, 'product', ['sku','price','cost','stock','reorder','category']);
    const sku        = this.extractWord(input, 'sku') || `SKU-${Date.now()}`;
    const price      = this.extractNumber(input, 'price');
    const cost       = this.extractNumber(input, 'cost');
    const stock      = this.extractNumber(input, 'stock') ?? 0;
    const reorder    = this.extractNumber(input, 'reorder') ?? 0;
    const categoryId = this.extractNumber(input, 'category');

    if (!name?.trim()) { this.bot('❌ Product name is required.', 'danger'); return; }
    if (price === undefined || price < 0) { this.bot('❌ Price is required and must be 0 or more.', 'danger'); return; }
    if (cost === undefined || cost < 0) { this.bot('❌ Cost price is required and must be 0 or more.', 'danger'); return; }
    if (price < cost) { this.bot('⚠️ Selling price is lower than cost price. Proceeding...', 'warn'); }

    // If no category provided, load categories and show them for selection
    if (categoryId === undefined) {
      this.busy.set(true);
      this.catSvc.getAll().subscribe({
        next: (cats: any[]) => {
          this.busy.set(false);
          const catList = cats.map((c: any) => `**${c.id}** — ${c.name}`).join('\n');
          this.bot(`📂 **Select a category for "${name}":**\n\n${catList}\n\nReply with: **category [ID]** to complete adding the product.\n\nOr type **0** to skip category.`, 'info');
          this.pendingAddData = { name: name.trim(), sku, price, cost, stock, reorder };
          this.pendingIntent = 'ADD_PRODUCT_CATEGORY';
        },
        error: () => {
          this.busy.set(false);
          this.createProduct(name.trim(), sku, price, cost, stock, reorder, undefined);
        }
      });
      return;
    }

    this.createProduct(name.trim(), sku, price, cost, stock, reorder, categoryId);
  }

  private pendingAddData: any = null;

  private createProduct(name: string, sku: string, price: number, cost: number, stock: number, reorder: number, categoryId?: number): void {
    const req: ProductRequest = {
      name, sku, price, costPrice: cost, currentStock: stock, reorderLevel: reorder,
      description: 'Added via Inventra AI',
      ...(categoryId && categoryId > 0 ? { categoryId } : {})
    };
    this.busy.set(true);
    this.productsSvc.create(req).subscribe({
      next: p => {
        this.busy.set(false);
        this.bot(`✅ **Product created!**\n📌 **${p.name}** (${p.sku})\n💰 Selling: ₹${p.price} | Cost: ₹${p.costPrice}\n📦 Stock: ${p.currentStock}${p.categoryName ? '\n📂 Category: ' + p.categoryName : ''}`, 'success');
      },
      error: err => { this.busy.set(false); this.bot('❌ ' + (err.error?.message || 'Could not create product.'), 'danger'); }
    });
  }

  /* ======================== EDIT PRODUCT ======================== */
  private editProduct(input: string): void {
    const id = this.extractFirstNumber(input);
    if (!id) { this.bot('❌ Please include the product ID. Example: **edit product 4 price 899 stock 15**', 'warn'); return; }
    this.busy.set(true);
    this.productsSvc.getById(id).subscribe({
      next: product => {
        const req: ProductRequest = {
          name:         this.extractName(input, 'name', ['sku','price','cost','stock','reorder']) || product.name,
          sku:          this.extractWord(input, 'sku') || product.sku,
          description:  product.description,
          categoryId:   product.categoryId,
          supplierId:   product.supplierId,
          price:        this.extractNumber(input, 'price') ?? product.price,
          costPrice:    this.extractNumber(input, 'cost') ?? product.costPrice,
          currentStock: this.extractNumber(input, 'stock') ?? product.currentStock,
          reorderLevel: this.extractNumber(input, 'reorder') ?? product.reorderLevel
        };
        if (req.price < req.costPrice) { this.bot('⚠️ Warning: Selling price is lower than cost price.', 'warn'); }
        this.productsSvc.update(product.id, req).subscribe({
          next: p => { this.busy.set(false); this.bot('✅ **Product #${p.id} updated!**\n📌 ${p.name}\n💰 Price: ₹${p.price} | Stock: ${p.currentStock}', 'success'); },
          error: err => { this.busy.set(false); this.bot('❌ ' + (err.error?.message || 'Could not update product.'), 'danger'); }
        });
      },
      error: () => { this.busy.set(false); this.bot('❌ Product #${id} not found.', 'danger'); }
    });
  }

  /* ======================== DELETE PRODUCT ======================== */
  private handleDeleteProduct(input: string): void {
    const id = this.extractFirstNumber(input);
    if (!id) { this.pendingIntent = 'DELETE_PRODUCT'; this.bot('🗑️ Which product ID to delete? Example: **42**', 'warn'); return; }
    if (this.role() !== 'ADMIN') { this.bot('🔒 Only Admin users can delete products.', 'danger'); return; }
    this.pendingDeleteId = id;
    this.pendingIntent = 'CONFIRM_DELETE';
    this.bot('⚠️ Are you sure you want to delete **Product #${id}**? This cannot be undone.\nType **yes** to confirm or **no** to cancel.', 'warn');
  }

  /* ======================== ADD SUPPLIER ======================== */
  private addSupplier(input: string): void {
    const name = this.extractName(input, 'add supplier', ['email','phone','contact','address'])
               || this.extractName(input, 'create supplier', ['email','phone','contact','address']);
    const email       = this.extractWord(input, 'email') || '';
    const phone       = this.extractWord(input, 'phone') || '';
    const contactName = this.extractName(input, 'contact', ['email','phone','address']) || name;
    const address     = this.extractName(input, 'address', ['email','phone','contact']) || '';

    if (!name?.trim()) { this.bot('❌ Supplier name is required.\nExample: **add supplier Acme email acme@mail.com phone 9999999999**', 'danger'); return; }
    if (email && !this.validEmail(email)) { this.bot('❌ Invalid email address format.', 'danger'); return; }
    if (phone && !this.validPhone(phone)) { this.bot('❌ Invalid phone number (6-20 digits allowed).', 'danger'); return; }

    this.busy.set(true);
    this.suppliersSvc.create({ name: name.trim(), email, phone, contactName, address }).subscribe({
      next: s => { this.busy.set(false); this.bot('✅ **Supplier added!**\n🏭 ${s.name}\n📧 ${s.email || \'No email\'} | 📞 ${s.phone || \'No phone\'}', 'success'); },
      error: err => { this.busy.set(false); this.bot('❌ ' + (err.error?.message || 'Could not add supplier.'), 'danger'); }
    });
  }

  /* ======================== PENDING HANDLERS ======================== */
  private handlePending(input: string): void {
    const q = input.toLowerCase().trim();
    const intent = this.pendingIntent;
    this.pendingIntent = null;

    if (intent === 'ADD_PRODUCT') {
      this.doAddProduct(q.startsWith('add product') ? input : `add product ${input}`);
      return;
    }
    if (intent === 'ADD_PRODUCT_CATEGORY') {
      const catId = this.extractFirstNumber(input);
      const d = this.pendingAddData;
      this.pendingAddData = null;
      if (d) {
        this.createProduct(d.name, d.sku, d.price, d.cost, d.stock, d.reorder, catId && catId > 0 ? catId : undefined);
      }
      return;
    }
    if (intent === 'DELETE_PRODUCT') {
      this.handleDeleteProduct(q.includes('product') ? input : `delete product ${input}`);
      return;
    }
    if (intent === 'CONFIRM_DELETE') {
      if (q === 'yes' || q === 'y') {
        const id = this.pendingDeleteId!;
        this.pendingDeleteId = null;
        this.busy.set(true);
        this.productsSvc.delete(id).subscribe({
          next: () => { this.busy.set(false); this.bot('✅ Product #${id} deleted.', 'success'); },
          error: err => { this.busy.set(false); this.bot('❌ ' + (err.error?.message || `Could not delete #${id}.`), 'danger'); }
        });
      } else {
        this.pendingDeleteId = null;
        this.bot('❎ Delete cancelled.', 'info');
      }
      return;
    }
    if (intent === 'UPDATE_INVENTORY') {
      const productId = this.extractNumber(input, 'product') ?? this.extractFirstNumber(input);
      const stock     = this.extractNumber(input, 'stock') ?? this.extractNumber(input, 'qty');
      if (!productId || stock === undefined) {
        this.bot('❌ Need product id and stock. Example: **product 5 stock 40**', 'danger');
        this.pendingIntent = 'UPDATE_INVENTORY';
        return;
      }
      this.editProduct(`edit product ${productId} stock ${stock}`);
      return;
    }
    if (intent === 'ADD_WAREHOUSE_STOCK') {
      const productId = this.extractNumber(input, 'product') ?? this.extractFirstNumber(input);
      const qty       = this.extractNumber(input, 'qty') ?? this.extractNumber(input, 'quantity') ?? this.extractNumber(input, 'stock');
      if (!productId || qty === undefined) {
        this.bot('❌ Need product id and quantity.\nExample: **product 3 qty 50**', 'danger');
        this.pendingIntent = 'ADD_WAREHOUSE_STOCK';
        return;
      }
      if (qty < 0) { this.bot('❌ Quantity must be 0 or more.', 'danger'); this.pendingIntent = 'ADD_WAREHOUSE_STOCK'; return; }
      this.busy.set(true);
      this.suppliersSvc.getAll().subscribe({
        next: all => {
          const me = this.auth.currentUser();
          const mySupplier = all.find(s => s.email?.toLowerCase() === me?.email?.toLowerCase());
          if (!mySupplier) { this.busy.set(false); this.bot('❌ No supplier profile is linked to your account. Contact admin.', 'danger'); return; }
          this.suppliersSvc.upsertWarehouse(mySupplier.id, { productId, availableQuantity: qty }).subscribe({
            next: w => { this.busy.set(false); this.bot('✅ Warehouse stock updated!\n📦 ${w.productName} → **${w.availableQuantity} units** available.', 'success'); },
            error: err => { this.busy.set(false); this.bot('❌ ' + (err.error?.message || 'Could not update warehouse.'), 'danger'); }
          });
        },
        error: () => { this.busy.set(false); this.bot('❌ Could not find your supplier profile.', 'danger'); }
      });
      return;
    }
  }

  /* ======================== STAFF ======================== */
  private handleStaff(q: string): void {
    if (q.includes('sale') || q.includes('sell')) { this.navigate('/sales', '💰 Opening Sales.'); return; }
    if (q.includes('inventory') || q.includes('stock')) { this.navigate('/inventory', '📦 Opening Inventory (view-only for staff).'); return; }
    if (q.includes('reorder') || q.includes('low stock')) { this.getReorderAlerts(); return; }
    this.bot('Staff can:\n• **open sales** – record a sale\n• **open inventory** – view stock\n• **reorder alerts** – see what needs restocking', 'info');
  }

  /* ======================== HELP ======================== */
  private showHelp(): void {
    const role = this.role();
    if (role === 'SUPPLIER') {
      this.bot('🧭 **Supplier Commands:**\n• **open warehouse** – manage your product quantities\n• **add warehouse stock** – update qty via chat\n• **show purchase orders** – view pending POs\n• **approve purchase [ID]** – approve a PO\n• **reject purchase [ID]** – reject a PO\n• **show low stock** – view low stock items', 'info');
      return;
    }
    if (this.canManage()) {
      this.bot('🧭 **Available Commands:**\n• **dashboard summary** – KPI overview\n• **show low stock** – low stock items table\n• **out of stock** – out-of-stock list\n• **reorder alerts** – items to reorder\n• **inventory value** – total value\n• **recent sales** – sales overview\n• **top products** – best stocked items\n• **add product** Name price X cost Y\n• **edit product** [ID] price X stock Y\n• **delete product** [ID] *(admin only)*\n• **add supplier** Name email X phone Y\n• **update inventory** – adjust stock', 'info');
      return;
    }
    this.bot('🧭 **Staff Commands:**\n• **open sales** – go to sales page\n• **open inventory** – view inventory\n• **reorder alerts** – what needs restocking', 'info');
  }

  /* ======================== NAVIGATE ======================== */
  private navigate(path: string, msg: string): void {
    this.router.navigateByUrl(path);
    this.bot(msg, 'info');
  }

  /* ======================== HELPERS ======================== */
  private addMsg(msg: ChatMessage): void {
    this.messages.update(m => [...m, msg]);
    this.scrollNeeded = true;
  }

  private bot(text: string, level: 'info' | 'warn' | 'danger' | 'success' = 'info'): void {
    this.addMsg({ from: 'bot', type: 'alert', text, alertLevel: level, time: this.now() });
  }

  private addTable(headers: string[], flatRows: (string | number)[], title?: string): void {
    const rows: (string | number)[] = flatRows;
    this.addMsg({ from: 'bot', type: 'table', table: { headers, rows }, text: title, time: this.now() });
  }

  private scrollBottom(): void { this.scrollNeeded = true; }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private fmt(v: number | string): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
  }

  private stockStatus(i: InventoryItem): string {
    if (i.currentStock === 0) return '🔴 Out';
    if (i.currentStock <= i.reorderLevel) return '🟡 Low';
    return '✅ OK';
  }

  getTableRows(table: TableData): (string | number)[][] {
    const cols = table.headers.length;
    const result: (string | number)[][] = [];
    for (let i = 0; i < table.rows.length; i += cols) {
      result.push(table.rows.slice(i, i + cols));
    }
    return result;
  }

  private hasProductRequirements(input: string): boolean {
    const name  = this.extractName(input, 'add product', ['sku','price','cost','stock','reorder'])
               || this.extractName(input, 'create product', ['sku','price','cost','stock','reorder']);
    return !!name?.trim()
      && this.extractNumber(input, 'price') !== undefined
      && this.extractNumber(input, 'cost')  !== undefined;
  }

  private extractFirstNumber(input: string): number | undefined {
    const match = input.match(/\d+/);
    return match ? Number(match[0]) : undefined;
  }

  private extractNumber(input: string, key: string): number | undefined {
    const match = input.match(new RegExp(`${key}\\s+([0-9]+(?:\\.[0-9]+)?)`, 'i'));
    return match ? Number(match[1]) : undefined;
  }

  private extractWord(input: string, key: string): string | undefined {
    const match = input.match(new RegExp(`${key}\\s+([^\\s]+)`, 'i'));
    return match?.[1]?.trim();
  }

  private extractName(input: string, startKey: string, stopKeys: string[]): string {
    const lower = input.toLowerCase();
    const start = lower.indexOf(startKey.toLowerCase());
    if (start < 0) return '';
    let text = input.slice(start + startKey.length).trim();
    for (const key of stopKeys) {
      const idx = text.toLowerCase().indexOf(` ${key} `);
      if (idx >= 0) text = text.slice(0, idx).trim();
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  private validEmail(email: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim());
  }

  private validPhone(phone: string): boolean {
    return /^[0-9+\-\s()]{6,20}$/.test(phone.trim());
  }

  formatText(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
