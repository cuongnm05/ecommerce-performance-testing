import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/2.4.0/dist/bundle.js';

export const options = {
  stages: [
    { duration: '5s', target: 20 },
    { duration: '15s', target: 50 }, // Peak load
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const params = { headers: { 'Content-Type': 'application/json' } };

  const products = http.get(BASE_URL + '/api/products');
  check(products, {
    'GET Products status 200': (response) => response.status === 200,
    'GET Products returns catalog': (response) => Array.isArray(response.json()) && response.json().length > 0,
  });
  sleep(0.5);

  const cart = http.post(
    BASE_URL + '/api/cart',
    JSON.stringify({ productId: 1, quantity: 1 }),
    params,
  );
  check(cart, {
    'POST Cart status 200': (response) => response.status === 200,
    'POST Cart returns cart id': (response) => response.json('cartId') === 'CART_ACTIVE',
  });
  sleep(0.5);

  const checkout = http.post(
    BASE_URL + '/api/checkout',
    JSON.stringify({
      cartId: 'CART_ACTIVE',
      customerName: 'Sinh Vien Testing',
      address: 'Dai Hoc Ha Noi',
    }),
    params,
  );
  check(checkout, {
    'POST Checkout status 200': (response) => response.status === 200,
    'POST Checkout returns order id': (response) => String(response.json('orderId')).startsWith('ORD_'),
  });
  sleep(0.5);
}

function readMetric(metrics, metricName, valueName, fallback) {
  const metric = metrics[metricName];
  if (!metric || !metric.values || metric.values[valueName] === undefined) return fallback;
  const value = Number(metric.values[valueName]);
  return Number.isFinite(value) ? value : fallback;
}

// Thay thế hàm dùng Intl bằng hàm thông thường
function formatInteger(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDecimal(value, digits) {
  return Number(value).toFixed(digits).replace('.', ',');
}

function buildSummary(data) {
  const metrics = data.metrics || {};
  const totalRequests = readMetric(metrics, 'http_reqs', 'count', 0);
  const requestFailureRate = readMetric(metrics, 'http_req_failed', 'rate', 0);
  const requestFailures = readMetric(metrics, 'http_req_failed', 'fails', Math.round(totalRequests * requestFailureRate));
  const p95 = readMetric(metrics, 'http_req_duration', 'p(95)', 0);
  const checkPasses = readMetric(metrics, 'checks', 'passes', 0);
  const checkFailures = readMetric(metrics, 'checks', 'fails', 0);
  const iterations = readMetric(metrics, 'iterations', 'count', 0);
  const maxVus = readMetric(metrics, 'vus_max', 'max', 0);
  const breachedThresholds = Object.keys(metrics).reduce((count, name) => {
    const thresholds = metrics[name].thresholds || {};
    return count + Object.keys(thresholds).filter((threshold) => thresholds[threshold].ok === false).length;
  }, 0);
  const failurePercent = requestFailureRate * 100;
  const needsReview = requestFailures > 0 || checkFailures > 0;
  const statusClass = breachedThresholds > 0 ? 'status-fail' : (needsReview ? 'status-review' : 'status-pass');
  const statusLabel = breachedThresholds > 0
    ? 'Chưa đạt ngưỡng'
    : (needsReview ? 'Đạt ngưỡng · cần điều tra lỗi' : 'Đạt ngưỡng hiệu năng');
  let interpretation;
  if (breachedThresholds > 0) {
    interpretation = 'Có ' + breachedThresholds + ' ngưỡng bị vi phạm. Hãy xem chi tiết chỉ số và phân phối độ trễ bên dưới.';
  } else if (needsReview) {
    interpretation = formatInteger(requestFailures) + ' request lỗi (' + formatDecimal(failurePercent, 2) +
      '%) và ' + formatInteger(checkFailures) + ' kiểm tra thất bại.';
  } else {
    interpretation = 'Các ngưỡng hiệu năng cấu hình được đáp ứng và không ghi nhận kiểm tra thất bại.';
  }
  const checkTotal = checkPasses + checkFailures;
  const cards = [
    ['Tổng số request', formatInteger(totalRequests), 'Trung bình ' + formatDecimal(readMetric(metrics, 'http_reqs', 'rate', 0), 2) + ' request/giây'],
    ['Độ trễ p95', formatDecimal(p95, 2) + ' ms', 'Ngưỡng cấu hình: dưới 500 ms'],
    ['Request thất bại', formatInteger(requestFailures), formatDecimal(failurePercent, 2) + '% · ngưỡng dưới 5%'],
    ['Kiểm tra đạt', formatInteger(checkPasses) + ' / ' + formatInteger(checkTotal), formatInteger(checkFailures) + ' lỗi · ' + formatInteger(iterations) + ' lượt · tối đa ' + formatInteger(maxVus) + ' VU'],
  ].map((card) => '<article class="summary-card"><span>' + card[0] + '</span><strong>' + card[1] + '</strong><small>' + card[2] + '</small></article>').join('');

  return '<section class="report-summary" aria-label="Tóm tắt kết quả">' +
    '<div class="summary-top"><span class="report-eyebrow">KẾT QUẢ CHẠY K6</span><span class="status-pill ' + statusClass + '">' + statusLabel + '</span></div>' +
    '<p class="summary-copy">' + interpretation + '</p><div class="summary-grid">' + cards + '</div>' +
    '<p class="summary-gate"><b>Quality gate:</b> p95 &lt; 500 ms · tỷ lệ request lỗi &lt; 5% · cấu hình tăng tải tối đa 50 virtual users.</p>' +
    '</section><div class="report-detail-intro"><h2>Chi tiết báo cáo</h2><p>Chọn tab để xem phân vị request, thống kê workload và kết quả từng kiểm tra.</p></div>';
}

export function handleSummary(data) {
  const reportStyles = [
    '<style>',
    ':root{color-scheme:light;--ink:#18221e;--muted:#6e7b73;--line:#e2e9e4;--paper:#fff;--canvas:#f6f8f5;--green:#176b50;--green-dark:#163b2e;--green-soft:#e8f3ed;--amber:#875b0b;--amber-soft:#fff5df;--red:#a5362c;--red-soft:#fff0ee}',
    '*{box-sizing:border-box}',
    'body{max-width:1180px;margin:0 auto;padding:30px 22px 18px;background:var(--canvas);color:var(--ink);font:14px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
    'body:before{content:"";position:fixed;z-index:20;top:0;left:0;width:100%;height:4px;background:var(--green)}',
    'h1{display:flex;align-items:center;gap:12px;margin:0 0 20px;color:var(--ink);font-size:clamp(27px,4vw,39px);letter-spacing:-1.5px}',
    'h1:before{content:"T";width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:var(--green);color:#d7f16a;font-size:20px;letter-spacing:0}',
    '.report-summary,.report-detail-intro{margin:0 0 22px}',
    '.summary-top{display:flex;align-items:center;justify-content:space-between;gap:14px}',
    '.report-eyebrow{color:var(--green);font-size:10px;font-weight:850;letter-spacing:1.4px}',
    '.status-pill{padding:6px 10px;border:1px solid;border-radius:99px;font-size:10px;font-weight:800}',
    '.status-pass{border-color:#b9ddc8;background:var(--green-soft);color:var(--green)}.status-review{border-color:#f1d99e;background:var(--amber-soft);color:var(--amber)}.status-fail{border-color:#f0c3be;background:var(--red-soft);color:var(--red)}',
    '.summary-copy{margin:11px 0 15px;color:#536158;font-size:12px}',
    '.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
    '.summary-card{min-height:112px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--paper)}',
    '.summary-card span,.summary-card small{display:block;color:var(--muted);font-size:9px}.summary-card span{font-weight:800;letter-spacing:.6px;text-transform:uppercase}',
    '.summary-card strong{display:block;margin:9px 0 4px;font-size:clamp(19px,2.5vw,27px);line-height:1.1}',
    '.summary-gate{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:#edf2ed;color:#526158;font-size:10px}',
    '.report-detail-intro{margin-top:28px}.report-detail-intro h2{margin:0;font-size:20px}.report-detail-intro p{margin:3px 0 0;color:var(--muted);font-size:11px}',
    'table{width:100%;min-width:690px;border-collapse:collapse;background:#fff;color:var(--ink);font-size:11px}th,td{padding:9px 10px;border-bottom:1px solid var(--line)}th{background:#f5f8f5;color:#58675e;text-align:left;text-transform:uppercase}',
    '</style>',
  ].join('');

  return {
    "summary.html": htmlReport(data),
  };
}
