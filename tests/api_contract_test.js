const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app/server');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
}));

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json();
  return { response, data };
}

async function json(path, method, body) {
  return api(path, { method, body: JSON.stringify(body) });
}

async function clearCart() {
  for (let id = 1; id <= 6; id += 1) await api(`/api/cart/${id}`, { method: 'DELETE' });
}

async function createOrder(customerName = 'An', address = 'Ha Noi') {
  await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
  return json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName, address });
}

test('API contract maps the implemented SRS requirements', async (t) => {
  await t.test('REQ-001 product catalog contains six products', async () => {
    const { response, data } = await api('/api/products');
    assert.equal(response.status, 200);
    assert.equal(data.length, 6);
  });

  await t.test('REQ-002 search is case-insensitive', async () => {
    const { data } = await api('/api/products?q=SONY');
    assert.equal(data.length, 1);
    assert.match(data[0].name, /Sony/);
  });

  await t.test('REQ-003 category filtering and all category work', async () => {
    const filtered = await api('/api/products?category=Âm%20thanh');
    const all = await api('/api/products?category=all');
    assert.equal(filtered.data.length, 2);
    assert.equal(all.data.length, 6);
  });

  await t.test('REQ-004 product prices are integer VND amounts', async () => {
    const { data } = await api('/api/products');
    assert.ok(data.every((product) => Number.isInteger(product.price) && product.price > 0));
  });

  await t.test('REQ-005 product details include badge, old price and rating', async () => {
    const { response, data } = await api('/api/products/1');
    assert.equal(response.status, 200);
    assert.ok(data.name && data.category && data.badge);
    assert.ok(data.oldPrice > data.price);
    assert.ok(data.rating >= 0 && data.rating <= 5);
  });

  await t.test('REQ-006 a valid product can be added to the cart', async () => {
    await clearCart();
    const { response, data } = await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
    assert.equal(response.status, 200);
    assert.equal(data.itemCount, 1);
    const sessionId = `CART_TEST_${Date.now()}`;
    await json('/api/cart', 'POST', { cartId: sessionId, productId: 2, quantity: 2 });
    const otherCart = await api('/api/cart', { headers: { 'x-cart-id': sessionId } });
    const defaultCart = await api('/api/cart');
    assert.equal(otherCart.data.itemCount, 2);
    assert.equal(defaultCart.data.itemCount, 1);
    await api('/api/cart/2', { method: 'DELETE', headers: { 'x-cart-id': sessionId } });
  });

  await t.test('REQ-007 quantities one and ten are accepted', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 2, quantity: 1 });
    const { response, data } = await json('/api/cart/2', 'PUT', { quantity: 10 });
    assert.equal(response.status, 200);
    assert.equal(data.items[0].quantity, 10);
    await clearCart();
  });

  await t.test('REQ-008 quantities zero, negative and eleven are rejected', async () => {
    for (const quantity of [0, -1, 11]) {
      const { response } = await json('/api/cart', 'POST', { productId: 1, quantity });
      assert.equal(response.status, 400);
    }
  });

  await t.test('REQ-009 decimal and string quantities are rejected', async () => {
    for (const quantity of [1.5, '2']) {
      const { response } = await json('/api/cart', 'POST', { productId: 1, quantity });
      assert.equal(response.status, 400);
    }
  });

  await t.test('REQ-010 cart subtotal equals unit price times quantity', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 1, quantity: 2 });
    const { data } = await api('/api/cart');
    assert.equal(data.total, data.items[0].price * 2);
    await clearCart();
  });

  await t.test('REQ-012 checkout clears the cart', async () => {
    await clearCart();
    const { response } = await createOrder();
    assert.equal(response.status, 201);
    const { data } = await api('/api/cart');
    assert.equal(data.itemCount, 0);
  });

  await t.test('REQ-013 checkout rejects an empty cart', async () => {
    await clearCart();
    const { response, data } = await json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName: 'An', address: 'Ha Noi' });
    assert.equal(response.status, 400);
    assert.match(data.error, /trống/);
  });

  await t.test('REQ-014 trimmed customer names of two and 100 characters are accepted', async () => {
    await clearCart();
    assert.equal((await createOrder('An')).response.status, 201);
    await clearCart();
    assert.equal((await createOrder('A'.repeat(100))).response.status, 201);
  });

  await t.test('REQ-015 empty and one-character names are rejected', async () => {
    for (const customerName of ['', 'A']) {
      await clearCart();
      await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
      const { response } = await json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName, address: 'Ha Noi' });
      assert.equal(response.status, 400);
    }
    await clearCart();
  });

  await t.test('REQ-016 names longer than 100 characters are rejected', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
    const { response } = await json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName: 'A'.repeat(101), address: 'Ha Noi' });
    assert.equal(response.status, 400);
    await clearCart();
  });

  await t.test('REQ-017 blank delivery addresses are rejected', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
    const { response } = await json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName: 'An', address: '   ' });
    assert.equal(response.status, 400);
    await clearCart();
  });

  await t.test('REQ-018 addresses of 251 characters are rejected', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
    const { response } = await json('/api/checkout', 'POST', { cartId: 'CART_ACTIVE', customerName: 'An', address: 'A'.repeat(251) });
    assert.equal(response.status, 400);
    await clearCart();
  });

  await t.test('REQ-019 unknown cart identifiers are rejected', async () => {
    await clearCart();
    await json('/api/cart', 'POST', { productId: 1, quantity: 1 });
    const { response } = await json('/api/checkout', 'POST', { cartId: 'NOT_A_CART', customerName: 'An', address: 'Ha Noi' });
    assert.equal(response.status, 400);
    await clearCart();
  });

  await t.test('REQ-020 order identifiers are unique and use ORD_ prefix', async () => {
    await clearCart();
    const first = await createOrder();
    const second = await createOrder();
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.match(first.data.orderId, /^ORD_\d+$/);
    assert.notEqual(first.data.orderId, second.data.orderId);
  });

  await t.test('REQ-022 new orders begin in PENDING', async () => {
    const { data } = await createOrder();
    assert.equal(data.status, 'PENDING');
  });

  await t.test('REQ-023 valid order status transitions are accepted', async () => {
    const { data: order } = await createOrder();
    let current = order;
    for (const status of ['CONFIRMED', 'SHIPPED', 'DELIVERED']) {
      current = (await json(`/api/orders/${order.orderId}/status`, 'PATCH', { status })).data;
      assert.equal(current.status, status);
    }
  });

  await t.test('REQ-024 cancellation from PENDING restores inventory', async () => {
    const { data: before } = await api('/api/products/1');
    const { data: order } = await createOrder();
    await json(`/api/orders/${order.orderId}/status`, 'PATCH', { status: 'CANCELLED' });
    const { data: afterCancel } = await api('/api/products/1');
    assert.equal(afterCancel.stock, before.stock);
  });

  await t.test('REQ-025 invalid status jumps are rejected', async () => {
    const { data: order } = await createOrder();
    const { response } = await json(`/api/orders/${order.orderId}/status`, 'PATCH', { status: 'DELIVERED' });
    assert.equal(response.status, 400);
  });

  await t.test('REQ-026 health endpoint reports service readiness', async () => {
    const { response, data } = await api('/api/health');
    assert.equal(response.status, 200);
    assert.equal(data.status, 'ok');
  });

  await t.test('REQ-027 malformed JSON returns a friendly 400 response', async () => {
    const response = await fetch(`${baseUrl}/api/cart`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.match(data.error, /JSON/);
  });

  await t.test('REQ-028 JSON bodies above 16KB are rejected', async () => {
    const response = await fetch(`${baseUrl}/api/cart`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(17000) }) });
    assert.equal(response.status, 413);
  });
});
