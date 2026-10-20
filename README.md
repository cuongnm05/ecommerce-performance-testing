# TechStore · Kiểm thử chất lượng và hiệu năng

TechStore là ứng dụng thương mại điện tử mẫu phục vụ đồ án thực hành kiểm thử phần mềm. Người dùng có thể tìm và lọc sản phẩm, quản lý giỏ hàng trên giao diện, rồi gửi thông tin checkout. Cùng một hành trình được kiểm tra ở ba lớp: API, giao diện trình duyệt và tải hệ thống.

> Phạm vi học tập: kiểm thử hộp đen, phân vùng tương đương, phân tích giá trị biên, tự động hóa giao diện, kiểm thử tải, phân vị độ trễ và quality gate trong CI.

## Tổng quan sản phẩm

- Giao diện tiếng Việt, responsive, có tìm kiếm, lọc danh mục, sắp xếp giá/đánh giá, trạng thái rỗng và giỏ hàng có số lượng/tạm tính.
- API Express cung cấp tìm kiếm/lọc sản phẩm, giỏ hàng có trạng thái, tồn kho mẫu, checkout và vòng đời đơn hàng; dữ liệu đầu vào được kiểm tra kiểu, độ dài và miền giá trị.
- Bộ Postman mô tả ca API tích cực, tiêu cực và biến môi trường.
- Bộ kiểm thử hợp đồng API dùng Node.js test runner, bao phủ 26 trường hợp về danh mục, giỏ hàng, checkout, đơn hàng và lỗi request.
- Selenium tự động hóa hành trình mua hàng bằng explicit wait.
- k6 tạo tải tăng dần tới 50 virtual users, xác minh API và áp dụng ngưỡng p95/tỷ lệ lỗi.
- GitHub Actions chạy API tests, ứng dụng, Selenium và k6; workflow lưu báo cáo HTML/JSON làm artifact.
- [Mở báo cáo hiệu năng mẫu](summary.html) để đọc snapshot của lần chạy ngày 14/10/2026; chạy k6 để tạo báo cáo mới.

## Bố cục dự án

~~~text
app/
  index.html                 Cửa hàng và hành trình mua hàng
  server.js                  API Express và quy tắc kiểm tra dữ liệu
  package.json               Phụ thuộc và lệnh chạy Node.js
  package-lock.json          Phiên bản phụ thuộc được khóa
tests/
  api_contract_test.js       26 kiểm thử hợp đồng API bằng node:test
  selenium_smoke_test.py     Tự động hóa giao diện bằng Selenium
  k6_load_test.js            Workload, checks, thresholds và xuất báo cáo
postman/
  collections/               Bộ ca kiểm thử API
  environments/              Cấu hình môi trường
.github/workflows/
  performance-ci.yml         Pipeline CI và quality gate
docker-compose.yml           Khởi chạy ứng dụng bằng Docker
reports/
  Bao_Cao_TechStore_HoanThien.docx  Báo cáo đồ án
summary.html                 Báo cáo kết quả mẫu dạng HTML
~~~

## Kiến thức kiểm thử được áp dụng

### 1. Kiểm thử hộp đen và thiết kế dữ liệu

Ca kiểm thử tập trung vào đầu vào và đầu ra có thể quan sát được của API, không phụ thuộc cách Express triển khai bên trong. Các kỹ thuật chính là phân vùng tương đương và phân tích giá trị biên. Bộ kiểm thử API chạy độc lập, tự mở một máy chủ tạm thời trên cổng ngẫu nhiên.

| Quy tắc | Giá trị đại diện | Kết quả mong đợi |
|---|---|---|
| Tên khách hàng hợp lệ | Chuỗi 2–100 ký tự | Checkout trả HTTP 201 và mã đơn ORD_… |
| Tên thiếu hoặc dưới biên | Chuỗi rỗng, 1 ký tự | HTTP 400 |
| Tên vượt biên | 101 ký tự | HTTP 400 |
| Địa chỉ hợp lệ | Chuỗi không rỗng, tối đa 250 ký tự | Checkout trả HTTP 201 |
| Địa chỉ không hợp lệ | Chuỗi rỗng hoặc 251 ký tự | HTTP 400 |
| Số lượng giỏ hợp lệ | Số nguyên từ 1 đến 10 | HTTP 200 |
| Biên số lượng | 0, 1, 10, 11; số thập phân; chuỗi | Chỉ 1 và 10 hợp lệ |
| Định danh không hợp lệ | ID sản phẩm không tồn tại hoặc cartId sai | HTTP 400 |

Các giá trị 1 và 10 kiểm tra ngay tại biên hợp lệ; 0 và 11 kiểm tra ngay bên ngoài miền. Cách chọn này bao phủ quy tắc với ít ca hơn việc thử mọi giá trị.

### 2. Kiểm thử API với Postman

Bộ sưu tập mô tả các luồng GET sản phẩm, POST thêm giỏ, checkout thành công và checkout bị từ chối do tên không hợp lệ. Environment tách base URL khỏi dữ liệu ca kiểm thử để có thể đổi máy chủ mà không phải sửa từng request. Khi chạy cả bộ theo thứ tự, chạy TC_API_02, TC_API_04 rồi TC_API_03 để dùng cùng một giỏ trước khi checkout.

Các ca âm kiểm tra mã HTTP và nội dung lỗi. Các ca dương xác nhận dữ liệu phản hồi, ví dụ danh sách sản phẩm, cartId và mã đơn hàng. Có thể mở các request trong thư mục postman và gửi tới ứng dụng đang chạy ở localhost:3000.

### 3. Tự động hóa giao diện bằng Selenium

Selenium kiểm tra các điểm quan trọng của hành trình mua hàng:

1. Mở trang chủ và xác nhận nội dung chào mừng.
2. Chờ API trả danh sách sáu sản phẩm.
3. Lọc danh mục Âm thanh rồi đặt lại bộ lọc.
4. Xác nhận checkout bị chặn khi giỏ hàng trống.
5. Thêm sản phẩm và quan sát số lượng giỏ cập nhật.
6. Checkout hợp lệ, nhận mã đơn và xác nhận giỏ được xóa.

Explicit wait đồng bộ với điều kiện hiển thị và trạng thái giao diện thay vì chờ cố định. Điều này làm test bền hơn khi tốc độ phản hồi thay đổi.

### 4. Kiểm thử tải bằng k6

Mỗi iteration gọi lần lượt GET sản phẩm, POST thêm giỏ và POST checkout; mỗi VU dùng một cartId riêng để tránh tranh chấp trạng thái. Workload tăng tới 20 VU trong 10 giây, tăng tới 50 VU trong 10 giây, giữ 50 VU trong 20 giây rồi giảm về 0 trong 10 giây.

Hai ngưỡng hiện tại:

- Thời gian request ở phân vị p95 nhỏ hơn 500 ms.
- Tỷ lệ request lỗi nhỏ hơn 5%.

p95 cho biết 95% request hoàn tất không chậm hơn mức đó; đây là cách đọc độ trễ đuôi, thay vì chỉ dựa vào trung bình. Tỷ lệ lỗi tổng hợp giúp đặt quality gate, nhưng không thay thế assertion cho từng luồng nghiệp vụ. Vì vậy cần xem cả bảng checks theo endpoint.

### 5. CI/CD và quality gate

Workflow trên GitHub Actions chạy khi push hoặc mở pull request vào main. Job chạy API tests, khởi chạy ứng dụng bằng Docker Compose, chờ health endpoint, chạy Selenium và k6, rồi tải summary.html cùng summary.json lên như artifact kể cả khi job thất bại. Đây là ví dụ về kiểm thử tự động trong pipeline và lưu bằng chứng để chẩn đoán.

## Đọc kết quả mẫu

Báo cáo HTML được lưu là snapshot ngày 14/10/2026, trước khi hợp nhất API giỏ hàng có trạng thái. Ở lần chạy đó, p95 là 154,63 ms và không ngưỡng nào bị vi phạm. Có 3 request checkout lỗi trong 1.257 request tổng (0,24%); bảng checks ghi nhận 416 checkout đạt và 3 checkout lỗi. Đây là kết quả lịch sử; chạy k6 để tạo báo cáo cho mã nguồn hiện tại.

Điểm cần trình bày khi bảo vệ đồ án: pipeline đạt ngưỡng tải hiện tại không đồng nghĩa mọi giao dịch nghiệp vụ đều ổn định. Tỷ lệ lỗi 0,24% thấp hơn giới hạn cho phép 5%, nên quality gate tổng hợp vẫn đạt dù checkout có lỗi. Bước tiếp theo hợp lý là xem log/API ở các lần lỗi và cân nhắc ngưỡng riêng cho checkout. Báo cáo cho biết hiện tượng, không đủ dữ liệu để kết luận nguyên nhân.

## Chạy cục bộ

Yêu cầu: Node.js 20+, Docker Compose, Python 3.10+, Chrome/Chromium và các gói Selenium cho kiểm thử giao diện; k6 cho kiểm thử tải.

~~~powershell
# Chạy bộ kiểm thử hợp đồng API
npm --prefix app ci
npm --prefix app test

# Khởi chạy ứng dụng
docker compose up --build -d

# Cài thư viện và chạy Selenium
python -m pip install selenium webdriver-manager
python tests/selenium_smoke_test.py

# Chạy tải và tạo/cập nhật báo cáo HTML cùng JSON
k6 run tests/k6_load_test.js

# Dừng ứng dụng
docker compose down
~~~

Mặc định ứng dụng ở http://localhost:3000; endpoint health là /api/health. Có thể đặt APP_URL trước khi chạy Selenium hoặc BASE_URL trước khi chạy k6 để trỏ sang môi trường khác.

## Phạm vi và giới hạn

Đây là ứng dụng mẫu: danh mục, tồn kho, giỏ hàng và đơn hàng nằm trong bộ nhớ, nên sẽ được đặt lại khi khởi động lại server. Mỗi phiên tab có cartId riêng; API client không gửi cartId dùng giỏ mặc định CART_ACTIVE. Checkout tạo đơn mẫu nhưng không ghi vào cơ sở dữ liệu và chưa kết nối đăng nhập, cổng thanh toán hay vận chuyển. Do đó, kết quả tải phục vụ học tập và so sánh giữa các lần chạy, không đại diện cho production.
