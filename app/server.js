'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '16kb' }));

const products = [
  { id: 1, name: 'MacBook Air M3 13 inch', category: 'Laptop', price: 27990000, oldPrice: 31990000, symbol: '⌘', tone: 'sand', badge: 'BÁN CHẠY', rating: '4.9', reviews: 128 },
  { id: 2, name: 'iPhone 15 Pro 256GB', category: 'Điện thoại', price: 25990000, oldPrice: 28990000, symbol: '◉', tone: 'blue', badge: 'CHÍNH HÃNG', rating: '4.8', reviews: 96 },
  { id: 3, name: 'Sony WH-1000XM5', category: 'Âm thanh', price: 7490000, oldPrice: 8990000, symbol: '◖◗', tone: 'lavender', badge: 'ƯU ĐÃI', rating: '4.9', reviews: 214 },
  { id: 4, name: 'MacBook Air M2 13 inch', category: 'Laptop', price: 22990000, oldPrice: 25990000, symbol: '▱', tone: 'mint', badge: 'GIÁ TỐT', rating: '4.8', reviews: 83 },
  { id: 5, name: 'Samsung Galaxy S24 256GB', category: 'Điện thoại', price: 18990000, oldPrice: 21990000, symbol: '◉', tone: 'rose', badge: 'MỚI', rating: '4.8', reviews: 111 },
  { id: 6, name: 'JBL Flip 6', category: 'Âm thanh', price: 2590000, oldPrice: 3290000, symbol: '▥', tone: 'sand', badge: 'ƯU ĐÃI', rating: '4.7', reviews: 82 },
];

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/products', (req, res) => {
  setTimeout(() => res.status(200).json(products), 50);
});

app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body || {};
  const product = products.find((item) => item.id === productId);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Sản phẩm hoặc số lượng không hợp lệ (số lượng từ 1 đến 10)' });
  }
  return setTimeout(() => res.status(200).json({ message: 'Đã thêm vào giỏ hàng', cartId: 'CART_ACTIVE' }), 50);
});

app.post('/api/checkout', (req, res) => {
  const { cartId, customerName, address } = req.body || {};
  const name = typeof customerName === 'string' ? customerName.trim() : '';
  const deliveryAddress = typeof address === 'string' ? address.trim() : '';
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Tên khách hàng phải từ 2 ký tự trở lên' });
  }
  if (!deliveryAddress || deliveryAddress.length > 250) {
    return res.status(400).json({ error: 'Địa chỉ không được để trống và tối đa 250 ký tự' });
  }
  if (cartId !== 'CART_ACTIVE') {
    return res.status(400).json({ error: 'Mã giỏ hàng không hợp lệ' });
  }

  // Deterministic responses keep UI checks repeatable. Load tests measure service
  // capacity and thresholds instead of injecting random application failures.
  return setTimeout(() => res.status(200).json({
    message: 'Đặt hàng thành công!',
    orderId: `ORD_${Date.now()}`,
  }), 150);
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ' });
});

app.listen(PORT, () => console.log(`TechStore running at http://localhost:${PORT}`));
