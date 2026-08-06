import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';

interface Particle { id: number; x: number; y: number; size: number; delay: number; dur: number; }
interface Feature  { title: string; desc: string; icon: string; color: string; }
interface Stat     { val: string; label: string; }

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private sanitizer = inject(DomSanitizer);

  trustIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ── Particle data (generated once) ──────────────────────────────
  particles: Particle[] = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x:    Math.random() * 100,
    y:    100 + Math.random() * 20,
    size: 2 + Math.random() * 5,
    delay: Math.random() * 12,
    dur:   8 + Math.random() * 10,
  }));

  features: Feature[] = [
    { title: 'Real-time Stock Tracking',
      desc: 'Monitor inventory levels across all locations instantly',
      icon: `<path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/>`,
      color: 'rgba(0,188,212,.7)' },
    { title: 'AI-Powered Demand Forecasting',
      desc: 'Smart predictions and reorder suggestions powered by ML',
      icon: `<path d="M12 2a10 10 0 0 1 10 10"/><circle cx="12" cy="12" r="3"/><path d="M12 8v1m0 6v1m4-4h1M7 12H6"/>`,
      color: 'rgba(99,102,241,.7)' },
    { title: 'Full Purchase Order Workflow',
      desc: 'End-to-end PO management from request to delivery',
      icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>`,
      color: 'rgba(16,185,129,.7)' },
    { title: 'Role-Based Access Control',
      desc: 'Admin, Manager, Staff & Supplier roles with granular permissions',
      icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
      color: 'rgba(245,158,11,.7)' },
  ];

  stats: Stat[] = [
    { val: '99.9%',  label: 'Uptime' },
    { val: '< 100ms', label: 'API Response' },
    { val: '4 Roles', label: 'Access Levels' },
    { val: 'AI Ready', label: 'Insights' },
  ];

  // ── Form state ───────────────────────────────────────────────────
  email    = '';
  password = '';
  showPwd  = false;
  loading  = signal(false);
  error    = signal('');

  loginMode  = signal<'password' | 'otp'>('password');

  otpEmail    = '';
  otpCode     = '';
  otpSent     = signal(false);
  otpLoading  = signal(false);
  otpSuccess  = signal('');
  otpError    = signal('');
  otpVerifying = signal(false);

  forgotMode = signal(false);
  fpEmail    = '';
  fpLoading  = signal(false);
  fpSuccess  = signal('');
  fpError    = signal('');

  ngOnInit():    void { }
  ngOnDestroy(): void { }

  // ── Password login ───────────────────────────────────────────────
  login(): void {
    this.error.set('');
    if (!this.email.trim())             { this.error.set('Email address is required.');              return; }
    if (!this.isValidEmail(this.email)) { this.error.set('Please enter a valid email address.');     return; }
    if (!this.password)                 { this.error.set('Password is required.');                   return; }
    if (this.password.length < 6)       { this.error.set('Password must be at least 6 characters.'); return; }
    this.loading.set(true);
    this.auth.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Invalid email or password. Please try again.');
      }
    });
  }

  // ── OTP login ────────────────────────────────────────────────────
  switchMode(mode: 'password' | 'otp'): void {
    this.loginMode.set(mode);
    this.error.set(''); this.otpError.set(''); this.otpSuccess.set('');
    this.otpSent.set(false); this.otpCode = '';
  }

  sendOtp(): void {
    this.otpError.set(''); this.otpSuccess.set('');
    if (!this.otpEmail.trim())             { this.otpError.set('Email address is required.');          return; }
    if (!this.isValidEmail(this.otpEmail)) { this.otpError.set('Please enter a valid email address.'); return; }
    this.otpLoading.set(true);
    this.auth.requestOtp(this.otpEmail.trim()).subscribe({
      next: res => { this.otpLoading.set(false); this.otpSent.set(true); this.otpSuccess.set(res.message ?? 'OTP sent! Check your inbox.'); },
      error: err => { this.otpLoading.set(false); this.otpError.set(err.error?.message ?? 'Could not send OTP. Please try again.'); }
    });
  }

  verifyOtp(): void {
    this.otpError.set('');
    if (!this.otpCode.trim())      { this.otpError.set('Please enter the OTP code.'); return; }
    if (this.otpCode.length !== 6) { this.otpError.set('OTP must be 6 digits.');     return; }
    this.otpVerifying.set(true);
    this.auth.verifyOtp(this.otpEmail.trim(), this.otpCode.trim()).subscribe({
      next: (res: any) => { this.auth.persist(res); this.router.navigate(['/dashboard']); },
      error: (err: any) => { this.otpVerifying.set(false); this.otpError.set(err.error?.message ?? 'Invalid or expired OTP. Try again.'); }
    });
  }

  resendOtp(): void {
    this.otpSent.set(false); this.otpCode = '';
    this.otpSuccess.set(''); this.otpError.set('');
  }

  // ── Forgot password ──────────────────────────────────────────────
  openForgot():  void { this.fpEmail = this.email || this.otpEmail; this.fpSuccess.set(''); this.fpError.set(''); this.forgotMode.set(true); }
  closeForgot(): void { this.forgotMode.set(false); }

  sendReset(): void {
    this.fpError.set(''); this.fpSuccess.set('');
    if (!this.fpEmail.trim())             { this.fpError.set('Please enter your email address.');     return; }
    if (!this.isValidEmail(this.fpEmail)) { this.fpError.set('Please enter a valid email address.'); return; }
    this.fpLoading.set(true);
    this.auth.forgotPassword(this.fpEmail.trim()).subscribe({
      next: res => { this.fpLoading.set(false); this.fpSuccess.set(res.message ?? `Reset link sent to ${this.fpEmail}.`); },
      error: err => { this.fpLoading.set(false); this.fpError.set(err.error?.message ?? 'Could not send reset email. Please try again.'); }
    });
  }

  private isValidEmail(e: string): boolean {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e.trim());
  }
}
