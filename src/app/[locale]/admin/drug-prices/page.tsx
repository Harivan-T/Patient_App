'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SkeletonCards } from '@/components/ui/Skeleton';

interface CatalogEntry {
  id:          number;
  name:        string;
  form:        string | null;
  strength:    string | null;
  price:       string | null;
  description: string | null;
  available:   boolean;
}

const EMPTY_FORM = { name: '', form: '', strength: '', price: '', description: '' };

function formatIQD(price: string | null): string {
  if (!price) return '—';
  const n = Number(price);
  return isNaN(n) ? '—' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'IQD', minimumFractionDigits: 0,
  }).format(n);
}

export default function DrugPricesPage({ params }: { params: { locale: string } }) {
  const { locale } = params;

  const [entries, setEntries]   = useState<CatalogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [editId, setEditId]     = useState<number | 'new' | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/drug-prices');
      if (res.ok) setEntries(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId('new');
    setError('');
  }

  function openEdit(e: CatalogEntry) {
    setForm({
      name:        e.name,
      form:        e.form ?? '',
      strength:    e.strength ?? '',
      price:       e.price ?? '',
      description: e.description ?? '',
    });
    setEditId(e.id);
    setError('');
  }

  function cancel() { setEditId(null); setError(''); }

  async function save() {
    if (!form.name.trim()) { setError('Drug name is required'); return; }
    const priceNum = Number(form.price);
    if (!form.price || isNaN(priceNum) || priceNum <= 0) { setError('Enter a valid price in IQD'); return; }

    setSaving(true);
    setError('');
    try {
      const body = {
        name:        form.name.trim(),
        form:        form.form.trim() || null,
        strength:    form.strength.trim() || null,
        price:       priceNum,
        description: form.description.trim() || null,
        available:   true,
      };

      let res: Response;
      if (editId === 'new') {
        res = await fetch('/api/admin/drug-prices', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/admin/drug-prices/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) { setError('Save failed — check that the name is unique'); return; }
      setEditId(null);
      await load();
    } finally { setSaving(false); }
  }

  async function toggleAvailable(entry: CatalogEntry) {
    await fetch(`/api/admin/drug-prices/${entry.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !entry.available }),
    });
    await load();
  }

  async function deleteEntry(entry: CatalogEntry) {
    if (!confirm(`Delete "${entry.name}" from the price catalog?`)) return;
    await fetch(`/api/admin/drug-prices/${entry.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <AppShell locale={locale}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-heading)]">Drug Price Catalog</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Prices set here appear in the patient medication cart. IQD only.
            </p>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            + Add drug price
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by drug name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
        />

        {/* Add / Edit form */}
        {editId !== null && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <h2 className="font-semibold text-[var(--color-heading)]">
              {editId === 'new' ? 'Add new drug price' : 'Edit drug price'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Drug name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Digitoxin"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-background text-sm"
                  disabled={editId !== 'new'}
                />
                {editId !== 'new' && (
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Name cannot be changed (it is the lookup key).</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Form</label>
                <input
                  value={form.form}
                  onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}
                  placeholder="Tablet / Injection / etc."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Strength</label>
                <input
                  value={form.strength}
                  onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))}
                  placeholder="e.g. 100 mcg"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Price (IQD) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional note"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-background text-sm"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={cancel} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <SkeletonCards count={3} cardClassName="h-10" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-8 text-center">
            {search ? 'No results.' : 'No drug prices set yet. Add the first one above.'}
          </p>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)] text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Drug name</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">Form / Strength</th>
                  <th className="text-right px-4 py-2">Price (IQD)</th>
                  <th className="text-center px-4 py-2">Active</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-[var(--color-border)] last:border-0 ${!entry.available ? 'opacity-40' : ''} ${i % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-white/[0.03]'}`}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-heading)]">{entry.name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden sm:table-cell">
                      {[entry.form, entry.strength].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatIQD(entry.price)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAvailable(entry)}
                        className={`w-8 h-5 rounded-full transition-colors ${entry.available ? 'bg-emerald-500' : 'bg-[var(--color-border)]'}`}
                        title={entry.available ? 'Disable' : 'Enable'}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white shadow mx-auto transition-transform ${entry.available ? 'translate-x-1.5' : '-translate-x-1.5'}`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(entry)}
                          className="px-2 py-1 rounded-lg text-xs border border-[var(--color-border)] hover:bg-[var(--color-border)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEntry(entry)}
                          className="px-2 py-1 rounded-lg text-xs border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
