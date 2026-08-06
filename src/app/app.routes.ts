import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: 'landing',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  { path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  { path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  { path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'products', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER'] },
        loadComponent: () => import('./features/products/products.component').then(m => m.ProductsComponent) },
      { path: 'inventory', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER','STAFF'] },
        loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'sales',
        loadComponent: () => import('./features/sales/sales.component').then(m => m.SalesComponent) },
      { path: 'alerts',
        loadComponent: () => import('./features/alerts/alerts.component').then(m => m.AlertsComponent) },
      { path: 'categories', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER'] },
        loadComponent: () => import('./features/categories/categories.component').then(m => m.CategoriesComponent) },
      { path: 'suppliers', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER','SUPPLIER'] },
        loadComponent: () => import('./features/suppliers/suppliers.component').then(m => m.SuppliersComponent) },
      { path: 'purchase-orders', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER','SUPPLIER'] },
        loadComponent: () => import('./features/purchase-orders/purchase-orders.component').then(m => m.PurchaseOrdersComponent) },
      { path: 'invoices', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER','STAFF'] },
        loadComponent: () => import('./features/invoices/invoices.component').then(m => m.InvoicesComponent) },
      { path: 'reports', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER'] },
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'ai-insights', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER'] },
        loadComponent: () => import('./features/ai-insights/ai-insights.component').then(m => m.AiInsightsComponent) },
      { path: 'user-management', canActivate: [roleGuard], data: { roles: ['ADMIN','MANAGER'] },
        loadComponent: () => import('./features/user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'transaction-history', canActivate: [roleGuard], data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/transaction-history/transaction-history.component').then(m => m.TransactionHistoryComponent) },
      { path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) }
    ]
  },
  { path: '**', redirectTo: 'landing' }
];
