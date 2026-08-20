import { Router } from 'express';
import { adminAuthRouter } from './admin-auth.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { adminOrdersRouter } from './orders.routes.js';
import { modulesRouter } from './modules.routes.js';

/// Panelin route ağacı. Modüller (sipariş, menü, şube, CRM, finans...)
/// buraya takılır; her biri kendi requireAdmin(rol...) korumasını taşır.
export const adminRouter = Router();

adminRouter.use('/auth', adminAuthRouter);
adminRouter.use('/dashboard', dashboardRouter);
adminRouter.use('/orders', adminOrdersRouter);
// Menü, şube, kampanya, müşteri, finans, POS, yönetim modülleri
adminRouter.use('/', modulesRouter);
