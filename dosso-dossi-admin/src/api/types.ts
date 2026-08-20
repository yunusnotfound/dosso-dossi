export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'BRANCH_MANAGER' | 'VIEWER';

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
  branchId: string | null;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  admin: AdminProfile & { name: string };
}

export interface DashboardSummary {
  orderRevenue: number;
  qrRevenue: number;
  totalRevenue: number;
  orderCount: number;
  topUpTotal: number;
  newUsers: number;
  stampsEarned: number;
  freeDrinksGranted: number;
  pendingGifts: number;
}

export interface TimeseriesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface BranchStat {
  branchId: string;
  name: string;
  isOpen: boolean;
  revenue: number;
  orders: number;
}

export interface HourlyPoint {
  hour: number;
  orders: number;
}

export interface Alerts {
  unforwardedOrders: number;
  failedPosEvents: number;
  closedBranches: string[];
  pendingPayments: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  timeseries: TimeseriesPoint[];
  branches: BranchStat[];
  hourly: HourlyPoint[];
  alerts: Alerts;
}

/// Rol etiketleri — panelde tek yerden.
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Süper Yönetici',
  MANAGER: 'Yönetici',
  BRANCH_MANAGER: 'Şube Müdürü',
  VIEWER: 'İzleyici',
};
