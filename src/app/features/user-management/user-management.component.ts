import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/models';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
  private svc = inject(UserService);
  auth        = inject(AuthService);

  users      = signal<User[]>([]);
  loading    = signal(true);
  showModal  = signal(false);
  saving     = signal(false);
  error      = signal('');
  roleEditId = signal<number | null>(null);
  editingRole = '';
  showPwd     = false;

  pendingCount = computed(() => this.users().filter(u => u.approvalStatus === 'PENDING').length);
  activeCount  = computed(() => this.users().filter(u => u.isActive).length);

  form: { name: string; email: string; password: string; phone: string; department: string; roleId: number } = {
    name: '', email: '', password: '', phone: '', department: '', roleId: 3
  };

  roleOptions(): { id: number; label: string }[] {
    if (this.auth.isAdmin()) {
      return [{ id: 2, label: 'MANAGER' }, { id: 3, label: 'STAFF' }, { id: 4, label: 'SUPPLIER' }];
    }
    return [{ id: 3, label: 'STAFF' }];
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.users.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate(): void {
    const first = this.roleOptions()[0];
    this.form = { name: '', email: '', password: '', phone: '', department: '', roleId: first.id };
    this.error.set('');
    this.showPwd = false;
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.error.set(''); }

  toggle(u: User): void  { this.svc.toggleActive(u.id).subscribe(() => this.load()); }
  approve(u: User): void { this.svc.approve(u.id).subscribe(() => this.load()); }
  reject(u: User): void  { this.svc.reject(u.id).subscribe(() => this.load()); }

  createUser(): void {
    this.error.set('');
    if (!this.form.name.trim()) { this.error.set('Full name is required.'); return; }
    if (!this.form.email.trim()) { this.error.set('Email is required.'); return; }
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(this.form.email)) {
      this.error.set('Please enter a valid email address.'); return;
    }
    if (!this.form.password || this.form.password.length < 6) {
      this.error.set('Password must be at least 6 characters.'); return;
    }
    if (this.form.phone && !/^[0-9+\-\s()]{6,20}$/.test(this.form.phone)) {
      this.error.set('Please enter a valid phone number.'); return;
    }
    this.saving.set(true);
    const payload: Record<string, unknown> = {
      name: this.form.name, email: this.form.email, password: this.form.password,
      phone: this.form.phone, department: this.form.department, roleId: this.form.roleId
    };
    this.svc.create(payload).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(err.error?.message ?? 'Unable to create user.');
      }
    });
  }

  startRoleEdit(u: User): void { this.roleEditId.set(u.id); this.editingRole = u.role; }
  cancelRoleEdit(): void       { this.roleEditId.set(null); }

  changeRole(userId: number, newRole: string): void {
    if (!newRole) return;
    this.svc.updateRole(userId, newRole).subscribe({
      next: () => { this.roleEditId.set(null); this.load(); },
      error: (err: { error?: { message?: string } }) => alert(err.error?.message ?? 'Failed to update role.')
    });
  }

  getRoleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'badge-admin', MANAGER: 'badge-manager',
      STAFF: 'badge-staff', SUPPLIER: 'badge-supplier'
    };
    return map[role] ?? 'badge-staff';
  }
}
