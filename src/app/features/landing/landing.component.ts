import { Component, inject, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  theme = inject(ThemeService);
  private el = inject(ElementRef);
  private observer: IntersectionObserver | null = null;

  // Counter animation state
  counters = { inventory: 0, uptime: 0, roles: 0, modules: 0 };
  private countersStarted = false;

  ngAfterViewInit(): void {
    // Intersection Observer for scroll-triggered animations
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Start counters when metrics strip is visible
          if (entry.target.classList.contains('metrics-strip') && !this.countersStarted) {
            this.countersStarted = true;
            this.animateCounters();
          }
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // Observe all animatable elements
    const targets = this.el.nativeElement.querySelectorAll(
      '.bento-card, .role-card, .tl-step, .float-chip, .hero-trust, .metrics-strip, .sec-h2, .sec-eyebrow, .sec-sub'
    );
    targets.forEach((el: Element) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private animateCounters(): void {
    // Animate the mockup KPI values
    const items = this.el.nativeElement.querySelectorAll('.mk-val');
    items.forEach((el: HTMLElement, i: number) => {
      const targets = ['₹40.2L', '₹1.8L', '23', '12'];
      if (targets[i]) {
        setTimeout(() => {
          el.style.animation = 'countUp 0.6s cubic-bezier(.22,1,.36,1) both';
        }, i * 100);
      }
    });
  }
}
