import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  end?: boolean;
}
interface NavGroup { heading: string; items: NavItem[]; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  protected auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  collapsed = signal(false);

  /** Marks raw SVG path/shape markup as safe so Angular's [innerHTML]
   *  sanitizer doesn't strip <path>/<circle>/<rect>/<polyline> etc. */
  trustIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private groups: NavGroup[] = [
    {
      heading: 'OVERVIEW',
      items: [
        { label:'Dashboard', route:'/dashboard', end:true,
          icon:`<rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>` }
      ]
    },
    {
      heading: 'CATALOGUE',
      items: [
        { label:'Products', route:'/products', roles:['ADMIN','MANAGER'],
          icon:`<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>` },
        { label:'Inventory', route:'/inventory', roles:['ADMIN','MANAGER','STAFF'],
          icon:`<path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>
                <line x1="10" y1="12" x2="14" y2="12"/>` },
        { label:'Categories', route:'/categories', roles:['ADMIN','MANAGER'],
          icon:`<rect x="2" y="2" width="9" height="9" rx="2"/>
                <rect x="13" y="2" width="9" height="9" rx="2"/>
                <rect x="2" y="13" width="9" height="9" rx="2"/>
                <circle cx="17.5" cy="17.5" r="3.5"/>
                <line x1="20.5" y1="20.5" x2="22" y2="22"/>` }
      ]
    },
    {
      heading: 'TRANSACTIONS',
      items: [
        { label:'Sales', route:'/sales', roles:['ADMIN','MANAGER','STAFF'],
          icon:`<circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>` },
        { label:'Purchase Orders', route:'/purchase-orders', roles:['ADMIN','MANAGER','SUPPLIER'],
          icon:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>` },
        { label:'Invoices', route:'/invoices', roles:['ADMIN','MANAGER','STAFF'],
          icon:`<rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
                <line x1="7" y1="8" x2="13" y2="8"/>
                <line x1="7" y1="12" x2="10" y2="12"/>` }
      ]
    },
    {
      heading: 'SUPPLY CHAIN',
      items: [
        { label:'Suppliers', route:'/suppliers', roles:['ADMIN','MANAGER'],
          icon:`<rect x="1" y="3" width="15" height="13" rx="1"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>` },
        { label:'My Warehouse', route:'/suppliers', roles:['SUPPLIER'],
          icon:`<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>` }
      ]
    },
    {
      heading: 'ANALYTICS',
      items: [
        { label:'Reports', route:'/reports', roles:['ADMIN','MANAGER'],
          icon:`<rect x="4" y="14" width="4" height="6" rx="1"/>
                <rect x="10" y="8" width="4" height="12" rx="1"/>
                <rect x="16" y="4" width="4" height="16" rx="1"/>` },
        { label:'AI Insights', route:'/ai-insights', roles:['ADMIN','MANAGER'],
          icon:`<path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>` },
        { label:'Alerts', route:'/alerts', roles:['ADMIN','MANAGER'],
          icon:`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>` }
      ]
    },
    {
      heading: 'ADMINISTRATION',
      items: [
        { label:'User Management', route:'/user-management', roles:['ADMIN','MANAGER'],
          icon:`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
        { label:'Transaction History', route:'/transaction-history', roles:['ADMIN'],
          icon:`<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>` }
      ]
    }
  ];

  visibleGroups = computed(() => {
    const role = this.auth.userRole() as string | null;
    return this.groups
      .map(g => ({ ...g, items: g.items.filter(i => !i.roles || (role && i.roles.includes(role))) }))
      .filter(g => g.items.length > 0);
  });

  initials = computed(() => {
    const n = (this.auth.userName() as string) || '';
    return n.split(' ').map((w:string) => w[0]).join('').toUpperCase().slice(0,2) || 'U';
  });

  roleColor = computed(() => {
    const r = this.auth.userRole() as string;
    if (r === 'ADMIN')    return '#00bcd4';
    if (r === 'MANAGER')  return '#7c3aed';
    if (r === 'STAFF')    return '#059669';
    if (r === 'SUPPLIER') return '#ea580c';
    return '#64748b';
  });

  toggleCollapsed(): void { this.collapsed.update(v => !v); }
  logout(): void { this.auth.logout(); }
}
