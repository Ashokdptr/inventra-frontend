import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';

interface AccentColor { name: string; value: string; dark: string; }

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  themeSvc = inject(ThemeService);
  auth     = inject(AuthService);
  private userSvc = inject(UserService);

  saved = signal(false);

  isSupplier = () => this.auth.userRole() === 'SUPPLIER';

  // ── Profile editing ──────────────────────────────────────────────
  editName       = this.auth.currentUser()?.name ?? '';
  editPhone      = this.auth.currentUser()?.phone ?? '';
  editAddress    = (this.auth.currentUser() as any)?.address ?? '';
  editDepartment = this.auth.currentUser()?.department ?? '';
  profileLoading = signal(false);
  profileError   = signal('');
  profileSuccess = signal('');

  initials = () => {
    const n = (this.auth.userName() as string) || '';
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  saveProfile(): void {
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
        setTimeout(() => this.profileSuccess.set(''), 2500);
      },
      error: err => { this.profileLoading.set(false); this.profileError.set(err.error?.message ?? 'Failed to update profile.'); }
    });
  }

  accentColors: AccentColor[] = [
    { name: 'Teal',    value: '#00bcd4', dark: '#00acc1' },
    { name: 'Indigo',  value: '#6366f1', dark: '#818cf8' },
    { name: 'Emerald', value: '#10b981', dark: '#34d399' },
    { name: 'Rose',    value: '#f43f5e', dark: '#fb7185' },
    { name: 'Amber',   value: '#f59e0b', dark: '#fbbf24' },
    { name: 'Purple',  value: '#8b5cf6', dark: '#a78bfa' },
    { name: 'Blue',    value: '#3b82f6', dark: '#60a5fa' },
    { name: 'Orange',  value: '#f97316', dark: '#fb923c' },
  ];

  selectedAccent = signal(this.themeSvc.accentColor?.() ?? '#00bcd4');
  fontSize       = signal(this.themeSvc.fontSize?.() ?? 14);
  compactMode    = signal(this.themeSvc.compactMode?.() ?? false);
  animations     = signal(this.themeSvc.animationsEnabled?.() ?? true);
  sidebarStyle   = signal(this.themeSvc.sidebarStyle?.() ?? 'dark');

  setAccent(color: AccentColor): void {
    this.selectedAccent.set(color.value);
    this.themeSvc.setAccent?.(color.value);
  }

  setTheme(dark: boolean): void {
    this.themeSvc.setTheme(dark ? 'dark' : 'light');
  }

  saveSettings(): void {
    this.themeSvc.setFontSize?.(this.fontSize());
    this.themeSvc.setCompactMode?.(this.compactMode());
    this.themeSvc.setAnimations?.(this.animations());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }

  resetDefaults(): void {
    this.selectedAccent.set('#00bcd4');
    this.fontSize.set(14);
    this.compactMode.set(false);
    this.animations.set(true);
    this.sidebarStyle.set('dark');
    this.themeSvc.setAccent?.('#00bcd4');
    this.themeSvc.setTheme('light');
  }

  getAccentName(hex: string): string {
    return this.accentColors.find(c => c.value === hex)?.name ?? 'Custom';
  }
}
