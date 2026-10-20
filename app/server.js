'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_CART_ID = 'CART_ACTIVE';
const CART_ID_PATTERN = /^CART_[A-Za-z0-9_-]{1,80}$/;

app.use(express.json({ limit: '16kb' }));

const products = [
  { id: 1, name: 'MacBook Air M3 13 inch', category: 'Laptop', price: 27990000, oldPrice: 31990000, symbol: '⌘', tone: 'sand', badge: 'BÁN CHẠY', rating: '4.9', reviews: 128, stock: 100000 },
  { id: 2, name: 'iPhone 15 Pro 256GB', category: 'Điện thoại', price: 25990000, oldPrice: 28990000, symbol: '◉', tone: 'blue', badge: 'CHÍNH HÃNG', rating: '4.8', reviews: 96, stock: 100000 },
  { id: 3, name: 'Sony WH-1000XM5', category: 'Âm thanh', price: 7490000, oldPrice: 8990000, symbol: '◖◗', tone: 'lavender', badge: 'ƯU ĐÃI', rating: '4.9', reviews: 214, stock: 100000 },
  { id: 4, name: 'MacBook Air M2 13 inch', category: 'Laptop', price: 22990000, oldPrice: 25990000, symbol: '▱', tone: 'mint', badge: 'GIÁ TỐT', rating: '4.8', reviews: 83, stock: 100000 },
  { id: 5, name: 'Samsung Galaxy S24 256GB', category: 'Điện thoại', price: 18990000, oldPrice: 21990000, symbol: '◉', tone: 'rose', badge: 'MỚI', rating: '4.8', reviews: 111, stock: 100000 },
  { id: 6, name: 'JBL Flip 6', category: 'Âm thanh', price: 2590000, oldPrice: 3290000, symbol: '▥', tone: 'sand', badge: 'ƯU ĐÃI', rating: '4.7', reviews: 82, stock: 100000 },
];

const carts = new Map();
const orders = new Map();
let orderSequence = 0;

const allowedTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function sendJson(res, status, body, delayMs = 0) {
  return setTimeout(() => res.status(status).json(body), delayMs);
}

function getCart(cartId = DEFAULT_CART_ID) {
  if (!carts.has(cartId)) carts.set(cartId, new Map());
  return carts.get(cartId);
}

function publicCart(cartId = DEFAULT_CART_ID) {
  const cart = getCart(cartId);
  const items = [...cart.values()].map((line) => {
    const product = products.find((item) => item.id === line.productId);
    return {
      ...line,
      name: product.name,
      price: product.price,
      lineTotal: product.price * line.quantity,
    };
  });

  return {
    cartId,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

function requestedCartId(req) {
  return req.get('x-cart-id') || DEFAULT_CART_ID;
}

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.get('/api/products', (req, res) => {
  const query = String(req.query.q || '').trim().toLocaleLowerCase('vi');
  const category = String(req.query.category || '').trim();
  const filtered = products.filter((product) =>
    product.name.toLocaleLowerCase('vi').includes(query) &&
    (!category || category === 'all' || product.category === category));

  return sendJson(res, 200, filtered, 50);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find((item) => item.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  return sendJson(res, 200, product, 50);
});

app.get('/api/cart', (req, res) => {
  const cartId = requestedCartId(req);
  if (!CART_ID_PATTERN.test(cartId)) {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ.' });
  }
  return sendJson(res, 200, publicCart(cartId), 50);
});

app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body || {};
  const cartId = req.body?.cartId ?? DEFAULT_CART_ID;
  if (typeof cartId !== 'string' || !CART_ID_PATTERN.test(cartId)) {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ.' });
  }
  if (!Number.isInteger(productId) || !products.some((product) => product.id === productId)) {
    return res.status(400).json({ error: 'productId không hợp lệ.' });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Số lượng phải là số nguyên từ 1 đến 10.' });
  }

  const cart = getCart(cartId);
  const currentQuantity = cart.get(productId)?.quantity || 0;
  if (currentQuantity + quantity > 10) {
    return res.status(400).json({ error: 'Tổng số lượng một sản phẩm không được vượt quá 10.' });
  }

  const product = products.find((item) => item.id === productId);
  if (quantity > product.stock) {
    return res.status(400).json({ error: 'Số lượng tồn kho không đủ.' });
  }

  product.stock -= quantity;
  cart.set(productId, { productId, quantity: currentQuantity + quantity });
  return sendJson(res, 200, { message: 'Đã thêm vào giỏ hàng', ...publicCart(cartId) }, 50);
});

app.put('/api/cart/:productId', (req, res) => {
  const productId = Number(req.params.productId);
  const { quantity } = req.body || {};
  const cartId = requestedCartId(req);
  if (!CART_ID_PATTERN.test(cartId)) {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ.' });
  }

  const cart = getCart(cartId);
  if (!cart.has(productId)) {
    return res.status(404).json({ error: 'Sản phẩm không có trong giỏ.' });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Số lượng phải là số nguyên từ 1 đến 10.' });
  }

  const previousQuantity = cart.get(productId).quantity;
  const product = products.find((item) => item.id === productId);
  if (quantity > previousQuantity && quantity - previousQuantity > product.stock) {
    return res.status(400).json({ error: 'Số lượng tồn kho không đủ.' });
  }

  product.stock += previousQuantity - quantity;
  cart.set(productId, { productId, quantity });
  return sendJson(res, 200, publicCart(cartId), 50);
});

app.delete('/api/cart/:productId', (req, res) => {
  const cartId = requestedCartId(req);
  if (!CART_ID_PATTERN.test(cartId)) {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ.' });
  }

  const cart = getCart(cartId);
  const productId = Number(req.params.productId);
  const line = cart.get(productId);
  if (line) {
    products.find((product) => product.id === productId).stock += line.quantity;
  }
  cart.delete(productId);
  return sendJson(res, 200, publicCart(cartId), 50);
});

app.post('/api/checkout', (req, res) => {
  const { cartId, customerName, address } = req.body || {};
  if (typeof cartId !== 'string' || !CART_ID_PATTERN.test(cartId) || !carts.has(cartId)) {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ.' });
  }

  const cart = carts.get(cartId);
  if (!cart.size) return res.status(400).json({ error: 'Giỏ hàng đang trống.' });

  const name = typeof customerName === 'string' ? customerName.trim() : '';
  if (name.length < 2) {
    return res.status(400).json({ error: 'Tên khách hàng phải từ 2 ký tự trở lên' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Tên khách hàng không được vượt quá 100 ký tự.' });
  }
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ error: 'Địa chỉ giao hàng không được để trống.' });
  }
  if (address.trim().length > 250) {
    return res.status(400).json({ error: 'Địa chỉ giao hàng không được vượt quá 250 ký tự.' });
  }

  orderSequence += 1;
  const orderId = `ORD_${Date.now()}${String(orderSequence).padStart(3, '0')}`;
  const cartSnapshot = publicCart(cartId);
  const order = {
    orderId,
    customerName: name,
    address: address.trim(),
    status: 'PENDING',
    items: cartSnapshot.items,
    total: cartSnapshot.total,
    createdAt: new Date().toISOString(),
  };

  orders.set(orderId, order);
  carts.delete(cartId);
  return sendJson(res, 201, { message: 'Đặt hàng thành công!', ...order }, 150);
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
  return res.json(order);
});

app.patch('/api/orders/:orderId/status', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });

  const { status } = req.body || {};
  if (!allowedTransitions[order.status].includes(status)) {
    return res.status(400).json({
      error: `Không thể chuyển đơn từ ${order.status} sang ${status || 'trạng thái không hợp lệ'}.`,
    });
  }

  order.status = status;
  if (status === 'CANCELLED') {
    for (const item of order.items) {
      products.find((product) => product.id === item.productId).stock += item.quantity;
    }
  }
  return res.json(order);
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Nội dung JSON không hợp lệ.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Nội dung yêu cầu vượt quá giới hạn 16KB.' });
  }
  return res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống.' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TechStore đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = app;
