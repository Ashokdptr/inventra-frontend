import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { NotificationService, AppNotification } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { Alert } from '../../core/models/models';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [SlicePipe, FormsModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css'
})
export class TopbarComponent implements OnInit, OnDestroy {
  protected auth: AuthService        = inject(AuthService);
  private alertSvc: AlertService     = inject(AlertService);
  private notifSvc: NotificationService = inject(NotificationService);
  protected themeSvc: ThemeService   = inject(ThemeService);
  private router                     = inject(Router);
  private userSvc: UserService       = inject(UserService);

  unreadAlertCount  = signal(0);
  alerts            = signal<Alert[]>([]);
  unreadNotifCount  = signal(0);
  notifications     = signal<AppNotification[]>([]);
  showNotifications = signal(false);
  showProfile       = signal(false);
  showPwdModal      = signal(false);
  clock             = signal(new Date().toLocaleTimeString());

  // Change password form
  currentPwd  = '';
  newPwd      = '';
  confirmPwd  = '';
  pwdLoading  = signal(false);
  pwdError    = signal('');
  pwdSuccess  = signal('');
  showCurrent = false;
  showNew     = false;

  // Edit profile form
  showEditProfile = signal(false);
  editName        = '';
  editPhone       = '';
  editAddress     = '';
  editDepartment  = '';
  profileLoading  = signal(false);
  profileError    = signal('');
  profileSuccess  = signal('');

  // Delete account
  showDeleteConfirm = signal(false);
  deleteConfirmText = '';
  deleteError       = signal('');
  deleteLoading     = signal(false);

  private pollTimer: any = null;

  totalUnread = computed(() => this.unreadAlertCount() + this.unreadNotifCount());
  greeting    = computed(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good day' : 'Good evening'; });
  firstName   = computed(() => ((this.auth.userName() as string) || '').split(' ')[0]);
  initials    = computed(() => { const n = this.auth.userName() as string; return n ? n.split(' ').map((x: string) => x[0]).join('').toUpperCase().slice(0, 2) : 'U'; });
  role        = computed(() => (this.auth.userRole() as string) ?? '');
  isSupplier  = computed(() => this.auth.userRole() === 'SUPPLIER');
  roleColor   = computed(() => {
    const r = this.auth.userRole() as string;
    if (r === 'ADMIN')    return '#00bcd4';
    if (r === 'MANAGER')  return '#7c3aed';
    if (r === 'STAFF')    return '#059669';
    if (r === 'SUPPLIER') return '#ea580c';
    return '#64748b';
  });
  lastLoginDisplay = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  });

  ngOnInit(): void {
    setInterval(() => this.clock.set(new Date().toLocaleTimeString()), 1000);
    this.loadCounts();
    this.pollTimer = setInterval(() => this.loadCounts(), 15000);
  }
  ngOnDestroy(): void { if (this.pollTimer) clearInterval(this.pollTimer); }

  private loadCounts(): void {
    this.notifSvc.countUnread().subscribe(r => this.unreadNotifCount.set(r.unreadCount));
    if (!this.isSupplier()) {
      this.alertSvc.getUnreadCount().subscribe((r: { unreadCount: number }) => this.unreadAlertCount.set(r.unreadCount));
    }
  }

  toggleTheme(): void { this.themeSvc.toggle(); }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
    this.showProfile.set(false);
    if (this.showNotifications()) {
      this.notifSvc.getUnread().subscribe(n => this.notifications.set(n.slice(0, 8)));
      if (!this.isSupplier()) this.alertSvc.getUnread().subscribe(a => this.alerts.set(a.slice(0, 5)));
    }
  }

  toggleProfile(): void { this.showProfile.update(v => !v); this.showNotifications.set(false); }

  openEditProfile(): void {
    const u = this.auth.currentUser();
    this.editName       = u?.name ?? '';
    this.editPhone      = u?.phone ?? '';
    this.editAddress    = (u as any)?.address ?? '';
    this.editDepartment = u?.department ?? '';
    this.profileError.set(''); this.profileSuccess.set('');
    this.showProfile.set(false);
    this.showEditProfile.set(true);
  }
  closeEditProfile(): void { this.showEditProfile.set(false); }

  submitProfile(): void {
    this.profileError.set(''); this.profileSuccess.set('');
    if (!this.editName.trim()) { this.profileError.set('Name is required.'); return; }
    this.profileLoading.set(true);
    this.userSvc.updateProfile({
      name: this.editName.trim(),
      phone: this.editPhone.trim(),
      address: this.editAddress.trim(),
      department: this.editDepartment.trim()
    }).subscribe({
      next: u => {
        this.profileLoading.set(false);
        this.profileSuccess.set('Profile updated successfully!');
        this.auth.updateCurrentUser({ name: u.name, phone: u.phone, address: (u as any).address, department: u.department });
        setTimeout(() => this.showEditProfile.set(false), 1200);
      },
      error: err => { this.profileLoading.set(false); this.profileError.set(err.error?.message ?? 'Failed to update profile.'); }
    });
  }

  openPwdModal(): void {
    this.currentPwd = ''; this.newPwd = ''; this.confirmPwd = '';
    this.pwdError.set(''); this.pwdSuccess.set('');
    this.showProfile.set(false);
    this.showPwdModal.set(true);
  }
  closePwdModal(): void { this.showPwdModal.set(false); }

  submitPwd(): void {
    this.pwdError.set(''); this.pwdSuccess.set('');
    if (!this.currentPwd) { this.pwdError.set('Current password is required.'); return; }
    if (!this.newPwd || this.newPwd.length < 6) { this.pwdError.set('New password must be at least 6 characters.'); return; }
    if (this.newPwd !== this.confirmPwd) { this.pwdError.set('New passwords do not match.'); return; }
    if (this.currentPwd === this.newPwd) { this.pwdError.set('New password must be different from current password.'); return; }
    this.pwdLoading.set(true);
    this.userSvc.changePassword(this.currentPwd, this.newPwd).subscribe({
      next: r => { this.pwdLoading.set(false); this.pwdSuccess.set(r.message || 'Password changed successfully!'); this.currentPwd = ''; this.newPwd = ''; this.confirmPwd = ''; },
      error: err => { this.pwdLoading.set(false); this.pwdError.set(err.error?.message ?? 'Failed to change password.'); }
    });
  }

  markNotifRead(id: number, event: Event): void {
    event.stopPropagation();
    this.notifSvc.markRead(id).subscribe(() => {
      this.notifications.update(list => list.filter(n => n.id !== id));
      this.unreadNotifCount.update(c => Math.max(0, c - 1));
    });
  }

  markAllRead(): void {
    this.notifSvc.markAllRead().subscribe(() => { this.unreadNotifCount.set(0); this.notifications.set([]); });
    if (!this.isSupplier()) {
      this.alertSvc.markAllRead().subscribe(() => { this.unreadAlertCount.set(0); this.alerts.set([]); });
    }
  }

  goToPurchaseOrders(): void { this.showNotifications.set(false); this.router.navigate(['/purchase-orders']); }
  logout(): void { this.auth.logout(); }

  confirmDeleteAccount(): void {
    this.deleteConfirmText = '';
    this.deleteError.set('');
    this.showProfile.set(false);
    this.showEditProfile.set(false);
    this.showDeleteConfirm.set(true);
  }

  submitDeleteAccount(): void {
    if (this.deleteConfirmText !== 'DELETE') return;
    this.deleteLoading.set(true);
    this.deleteError.set('');
    this.auth.deleteOwnAccount().subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.showDeleteConfirm.set(false);
        this.auth.logout();
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deleteError.set(err.error?.message ?? 'Failed to delete account. Please try again.');
      }
    });
  }
}
