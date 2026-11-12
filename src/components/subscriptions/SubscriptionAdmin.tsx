'use client';
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Policy } from '@/lib/subscriptions/model';
import type { PlanView } from './SubscriptionAccount';
import { dateLabel, money } from './shared';
import styles from './Subscriptions.module.css';

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

async function request(method = 'GET', data?: unknown, queryParams?: string) {
  const url = queryParams ? `/api/admin/subscriptions?${queryParams}` : '/api/admin/subscriptions';
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Unable to load subscription operations.');
  return result;
}

export function SubscriptionAdmin() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [intervalFilter, setIntervalFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (intervalFilter !== 'all') params.set('intervalDays', intervalFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());

    const data = await request('GET', undefined, params.toString());
    setPolicy(data.policy);
    setPlans(data.subscriptions || []);
    if (data.pagination) {
      setPagination(data.pagination);
    }
  }, [page, pageSize, statusFilter, intervalFilter, searchQuery]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void run(refresh);
    }, 200);
    return () => clearTimeout(timer);
  }, [refresh]);

  const startIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endIdx = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className={styles.page}>
      <p className="eyebrow"><StorefrontText id="copy_acd778e9d5ee459c" fallback="Commerce operations" /></p>
      <h1><StorefrontText id="copy_35f0d0f48a704c7e" fallback="Product subscriptions" /></h1>
      <p>
        <StorefrontText
          id="copy_556a6142bf9e9745"
          fallback="All catalog variants support replenishment every 3, 7, 14, 30 or 60 days. Accepted plans retain their discount rates. New settings apply to new plans."
        />
      </p>

      {message && <p role="status" className={styles.message}>{message}</p>}

      {!policy ? (
        <p role="status">{busy ? 'Loading settings…' : 'Settings unavailable.'}</p>
      ) : (
        <form
          className={styles.card}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const data = await request('PUT', {
                enabled: f.get('enabled') === 'on',
                renewalsEnabled: f.get('renewalsEnabled') === 'on',
                baseBps: Math.round(Number(f.get('base')) * 100),
                prepaidBps: Math.round(Number(f.get('prepaid')) * 100),
                version: policy.version,
              });
              setPolicy(data.policy);
              setMessage('Settings saved. Existing discount promises are preserved.');
            });
          }}
          key={policy.version}
        >
          <h2>Discounts &amp; availability</h2>
          <div className={styles.fields}>
            <label>
              <StorefrontText id="copy_31d68211d85ca451" fallback="Subscription product discount (%)" />
              <input type="number" name="base" min="0" max="99" step="0.01" defaultValue={policy.baseBps / 100} required />
            </label>
            <label>
              <StorefrontText id="copy_c083b05f501d198c" fallback="Additional prepaid product discount (%)" />
              <input type="number" name="prepaid" min="0" max="99" step="0.01" defaultValue={policy.prepaidBps / 100} required />
            </label>
          </div>
          <label className={styles.check}>
            <input type="checkbox" name="enabled" defaultChecked={policy.enabled} />
            <StorefrontText id="copy_34640ca68eabae6c" fallback="Offer subscriptions to customers" />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="renewalsEnabled" defaultChecked={policy.renewalsEnabled} />
            <StorefrontText id="copy_545db63ac6c11a9d" fallback="Generate scheduled renewals (global stop leaves existing orders intact)" />
          </label>
          <p>
            <StorefrontText
              id="copy_f064787fc10d0ae1"
              fallback="Discounts add on the same product subtotal. Coupons and standard payment discounts are excluded. Existing shipping settings apply after both discounts. Configure the commerce worker and renewal email delivery before enabling."
            />
          </p>
          <button type="submit" disabled={busy}>
            <StorefrontText id="copy_bc69d29f1084824f" fallback="Save subscription settings" />
          </button>
        </form>
      )}

      <div className={styles.actions}>
        <button disabled={busy} className={styles.secondary} onClick={() => void run(refresh)}>
          <StorefrontText id="copy_cbc510c49c246f45" fallback="Refresh plans" />
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await request('POST', { action: 'scan' });
              setMessage('Renewal scan queued for the commerce worker.');
            })
          }
        >
          <StorefrontText id="copy_c56116b490f60fe0" fallback="Queue renewal scan" />
        </button>
        <Link href="/admin/fulfillment">Orders, refunds &amp; worker failures →</Link>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchInput}>
            <input
              type="text"
              placeholder="Search Subscription ID, Customer Email or Address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search subscriptions"
            />
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Interval:</span>
            <select
              value={intervalFilter}
              onChange={(e) => {
                setIntervalFilter(e.target.value);
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value="all">All Cadences</option>
              <option value="3">Every 3 Days</option>
              <option value="7">Every 7 Days</option>
              <option value="14">Every 14 Days</option>
              <option value="30">Every 30 Days</option>
              <option value="60">Every 60 Days</option>
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className={styles.filterSelect}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {(statusFilter !== 'all' || intervalFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setStatusFilter('all');
                setIntervalFilter('all');
                setSearchQuery('');
                setPage(1);
              }}
              style={{ minHeight: '40px', padding: '6px 12px' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Subscription Results */}
      {!plans.length ? (
        <p><StorefrontText id="copy_8dfc1204523fe447" fallback="No subscription plans yet." /></p>
      ) : (
        plans.map((p) => {
          const badgeClass =
            p.status === 'active'
              ? styles.badgeActive
              : p.status === 'paused'
              ? styles.badgePaused
              : styles.badgeCancelled;

          return (
            <section className={styles.card} key={p.id}>
              <div className={styles.planHeader}>
                <h2 className={styles.planTitle}>
                  {p.input.address.name} · Every {p.intervalDays} days
                </h2>
                <span className={`${styles.badge} ${badgeClass}`}>{p.status}</span>
              </div>
              <p className={styles.metaLine}>
                <strong>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{p.id}</span> ·{' '}
                <strong>Next Renewal:</strong> {dateLabel(p.nextMs)} ·{' '}
                <strong>Payment:</strong> {p.input.method}
              </p>
              <p className={styles.metaLine}>
                <strong>Customer:</strong> {p.input.address.email} · {p.input.address.city}, {p.input.address.postcode}
              </p>
              {p.cycles && p.cycles.length > 0 && (
                <div className={styles.cycleList}>
                  <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Cycles history:</p>
                  {p.cycles.map((c) => (
                    <p key={c.id} style={{ margin: '3px 0', fontSize: 13, color: '#555850' }}>
                      <StorefrontText id="copy_518653530449cca8" fallback="Cycle" /> {c.sequence} · {c.status} ·{' '}
                      {c.paymentStatus || 'not ordered'}
                      {c.totalPaise !== undefined ? ` · ${money(c.totalPaise)}` : ''}
                      {c.blocked_reason ? ` · ${c.blocked_reason}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {/* Pagination Controls */}
      <div className={styles.paginationBar}>
        <div className={styles.paginationInfo}>
          Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of{' '}
          <strong>{pagination.total}</strong> subscriptions
        </div>

        <div className={styles.paginationControls}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={pagination.page <= 1 || busy}
            className={styles.pageBtn}
          >
            ← Previous
          </button>

          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            let pageNum: number;
            if (pagination.totalPages <= 5) {
              pageNum = i + 1;
            } else if (pagination.page <= 3) {
              pageNum = i + 1;
            } else if (pagination.page >= pagination.totalPages - 2) {
              pageNum = pagination.totalPages - 4 + i;
            } else {
              pageNum = pagination.page - 2 + i;
            }

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                disabled={busy}
                className={`${styles.pageBtn} ${pagination.page === pageNum ? styles.pageBtnActive : ''}`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
            disabled={pagination.page >= pagination.totalPages || busy}
            className={styles.pageBtn}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
