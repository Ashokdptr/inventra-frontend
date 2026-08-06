import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { SupplierService } from '../../core/services/supplier.service';
import { SupplierWarehouseStock } from '../../core/models/models';
import { AlertService } from '../../core/services/alert.service';
import { InventoryService } from '../../core/services/inventory.service';
import { SaleService } from '../../core/services/sale.service';
import { DashboardKpi, Alert, InventoryItem, Sale, PurchaseOrder } from '../../core/models/models';

const CAT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const SUP_COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, SlicePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private dashSvc  = inject(DashboardService);
  private invSvc   = inject(InventoryService);
  private alertSvc = inject(AlertService);
  private saleSvc  = inject(SaleService);
  auth             = inject(AuthService);
  private poSvc    = inject(PurchaseOrderService);
  private supSvc   = inject(SupplierService);

  isSupplier = this.auth.userRole() === 'SUPPLIER';
  Math = Math;
  period = signal<'monthly'|'yearly'>('monthly');

  supplierOrders = signal<PurchaseOrder[]>([]);
  allOrders      = signal<PurchaseOrder[]>([]);
  warehouseStock = signal<SupplierWarehouseStock[]>([]);
  pendingPOs     = signal(0);
  approvedPOs    = signal(0);
  rejectedPOs    = signal(0);
  totalSupplied  = signal(0);

  kpi          = signal<DashboardKpi | null>(null);
  lowStock     = signal<InventoryItem[]>([]);
  inventory    = signal<InventoryItem[]>([]);
  recentAlerts = signal<Alert[]>([]);
  sales        = signal<Sale[]>([]);
  loading      = signal(true);

  greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });
  firstName = computed(() => ((this.auth.userName() as string) || '').split(' ')[0]);

  dateRangeLabel = computed(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    return `${fmt(start)} - ${fmt(now)}`;
  });

  stockStatus = computed(() => {
    const items = this.inventory();
    return [
      { label: 'In Stock',   value: items.filter(i => i.stockStatus === 'IN_STOCK').length,    color: '#16a34a' },
      { label: 'Low Stock',  value: items.filter(i => i.stockStatus === 'LOW_STOCK').length,   color: '#f59e0b' },
      { label: 'Out of Stock', value: items.filter(i => i.stockStatus === 'OUT_OF_STOCK').length, color: '#ef4444' }
    ];
  });

  donutPct = computed(() => {
    const total = this.inventory().length || 1;
    const s = this.stockStatus();
    const p0 = (s[0].value / total) * 100;
    const p1 = p0 + (s[1].value / total) * 100;
    return [p0, p1];
  });

  totalUnits = computed(() => this.inventory().reduce((sum, i) => sum + i.currentStock, 0));
  healthScore = computed(() => {
    const total = this.inventory().length || 1;
    return Math.round((this.stockStatus()[0].value / total) * 100);
  });
  topStock = computed(() => [...this.inventory()].sort((a, b) => b.currentStock - a.currentStock).slice(0, 6));
  maxStock = computed(() => Math.max(1, ...this.topStock().map(i => i.currentStock)));

  orderSummary = computed(() => {
    const orders = this.allOrders();
    return {
      pending:   orders.filter(o => o.status === 'PENDING').length,
      approved:  orders.filter(o => o.status === 'APPROVED').length,
      completed: orders.filter(o => o.status === 'COMPLETED').length,
      shipped:   orders.filter(o => o.status === 'SHIPPED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
      totalValue: orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + (o.totalAmount || 0), 0),
    };
  });

  recentOrders = computed(() => [...this.allOrders()].sort((a, b) => b.id - a.id).slice(0, 5));

  currentMonthSales = computed(() => {
    const month = new Date().toISOString().slice(0, 7);
    return this.sales().filter(s => s.saleDate.startsWith(month));
  });

  monthlySalesTotal  = computed(() => this.currentMonthSales().reduce((sum, s) => sum + (s.totalAmount || 0), 0));
  todaySalesTotal    = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sales().filter(s => s.saleDate === today).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  });
  todaySalesCount    = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sales().filter(s => s.saleDate === today).length;
  });
  monthlyTransactions = computed(() => this.currentMonthSales().length);

  productSales = computed(() => {
    const totals = new Map<string, number>();
    for (const sale of this.currentMonthSales()) {
      for (const item of sale.items || []) {
        totals.set(item.productName, (totals.get(item.productName) || 0) + item.subtotal);
      }
    }
    const rows = Array.from(totals, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount).slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r.amount));
    return rows.map(r => ({ ...r, width: (r.amount / max) * 100 }));
  });

  categoryRevenue = computed(() => {
    const totals = new Map<string, number>();
    for (const sale of this.currentMonthSales()) {
      for (const item of sale.items || []) {
        const cat = (item as any).categoryName || 'Other';
        totals.set(cat, (totals.get(cat) || 0) + item.subtotal);
      }
    }
    const rows = Array.from(totals, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount).slice(0, 5);
    const max = Math.max(1, ...rows.map(r => r.amount));
    return rows.map((r, i) => ({ ...r, width: (r.amount / max) * 100, color: CAT_COLORS[i % CAT_COLORS.length] }));
  });

  topSuppliers = computed(() => {
    const map = new Map<string, { orders: number; amount: number }>();
    for (const o of this.allOrders()) {
      const name = o.supplierName || 'Unknown';
      const cur = map.get(name) || { orders: 0, amount: 0 };
      map.set(name, { orders: cur.orders + 1, amount: cur.amount + (o.totalAmount || 0) });
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map((s, i) => ({
        ...s,
        color: SUP_COLORS[i % SUP_COLORS.length],
        initials: s.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
      }));
  });

  monthlySalesData = computed(() => {
    const now = new Date();
    const points: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      const amount = this.sales().filter(s => s.saleDate && s.saleDate.startsWith(key))
        .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      points.push({ label, amount });
    }
    return points;
  });

  lineGraphPath = computed(() => {
    const pts = this.monthlySalesData();
    if (!pts.length) return '';
    const max = Math.max(1, ...pts.map(p => p.amount));
    const W = 450, H = 130, PAD_L = 40, PAD_T = 15, PAD_B = 20;
    const xs = pts.map((_, i) => PAD_L + (i / (pts.length - 1 || 1)) * (W - PAD_L));
    const ys = pts.map(p => PAD_T + (1 - p.amount / max) * (H - PAD_T - PAD_B));
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const area = d + ` L${xs[xs.length-1].toFixed(1)},${(H-PAD_B).toFixed(1)} L${xs[0].toFixed(1)},${(H-PAD_B).toFixed(1)} Z`;
    return JSON.stringify({ d, area, points: xs.map((x, i) => ({ x, y: ys[i], amount: pts[i].amount, label: pts[i].label })) });
  });

  parsedPath = computed(() => {
    try { return JSON.parse(this.lineGraphPath()); }
    catch { return { d: '', area: '', points: [] }; }
  });

  gridLines = computed(() => {
    const pts = this.monthlySalesData();
    if (!pts.length) return [];
    const max = Math.max(1, ...pts.map(p => p.amount));
    const H = 130, PAD_T = 15, PAD_B = 20;
    return [0.75, 0.5, 0.25].map(pct => PAD_T + (1 - pct) * (H - PAD_T - PAD_B));
  });

  gridLabel(y: number): string {
    const pts = this.monthlySalesData();
    if (!pts.length) return '';
    const max = Math.max(1, ...pts.map(p => p.amount));
    const H = 130, PAD_T = 15, PAD_B = 20;
    const pct = 1 - (y - PAD_T) / (H - PAD_T - PAD_B);
    return this.formatCompact(pct * max);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.dashSvc.getKpis().subscribe({ next: d => { this.kpi.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
    this.invSvc.getAll().subscribe(d => this.inventory.set(d));
    this.invSvc.getLowStock().subscribe(d => this.lowStock.set(d.slice(0, 6)));
    this.alertSvc.getUnread().subscribe(d => this.recentAlerts.set(d.slice(0, 5)));
    this.saleSvc.getAll().subscribe(d => this.sales.set(d));
    if (!this.isSupplier) {
      this.poSvc.getAll().subscribe(d => this.allOrders.set(d));
    }
    if (this.isSupplier) {
      this.poSvc.getAll().subscribe(pos => {
        this.supplierOrders.set(pos);
        this.pendingPOs.set(pos.filter(p => p.status === 'PENDING').length);
        this.approvedPOs.set(pos.filter(p => p.status === 'APPROVED').length);
        this.totalSupplied.set(pos.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.totalAmount, 0));
      });
      this.supSvc.getMyWarehouse().subscribe(ws => this.warehouseStock.set(ws));
    }
  }

  formatCompact(val?: number): string {
    return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(val || 0);
  }

  getMaxWh(): number {
    if (!this.warehouseStock().length) return 1;
    return Math.max(...this.warehouseStock().map(w => w.availableQuantity));
  }

  parsePath(json: string): { d: string; area: string; points: { x: number; y: number; amount: number; label: string }[] } {
    try { return JSON.parse(json); } catch { return { d: '', area: '', points: [] }; }
  }

  formatCurrency(val?: number): string {
    if (!val) return '0.00';
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(val);
  }
}
