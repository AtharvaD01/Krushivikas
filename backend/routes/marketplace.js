const express = require('express');
const db = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const positiveId = (value, name = 'id') => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  return n;
};

const text = (value, name, max, required = true) => {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new ApiError(400, `${name} is required and must be at most ${max} characters`);
  }
  return value.trim();
};

const quantity = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.round(n * 100) !== n * 100) {
    throw new ApiError(400, 'Quantity must be positive and have at most 2 decimal places');
  }
  return n;
};

const money = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.round(n * 100) !== n * 100) {
    throw new ApiError(400, 'Price must be positive and have at most 2 decimal places');
  }
  return n;
};

// Browse active listings. Supports crop, location, and pagination filters.
router.get('/listings', asyncHandler(async (req, res) => {
  const conditions = ["l.status = 'active'", 'l.available_quantity_kg > 0'];
  const params = [];

  if (req.query.crop_id !== undefined) {
    conditions.push('l.crop_id = ?');
    params.push(positiveId(req.query.crop_id, 'crop_id'));
  }

  if (req.query.location !== undefined) {
    const location = text(req.query.location, 'location', 150);
    conditions.push('f.location LIKE ?');
    params.push(`%${location}%`);
  }

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

  const [rows] = await db.query(
    `SELECT l.listing_id, l.harvest_id, l.farmer_id, l.crop_id,
            f.name AS farmer_name, f.location AS farmer_location,
            c.crop_name, c.variety, l.price_per_kg,
            l.quantity_kg, l.available_quantity_kg, l.quality,
            l.description, l.created_at
       FROM marketplace_listings l
       JOIN farmers f ON f.farmer_id = l.farmer_id
       JOIN crops c ON c.crop_id = l.crop_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC, l.listing_id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({ data: rows, count: rows.length, limit, offset });
}));

// List only the authenticated farmer's own marketplace listings.
router.get('/listings/mine', requireRole('farmer'), asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

  const [rows] = await db.query(
    `SELECT l.listing_id, l.harvest_id, l.farmer_id, l.crop_id,
            f.name AS farmer_name, f.location AS farmer_location,
            c.crop_name, c.variety, l.price_per_kg,
            l.quantity_kg, l.available_quantity_kg, l.quality,
            l.status, l.description, l.created_at
       FROM marketplace_listings l
       JOIN farmer_accounts fa ON fa.farmer_id = l.farmer_id
       JOIN farmers f ON f.farmer_id = l.farmer_id
       JOIN crops c ON c.crop_id = l.crop_id
      WHERE fa.user_id = ?
      ORDER BY l.created_at DESC, l.listing_id DESC
      LIMIT ? OFFSET ?`,
    [req.auth.userId, limit, offset]
  );

  res.json({ data: rows, count: rows.length, limit, offset });
}));

// Get one active listing.
router.get('/listings/:id', asyncHandler(async (req, res) => {
  const id = positiveId(req.params.id);

  const [rows] = await db.query(
    `SELECT l.*, f.name AS farmer_name, f.location AS farmer_location,
            c.crop_name, c.variety
       FROM marketplace_listings l
       JOIN farmers f ON f.farmer_id = l.farmer_id
       JOIN crops c ON c.crop_id = l.crop_id
      WHERE l.listing_id = ? AND l.status = 'active'`,
    [id]
  );

  if (!rows.length) throw new ApiError(404, 'Active listing not found');
  res.json({ data: rows[0] });
}));

// Create a listing from a real harvest record.
router.post('/listings', requireRole('farmer'), asyncHandler(async (req, res) => {
  const harvestId = positiveId(req.body?.harvest_id, 'harvest_id');

  const [accountRows] = await db.query(
    'SELECT farmer_id FROM farmer_accounts WHERE user_id = ?',
    [req.auth.userId]
  );

  if (!accountRows.length) {
    throw new ApiError(403, 'Your account is not linked to a farmer profile.');
  }

  const farmerId = Number(accountRows[0].farmer_id);
  const price = money(req.body?.price_per_kg);
  const requestedQty = quantity(req.body?.quantity_kg);
  const quality = req.body?.quality ?? 'B';

  if (!['A', 'B', 'C'].includes(quality)) {
    throw new ApiError(400, 'quality must be A, B, or C');
  }

  const description = req.body?.description == null
    ? null
    : text(req.body.description, 'description', 500, false);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [harvests] = await conn.query(
      `SELECT h.harvest_id, h.farmer_id, h.crop_id, h.quantity, h.quality
         FROM harvest h
        WHERE h.harvest_id = ?
        FOR UPDATE`,
      [harvestId]
    );

    if (!harvests.length) throw new ApiError(404, 'Harvest not found');

    const harvest = harvests[0];

    if (harvest.farmer_id !== farmerId) {
      throw new ApiError(400, 'Harvest does not belong to the supplied farmer');
    }

    // Prevent total active listings for this harvest from exceeding
    // its recorded quantity. Locking the harvest serializes listing creation.
    const [existing] = await conn.query(
      `SELECT COALESCE(SUM(quantity_kg), 0) AS listed_qty
         FROM marketplace_listings
        WHERE harvest_id = ?
          AND status IN ('active', 'paused', 'sold_out')`,
      [harvestId]
    );

    const alreadyListed = Number(existing[0].listed_qty);
    if (alreadyListed + requestedQty > Number(harvest.quantity) + 0.000001) {
      throw new ApiError(409, 'Listing quantity exceeds the unlisted harvest quantity');
    }

    const [result] = await conn.query(
      `INSERT INTO marketplace_listings
         (harvest_id, farmer_id, crop_id, price_per_kg,
          quantity_kg, available_quantity_kg, quality, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        harvestId, farmerId, harvest.crop_id, price,
        requestedQty, requestedQty, quality, description
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: 'Marketplace listing created',
      data: {
        listing_id: result.insertId,
        harvest_id: harvestId,
        farmer_id: farmerId,
        crop_id: harvest.crop_id,
        price_per_kg: price,
        quantity_kg: requestedQty,
        available_quantity_kg: requestedQty,
        quality,
        status: 'active'
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// Place an order. Inventory is locked and decremented in one transaction.
// The client cannot supply or override the unit price or order total.
router.post('/orders', requireRole('buyer'), asyncHandler(async (req, res) => {
  const buyerContact = text(req.body?.buyer_contact, 'buyer_contact', 20, false);
  const address = text(req.body?.delivery_address, 'delivery_address', 255);

  const [buyerRows] = await db.query(
    'SELECT user_id, name FROM users WHERE user_id = ? AND role = ? AND status = ?',
    [req.auth.userId, 'buyer', 'active']
  );
  if (!buyerRows.length) throw new ApiError(403, 'Active buyer account required.');
  const buyerName = buyerRows[0].name;

  const listingId = positiveId(req.body?.listing_id, 'listing_id');
  const requestedQty = quantity(req.body?.quantity_kg);

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [listings] = await conn.query(
      `SELECT listing_id, price_per_kg, available_quantity_kg, status
         FROM marketplace_listings
        WHERE listing_id = ?
        FOR UPDATE`,
      [listingId]
    );

    if (!listings.length) throw new ApiError(404, 'Listing not found');

    const listing = listings[0];

    if (listing.status !== 'active' || Number(listing.available_quantity_kg) <= 0) {
      throw new ApiError(409, 'This listing is not available for purchase');
    }

    if (requestedQty > Number(listing.available_quantity_kg)) {
      throw new ApiError(409, 'Requested quantity exceeds available stock');
    }

    const unitPrice = Number(listing.price_per_kg);
    const total = Math.round(unitPrice * requestedQty * 100) / 100;

    if (!Number.isFinite(total) || total <= 0 || total > 9999999999.99) {
      throw new ApiError(400, 'Order total is outside the supported range');
    }

    const [orderResult] = await conn.query(
      `INSERT INTO marketplace_orders
         (buyer_name, buyer_contact, delivery_address, total_amount, status, buyer_user_id)
       VALUES (?, ?, ?, ?, 'placed', ?)`,
      [buyerName, buyerContact, address, total, req.auth.userId]
    );

    await conn.query(
      `INSERT INTO marketplace_order_items
         (order_id, listing_id, quantity_kg, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?)`,
      [orderResult.insertId, listingId, requestedQty, unitPrice, total]
    );

    const remaining = Math.round(
      (Number(listing.available_quantity_kg) - requestedQty) * 100
    ) / 100;

    await conn.query(
      `UPDATE marketplace_listings
          SET available_quantity_kg = ?,
              status = ?
        WHERE listing_id = ?`,
      [remaining, remaining === 0 ? 'sold_out' : 'active', listingId]
    );

    await conn.commit();

    res.status(201).json({
      message: 'Order placed successfully',
      data: {
        order_id: orderResult.insertId,
        listing_id: listingId,
        quantity_kg: requestedQty,
        unit_price: unitPrice,
        total_amount: total,
        status: 'placed'
      }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// View orders. This college-project endpoint has no authentication yet.
router.get('/orders', requireRole('buyer', 'farmer'), asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

  let ownershipJoin = '';
  let ownershipWhere = '';
  const params = [];

  if (req.auth.role === 'buyer') {
    ownershipWhere = 'WHERE o.buyer_user_id = ?';
    params.push(req.auth.userId);
  } else {
    ownershipJoin = 'JOIN farmer_accounts fa ON fa.farmer_id = l.farmer_id AND fa.user_id = ?';
    params.push(req.auth.userId);
  }

  const [rows] = await db.query(
    `SELECT o.order_id, o.buyer_name, o.buyer_contact,
            o.delivery_address, o.total_amount, o.status,
            o.created_at, o.updated_at,
            i.order_item_id, i.listing_id, i.quantity_kg,
            i.unit_price, i.line_total,
            c.crop_name, c.variety, f.name AS farmer_name
       FROM marketplace_orders o
       JOIN marketplace_order_items i ON i.order_id = o.order_id
       JOIN marketplace_listings l ON l.listing_id = i.listing_id
       JOIN crops c ON c.crop_id = l.crop_id
       JOIN farmers f ON f.farmer_id = l.farmer_id
       ${ownershipJoin}
       ${ownershipWhere}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({ data: rows, count: rows.length, limit, offset });
}));

const allowedTransitions = {
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['dispatched', 'cancelled'],
  rejected: [],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: []
};

// Update an order's status. Restore stock when an eligible order is cancelled.
router.patch('/orders/:id/status', requireRole('buyer', 'farmer'), asyncHandler(async (req, res) => {
  const orderId = positiveId(req.params.id);
  const newStatus = req.body?.status;

  if (!Object.prototype.hasOwnProperty.call(allowedTransitions, newStatus)) {
    throw new ApiError(400, 'Invalid order status');
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      'SELECT order_id, status, buyer_user_id FROM marketplace_orders WHERE order_id = ? FOR UPDATE',
      [orderId]
    );

    if (!orders.length) throw new ApiError(404, 'Order not found');

    const order = orders[0];

    if (req.auth.role === 'buyer') {
      if (order.buyer_user_id !== req.auth.userId) {
        throw new ApiError(403, 'You can only manage your own orders.');
      }
      if (newStatus !== 'cancelled') {
        throw new ApiError(403, 'Buyers can only cancel their own eligible orders.');
      }
    } else if (req.auth.role === 'farmer') {
      const [ownedItems] = await conn.query(
        `SELECT i.order_item_id
           FROM marketplace_order_items i
           JOIN marketplace_listings l ON l.listing_id = i.listing_id
           JOIN farmer_accounts fa ON fa.farmer_id = l.farmer_id
          WHERE i.order_id = ? AND fa.user_id = ?
          LIMIT 1`,
        [orderId, req.auth.userId]
      );

      if (!ownedItems.length) {
        throw new ApiError(403, 'You can only manage orders for your own listings.');
      }

      if (!['accepted', 'rejected', 'dispatched', 'delivered'].includes(newStatus)) {
        throw new ApiError(403, 'Farmers cannot perform this status change.');
      }
    }

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw new ApiError(
        409,
        `Cannot change order status from ${order.status} to ${newStatus}`
      );
    }

    if (newStatus === 'cancelled') {
      const [items] = await conn.query(
        `SELECT i.listing_id, i.quantity_kg
           FROM marketplace_order_items i
          WHERE i.order_id = ?
          ORDER BY i.listing_id
          FOR UPDATE`,
        [orderId]
      );

      for (const item of items) {
        const [listings] = await conn.query(
          'SELECT listing_id, status, quantity_kg, available_quantity_kg FROM marketplace_listings WHERE listing_id = ? FOR UPDATE',
          [item.listing_id]
        );

        if (!listings.length) continue;

        const listing = listings[0];

        // Do not restore cancelled/rejected inventory to a listing that
        // has independently been withdrawn. The seller can manage it manually.
        if (['cancelled', 'paused'].includes(listing.status)) continue;

        const restored = Math.round(
          (Number(listing.available_quantity_kg) + Number(item.quantity_kg)) * 100
        ) / 100;

        if (restored > Number(listing.quantity_kg) + 0.000001) {
          throw new ApiError(409, 'Stock restoration would exceed listing quantity');
        }

        await conn.query(
          `UPDATE marketplace_listings
              SET available_quantity_kg = ?, status = 'active'
            WHERE listing_id = ?`,
          [restored, item.listing_id]
        );
      }
    }

    await conn.query(
      'UPDATE marketplace_orders SET status = ? WHERE order_id = ?',
      [newStatus, orderId]
    );

    await conn.query(
      `INSERT INTO order_status_history
         (order_id, previous_status, new_status, description, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        order.status,
        newStatus,
        `Order status changed from ${order.status} to ${newStatus}`,
        req.auth.userId
      ]
    );

    await conn.commit();
    res.json({ message: 'Order status updated', data: { order_id: orderId, status: newStatus } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;