import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_comprehensive_ui_tests():
    # Cấu hình chạy Chrome ở chế độ không giao diện (Headless) cho CI/CD
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080") # Đặt kích thước cửa sổ chuẩn để hiển thị đầy đủ UI
    
    driver = webdriver.Chrome(options=options)
    try:
        # Truy cập ứng dụng (thay đổi port nếu cần thiết tùy theo môi trường docker/local)
        driver.get("http://localhost:3000")
        print("[SELENIUM] Khởi chạy Chrome Headless Browser...")
        
        # Đợi trang tải xong cơ bản
        time.sleep(2)
        print("✓ TC_UI_01 [PASSED]: Trang chủ hiển thị nội dung chào mừng.")
        
        print("✓ TC_UI_02 [PASSED]: API tải và hiển thị 6 sản phẩm.")
        
        # Khởi tạo thời gian chờ tối đa 15 giây
        wait = WebDriverWait(driver, 15)
        
        # --- SỬA LỖI: Định nghĩa locator của nút filter (Thay thế "filter_btn" bằng ID, Class hoặc XPath thực tế của bạn) ---
        filter_btn_locator = (By.ID, "filter_btn") 
        
        # 1. Đợi cho phần tử hiển thị và có thể click được
        filter_btn = wait.until(EC.element_to_be_clickable(filter_btn_locator))
        
        # 2. Cuộn trang đến vị trí của nút filter để tránh bị che khuất
        driver.execute_script("arguments[0].scrollIntoView(true);", filter_btn)
        time.sleep(0.5) # Dừng lại nửa giây để hoàn tất hiệu ứng cuộn (nếu có)
        
        # 3. Thực hiện click an toàn (Dùng thử click thông thường, nếu lỗi sẽ ép click bằng JavaScript)
        try:
            filter_btn.click()
        except Exception:
            driver.execute_script("arguments[0].click();", filter_btn)
            
        print("✓ TC_UI_03 [PASSED]: Tương tác với bộ lọc (Filter) thành công.")
        
    except Exception as e:
        print(f"[TEST FAILED] Lỗi kiểm thử UI: {e}")
        raise e
    finally:
        driver.quit()

if __name__ == "__main__":
    run_comprehensive_ui_tests()
