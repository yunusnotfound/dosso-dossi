import express, { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { requireWebAdmin } from './admin-auth.js';
import { requireWebCustomer } from './customer-auth.js';
import { addressCreateInput, addressUpdateInput, addressVersionInput, cartAddInput, cartAddressInput, cartQuantityInput, cartVersionInput, shippingInput } from './commerce.schemas.js';
import { addCartItem, changeCartItem, createAddress, deleteAddress, listAddresses, readCart, readShipping, removeCartItem, saveShipping, selectCartAddress, updateAddress } from './commerce.service.js';

const boundedJson: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { next(); return; }
  if (!req.is('application/json')) { res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'JSON içerik türü gerekli.' } }); return; }
  express.json({ limit: '4kb' })(req, res, next);
};
export function createCommerceRouter(database: () => PrismaClient): Router {
  const router = Router();
  router.use(['/cart', '/addresses', '/shipping', '/admin/shipping'], (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/shipping', async (_req, res) => { res.json({ shipping: await readShipping(database()) }); });
  router.use(['/cart', '/addresses'], requireWebCustomer(database), boundedJson);
  router.get('/cart', async (_req, res) => { res.json({ cart: await readCart(database(), res.locals.webCustomer.id) }); });
  router.post('/cart/items', async (req, res) => { res.json({ cart: await addCartItem(database(), res.locals.webCustomer.id, cartAddInput.parse(req.body)) }); });
  router.patch('/cart/items/:id', async (req, res) => { res.json({ cart: await changeCartItem(database(), res.locals.webCustomer.id, String(req.params.id), cartQuantityInput.parse(req.body)) }); });
  router.delete('/cart/items/:id', async (req, res) => { res.json({ cart: await removeCartItem(database(), res.locals.webCustomer.id, String(req.params.id), cartVersionInput.parse(req.body).version) }); });
  router.put('/cart/address', async (req, res) => { res.json({ cart: await selectCartAddress(database(), res.locals.webCustomer.id, cartAddressInput.parse(req.body)) }); });
  router.get('/addresses', async (_req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, addresses: await listAddresses(database(), customerId) });
  });
  router.post('/addresses', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.status(201).json({ customerId, address: await createAddress(database(), customerId, addressCreateInput.parse(req.body)) });
  });
  router.put('/addresses/:id', async (req, res) => {
    const customerId: string = res.locals.webCustomer.id;
    res.json({ customerId, address: await updateAddress(database(), customerId, String(req.params.id), addressUpdateInput.parse(req.body)) });
  });
  router.delete('/addresses/:id', async (req, res) => {
    await deleteAddress(database(), res.locals.webCustomer.id, String(req.params.id), addressVersionInput.parse(req.body).version);
    res.status(204).end();
  });
  router.use('/admin/shipping', requireWebAdmin(database), (_req, res, next) => {
    if (res.locals.webAdmin.role !== 'ADMIN') { next(AppError.forbidden()); return; }
    next();
  }, boundedJson);
  router.get('/admin/shipping', async (_req, res) => { res.json({ shipping: await readShipping(database()) }); });
  router.put('/admin/shipping', async (req, res) => { res.json({ shipping: await saveShipping(database(), shippingInput.parse(req.body), res.locals.webAdmin.id) }); });
  return router;
}
