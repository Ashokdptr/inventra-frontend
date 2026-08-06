// ─── Auth ───────────────────────────────────────────────────────────────────
export interface LoginRequest   { email: string; password: string; }
export interface AuthResponse   { accessToken: string; id: number; name: string; email: string; role: string; phone?: string; address?: string; department?: string; assignedCategories?: string; lastLoginAt?: string; }
export interface RegisterResponse { message: string; }

// ─── User ───────────────────────────────────────────────────────────────────
export interface User {
  id: number; name: string; email: string; phone?: string; address?: string;
  role: string; department?: string; assignedCategories?: string;
  approvalStatus?: string; approvedBy?: string;
  isActive: boolean; lastLoginAt?: string; createdAt: string;
}

// ─── Category ───────────────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description?: string;
  parentId?: number;
  parentName?: string;
  subcategories?: { id: number; name: string; description?: string }[];
  createdAt?: string;
}

// ─── Product ────────────────────────────────────────────────────────────────
export interface Product {
  id: number; name: string; sku: string; barcode?: string;
  description?: string; imageUrl?: string; expiryDate?: string;
  categoryId?: number; categoryName?: string; parentCategoryName?: string;
  supplierId?: number; supplierName?: string;
  price: number; costPrice: number;
  reorderLevel: number; currentStock: number; stockStatus: string;
  createdAt?: string;
}

export interface ProductRequest {
  name: string; sku?: string; barcode?: string; description?: string;
  imageUrl?: string; expiryDate?: string; categoryId?: number; supplierId?: number;
  price: number; costPrice: number; reorderLevel?: number; currentStock?: number;
}

// ─── Inventory ──────────────────────────────────────────────────────────────
export interface InventoryItem {
  inventoryId: number; productId: number; productName: string; sku: string;
  currentStock: number; reorderLevel: number; stockStatus: string; lastUpdated: string;
}

export interface StockMovement {
  id: number; productId: number; productName: string;
  movementType: string; quantity: number;
  referenceType: string; referenceId?: number; notes?: string;
  createdBy: string; createdAt: string;
}

export interface StockAdjustRequest {
  productId: number; quantity: number;
  movementType: 'IN' | 'OUT';
  referenceType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT';
  notes?: string;
}

// ─── Supplier ───────────────────────────────────────────────────────────────
export interface Supplier {
  id: number; name: string; email: string; phone: string;
  address: string; contactName: string;
}

export interface SupplierWarehouseStock {
  id: number; supplierId: number; supplierName: string;
  productId: number; productName: string; sku: string; supplierSku?: string;
  availableQuantity: number; costPrice?: number;
}

// ─── Purchase Order ──────────────────────────────────────────────────────────
export interface PurchaseOrderItem {
  id: number; productId: number; productName: string;
  quantity: number; unitPrice: number; subtotal: number;
}

export interface PurchaseOrder {
  id: number; supplierId: number; supplierName: string;
  orderDate: string; expectedDate?: string;
  status: string; paymentStatus?: string; stockReceived?: boolean;
  totalAmount: number; notes?: string;
  createdBy: string; items: PurchaseOrderItem[];
}

// ─── Sale ────────────────────────────────────────────────────────────────────
export interface SaleItem {
  id: number; productId: number; productName: string;
  categoryName?: string;
  quantity: number; unitPrice: number; subtotal: number;
}

export interface Sale {
  id: number; customerName?: string; customerEmail?: string;
  customerPhone?: string; paymentMethod?: string; paymentStatus: string;
  totalAmount: number; saleDate: string; createdAt: string; createdBy?: string;
  items: SaleItem[];
}

// ─── Alert ───────────────────────────────────────────────────────────────────
export interface Alert {
  id: number; alertType: string; productName?: string;
  message: string; status: string; isRead: boolean; createdAt: string;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────
export interface Prediction {
  id: number; productId: number; productName: string;
  predictedDemand: number; confidenceScore: number;
  predictionDate: string; period: string;
}

export interface ReorderSuggestion {
  id: number; productId: number; productName: string;
  currentStock: number; reorderLevel: number;
  suggestedQuantity: number; reason: string;
  isActioned: boolean;
  supplierId?: number; supplierName?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardKpi {
  totalProducts: number; lowStockCount: number; outOfStockCount: number;
  pendingPurchaseOrders: number; totalSalesToday: number;
  totalInventoryValue: number; unreadAlerts: number;
  newProductsThisMonth?: number; revenueGrowth?: number; ordersGrowth?: number;
}
