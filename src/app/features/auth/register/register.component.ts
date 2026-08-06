import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  name            = '';
  email           = '';
  password        = '';
  confirmPassword = '';
  phone           = '';
  department      = '';
  role: 'STAFF' | 'SUPPLIER' = 'STAFF';
  showPwd         = false;
  showConfirm     = false;
  loading         = signal(false);
  error           = signal('');
  success         = signal('');

  // Password strength
  get pwdStrength(): number {
    const p = this.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  }
  get pwdLabel(): string {
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][this.pwdStrength] ?? '';
  }
  get pwdClass(): string {
    return ['', 'strength-weak', 'strength-fair', 'strength-good', 'strength-strong'][this.pwdStrength] ?? '';
  }

  register(): void {
    this.error.set('');
    this.success.set('');

    // Validations
    if (!this.name.trim()) { this.error.set('Full name is required.'); return; }
    if (this.name.trim().length < 2) { this.error.set('Name must be at least 2 characters.'); return; }
    if (!this.email.trim()) { this.error.set('Email address is required.'); return; }
    if (!this.isValidEmail(this.email)) { this.error.set('Please enter a valid email address.'); return; }
    if (!this.password) { this.error.set('Password is required.'); return; }
    if (this.password.length < 8) { this.error.set('Password must be at least 8 characters.'); return; }
    if (this.password !== this.confirmPassword) { this.error.set('Passwords do not match.'); return; }
    if (this.phone && !this.isValidPhone(this.phone)) { this.error.set('Please enter a valid phone number.'); return; }
    if (!['STAFF', 'SUPPLIER'].includes(this.role)) { this.error.set('Invalid role selected.'); return; }

    this.loading.set(true);
    this.auth.register({
      name: this.name.trim(), email: this.email.trim(), password: this.password,
      phone: this.phone || undefined, department: this.department || undefined, role: this.role
    }).subscribe({
      next: res => {
        this.loading.set(false);
        this.success.set(res.message || 'Registration submitted! An admin will review your request.');
        setTimeout(() => this.router.navigate(['/auth/login']), 2500);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Registration failed. Please try again.');
      }
    });
  }

  googleLogin(): void {
    window.location.href = `${this.auth.getApiBase()}/oauth2/authorization/google`;
  }

  private isValidEmail(e: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e.trim());
  }
  private isValidPhone(p: string): boolean {
    return /^[0-9+\-\s()]{6,20}$/.test(p.trim());
  }
}
