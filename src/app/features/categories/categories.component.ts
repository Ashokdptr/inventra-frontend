import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  private catSvc = inject(CategoryService);

  // Tree data (root categories with subcategories[])
  categories  = signal<Category[]>([]);
  loading     = signal(true);
  showModal   = signal(false);
  editId      = signal<number | null>(null);
  error       = signal('');
  success     = signal('');

  // Expanded state for tree rows
  expanded    = signal<Set<number>>(new Set());

  form = { name: '', description: '', parentId: undefined as number | undefined };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.catSvc.getAll().subscribe({
      next: d => { this.categories.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // ── Stats ──────────────────────────────────────────────────
  totalMain = computed(() => this.categories().length);
  totalSub  = computed(() =>
    this.categories().reduce((s, c) => s + (c.subcategories?.length ?? 0), 0)
  );

  // ── Tree toggle ────────────────────────────────────────────
  toggle(id: number) {
    const s = new Set(this.expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expanded.set(s);
  }
  isExpanded(id: number) { return this.expanded().has(id); }

  // ── Modal helpers ──────────────────────────────────────────
  openCreateMain() {
    this.form = { name: '', description: '', parentId: undefined };
    this.editId.set(null); this.error.set(''); this.showModal.set(true);
  }

  openCreateSub(parentId: number) {
    this.form = { name: '', description: '', parentId };
    this.editId.set(null); this.error.set(''); this.showModal.set(true);
  }

  openEdit(cat: Category, parentId?: number) {
    this.form = {
      name: cat.name,
      description: cat.description ?? '',
      parentId: parentId
    };
    this.editId.set(cat.id); this.error.set(''); this.showModal.set(true);
  }

  close() { this.showModal.set(false); this.error.set(''); }

  save() {
    if (!this.form.name.trim()) { this.error.set('Name is required.'); return; }
    const req = {
      name: this.form.name.trim(),
      description: this.form.description || undefined,
      parentId: this.form.parentId ?? undefined
    };
    const id = this.editId();
    const obs = id ? this.catSvc.update(id, req) : this.catSvc.create(req);
    obs.subscribe({
      next: () => { this.close(); this.load(); this.success.set(id ? 'Category updated!' : 'Category created!'); setTimeout(() => this.success.set(''), 3000); },
      error: e  => this.error.set(e.error?.message ?? 'Failed to save category.')
    });
  }

  delete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    this.catSvc.delete(id).subscribe({
      next: () => { this.load(); this.success.set('Category deleted.'); setTimeout(() => this.success.set(''), 3000); },
      error: e  => alert(e.error?.message ?? 'Cannot delete this category.')
    });
  }

  isAddingSub = computed(() => this.form.parentId !== undefined);
  parentNameFor(parentId: number) {
    return this.categories().find(c => c.id === parentId)?.name ?? '';
  }
}
