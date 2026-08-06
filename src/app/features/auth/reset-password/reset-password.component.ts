import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private auth    = inject(AuthService);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);

  token       = '';
  newPwd      = '';
  confirmPwd  = '';
  showNew     = false;
  showConfirm = false;
  loading     = signal(false);
  error       = signal('');
  success     = signal('');
  tokenMissing = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.tokenMissing.set(true);
  }

  submit(): void {
    this.error.set('');
    if (!this.newPwd || this.newPwd.length < 6) { this.error.set('Password must be at least 6 characters.'); return; }
    if (this.newPwd !== this.confirmPwd) { this.error.set('Passwords do not match.'); return; }
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.newPwd).subscribe({
      next: res => {
        this.loading.set(false);
        this.success.set(res.message ?? 'Password reset successfully! Redirecting to login…');
        setTimeout(() => this.router.navigate(['/auth/login']), 2500);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Reset link is invalid or expired. Please request a new one.');
      }
    });
  }
}
