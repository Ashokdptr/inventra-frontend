import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark        = signal<boolean>(false);
  accentColor   = signal<string>('#00bcd4');
  fontSize      = signal<number>(14);
  compactMode   = signal<boolean>(false);
  animationsEnabled = signal<boolean>(true);
  sidebarStyle  = signal<string>('dark');

  constructor() {
    const savedTheme  = localStorage.getItem('inventra-theme');
    const savedAccent = localStorage.getItem('inventra-accent');
    const savedFont   = localStorage.getItem('inventra-fontsize');
    const savedCompact = localStorage.getItem('inventra-compact');

    if (savedTheme === 'dark') {
      this.isDark.set(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    if (savedAccent) {
      this.accentColor.set(savedAccent);
      this.applyAccent(savedAccent);
    }
    if (savedFont) {
      this.fontSize.set(+savedFont);
      document.documentElement.style.fontSize = savedFont + 'px';
    }
    if (savedCompact === 'true') {
      this.compactMode.set(true);
      document.documentElement.setAttribute('data-compact', 'true');
    }
  }

  toggle(): void { this.setTheme(this.isDark() ? 'light' : 'dark'); }

  setTheme(mode: 'dark' | 'light'): void {
    const dark = mode === 'dark';
    this.isDark.set(dark);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('inventra-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('inventra-theme', 'light');
    }
  }

  setAccent(color: string): void {
    this.accentColor.set(color);
    this.applyAccent(color);
    localStorage.setItem('inventra-accent', color);
  }

  private applyAccent(color: string): void {
    document.documentElement.style.setProperty('--accent', color);
    // Generate slightly darker version for hover states
    document.documentElement.style.setProperty('--accent-dark', this.darken(color, 15));
    document.documentElement.style.setProperty('--accent-light', color + '22');
  }

  setFontSize(size: number): void {
    this.fontSize.set(size);
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('inventra-fontsize', size.toString());
  }

  setCompactMode(compact: boolean): void {
    this.compactMode.set(compact);
    if (compact) document.documentElement.setAttribute('data-compact', 'true');
    else document.documentElement.removeAttribute('data-compact');
    localStorage.setItem('inventra-compact', compact.toString());
  }

  setAnimations(enabled: boolean): void {
    this.animationsEnabled.set(enabled);
    if (!enabled) document.documentElement.style.setProperty('--transition-speed', '0s');
    else document.documentElement.style.removeProperty('--transition-speed');
  }

  private darken(hex: string, pct: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - Math.round(2.55 * pct));
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(2.55 * pct));
    const b = Math.max(0, (n & 0xff) - Math.round(2.55 * pct));
    return `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
  }
}
