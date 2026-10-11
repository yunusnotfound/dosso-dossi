import type { AdminRole } from './schemas';
export type { AdminProfile, AdminRole, Alerts, BranchStat, DashboardResponse, DashboardSummary, HourlyPoint, LoginResponse, TimeseriesPoint } from './schemas';

/// Rol etiketleri — panelde tek yerden.
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Süper Yönetici',
  MANAGER: 'Yönetici',
  BRANCH_MANAGER: 'Şube Müdürü',
  VIEWER: 'İzleyici',
};
