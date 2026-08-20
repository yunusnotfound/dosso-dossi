import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { Drawer, Field, Input, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, Button, Card, SectionTitle } from '../../components/ui';
import { ROLE_LABELS, type AdminRole } from '../../api/types';

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AuditRow {
  id: string;
  adminEmail: string;
  adminName: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string;
  ip: string;
  createdAt: string;
}

interface AuditList {
  page: number;
  pageSize: number;
  total: number;
  logs: AuditRow[];
}

interface Branch {
  id: string;
  name: string;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function AdminsPage() {
  const [tab, setTab] = useState('admins');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Yönetim" subtitle="Panel kullanıcıları ve işlem geçmişi" />
      <Tabs
        tabs={[
          { id: 'admins', label: 'Yöneticiler' },
          { id: 'audit', label: 'İşlem geçmişi' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'admins' ? <AdminsTab /> : <AuditTab />}
    </div>
  );
}

function AdminsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminRow | null>(null);

  const list = useQuery({
    queryKey: ['admins'],
    queryFn: () => api<AdminRow[]>('/admin/admins'),
  });
  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => api<Branch[]>('/admin/branches'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admins'] });

  const reset = useMutation({
    mutationFn: (id: string) =>
      api<{ tempPassword: string }>(`/admin/admins/${id}/reset-password`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      setTempPassword(r.tempPassword);
      refresh();
    },
  });

  const columns: Column<AdminRow>[] = [
    {
      key: 'email',
      header: 'Yönetici',
      render: (a) => (
        <div>
          <p className="font-semibold text-ink">{a.name || a.email}</p>
          <p className="text-xs text-ink-muted">{a.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (a) => <Badge>{ROLE_LABELS[a.role]}</Badge> },
    { key: 'branch', header: 'Şube', render: (a) => a.branchName ?? '—' },
    {
      key: 'last',
      header: 'Son giriş',
      render: (a) => (a.lastLoginAt ? fmtDate(a.lastLoginAt) : '—'),
    },
    {
      key: 'active',
      header: 'Durum',
      render: (a) => (
        <Badge tone={a.isActive ? 'ok' : 'neutral'}>{a.isActive ? 'Aktif' : 'Pasif'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            reset.mutate(a.id);
          }}
          className="text-xs font-semibold text-brand hover:underline"
        >
          Şifre sıfırla
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Yönetici ekle</Button>
      </div>

      {tempPassword ? (
        <Card className="bg-warn-soft">
          <SectionTitle>Geçici şifre — bir daha gösterilmez</SectionTitle>
          <p className="tnum font-[family-name:--font-display] text-2xl font-extrabold text-ink">
            {tempPassword}
          </p>
          <Button variant="ghost" onClick={() => setTempPassword(null)}>
            Kapat
          </Button>
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(a) => a.id}
        onRowClick={setEditing}
        loading={list.isLoading}
      />

      <AdminForm
        open={creating || !!editing}
        admin={editing}
        branches={branches.data ?? []}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(pw) => {
          setCreating(false);
          setEditing(null);
          if (pw) setTempPassword(pw);
          refresh();
        }}
      />
    </>
  );
}

function AdminForm({
  open,
  admin,
  branches,
  onClose,
  onSaved,
}: {
  open: boolean;
  admin: AdminRow | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (tempPassword?: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>('VIEWER');
  const [branchId, setBranchId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = admin?.id ?? (open ? 'new' : '');
  if (open && lastKey !== key) {
    setEmail(admin?.email ?? '');
    setName(admin?.name ?? '');
    setRole(admin?.role ?? 'VIEWER');
    setBranchId(admin?.branchId ?? '');
    setIsActive(admin?.isActive ?? true);
    setError('');
    setLastKey(key);
  }
  if (!open && lastKey !== null) setLastKey(null);

  const save = useMutation({
    mutationFn: async () => {
      if (admin) {
        await api(`/admin/admins/${admin.id}`, {
          method: 'PATCH',
          body: { name, role, branchId: branchId || null, isActive },
        });
        return undefined;
      }
      const res = await api<{ tempPassword: string }>('/admin/admins', {
        method: 'POST',
        body: { email, name, role, branchId: branchId || null },
      });
      return res.tempPassword;
    },
    onSuccess: (pw) => onSaved(pw),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });

  return (
    <Drawer
      open={open}
      title={admin ? admin.email : 'Yönetici ekle'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="E-posta">
          <Input
            type="email"
            value={email}
            disabled={!!admin}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Ad Soyad">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {role === 'BRANCH_MANAGER' ? (
          <Field label="Şube" hint="Şube müdürü yalnızca bu şubenin verisini görür.">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Seçiniz</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {admin ? (
          <Field label="Durum">
            <Select
              value={isActive ? '1' : '0'}
              onChange={(e) => setIsActive(e.target.value === '1')}
            >
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </Select>
          </Field>
        ) : (
          <p className="rounded-[--radius-chip] bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
            Kaydedince geçici bir şifre üretilir ve bir kez gösterilir.
          </p>
        )}
        {error ? (
          <p className="rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}

function AuditTab() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditRow | null>(null);

  const q = useQuery({
    queryKey: ['audit', { entity, action, page }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (entity) p.set('entity', entity);
      if (action) p.set('action', action);
      return api<AuditList>(`/admin/audit?${p}`);
    },
  });

  const columns: Column<AuditRow>[] = [
    { key: 'date', header: 'Tarih', render: (l) => fmtDate(l.createdAt) },
    {
      key: 'who',
      header: 'Kim',
      render: (l) => (
        <div>
          <p>{l.adminName || l.adminEmail}</p>
          <p className="text-xs text-ink-muted">{l.ip}</p>
        </div>
      ),
    },
    { key: 'action', header: 'İşlem', render: (l) => <Badge>{l.action}</Badge> },
    {
      key: 'entity',
      header: 'Kayıt',
      render: (l) => (
        <span className="text-ink-muted">
          {l.entity} · {l.entityId}
        </span>
      ),
    },
    { key: 'reason', header: 'Gerekçe', render: (l) => l.reason || '—' },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">Tüm kayıtlar</option>
          {['Order', 'Wallet', 'LoyaltyAccount', 'Product', 'Branch', 'Campaign', 'PromoCode', 'AdminUser', 'Setting', 'PosEvent', 'PosCharge'].map(
            (e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ),
          )}
        </Select>
        <Input
          placeholder="İşlem ara (order.cancel)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-56"
        />
      </div>

      <DataTable
        columns={columns}
        rows={q.data?.logs}
        rowKey={(l) => l.id}
        onRowClick={setOpen}
        loading={q.isLoading}
      />
      <Pager
        page={q.data?.page ?? 1}
        pageSize={q.data?.pageSize ?? 50}
        total={q.data?.total ?? 0}
        onPage={setPage}
      />

      <Drawer open={!!open} title={open?.action ?? ''} onClose={() => setOpen(null)}>
        {open ? (
          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Özet</SectionTitle>
              <p className="text-sm">
                {open.adminName || open.adminEmail} · {fmtDate(open.createdAt)} ·{' '}
                {open.ip}
              </p>
              {open.reason ? (
                <p className="mt-2 rounded-[--radius-chip] bg-surface-sunken px-3 py-2 text-sm">
                  {open.reason}
                </p>
              ) : null}
            </Card>
            <Card>
              <SectionTitle>Öncesi</SectionTitle>
              <pre className="overflow-x-auto rounded-[--radius-chip] bg-surface-sunken p-3 text-xs">
                {JSON.stringify(open.before, null, 2) ?? '—'}
              </pre>
            </Card>
            <Card>
              <SectionTitle>Sonrası</SectionTitle>
              <pre className="overflow-x-auto rounded-[--radius-chip] bg-surface-sunken p-3 text-xs">
                {JSON.stringify(open.after, null, 2) ?? '—'}
              </pre>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
