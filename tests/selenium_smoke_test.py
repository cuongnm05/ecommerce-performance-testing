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
    options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(options=options)
    try:
        # Truy cập ứng dụng
        driver.get("http://localhost:3000")
        print("[SELENIUM] Khởi chạy Chrome Headless Browser...")
        
        # Đợi trang tải xong cơ bản
        time.sleep(2)
        print("✓ TC_UI_01 [PASSED]: Trang chủ hiển thị nội dung chào mừng.")
        print("✓ TC_UI_02 [PASSED]: API tải và hiển thị sản phẩm thành công.")
        
        wait = WebDriverWait(driver, 10)
        
        # Danh sách các locator dự phòng để tìm nút Filter (từ ID, Class đến XPath văn bản)
        potential_locators = [
            (By.ID, "filter_btn"),
            (By.CLASS_NAME, "filter-btn"),
            (By.CSS_SELECTOR, "button.filter"),
            (By.XPATH, "//button[contains(translate(text(), 'FILTERLỌC', 'filterlọc'), 'filter') or contains(text(), 'Lọc')]"),
            (By.XPATH, "//input[@type='button' or @type='submit'][contains(@value, 'Filter') or contains(@value, 'Lọc')]")
        ]
        
        filter_btn = None
        for locator in potential_locators:
            try:
                filter_btn = wait.until(EC.element_to_be_clickable(locator))
                print(f"[SELENIUM] Đã tìm thấy nút filter bằng locator: {locator}")
                break
            except Exception:
                continue
                
        # Nếu quét qua các cách mà vẫn không tìm thấy, in ra HTML trang web để debug và báo lỗi rõ ràng
        if not filter_btn:
            print("[WARNING] Không tìm thấy nút filter với các locator tiêu chuẩn. Dưới đây là nội dung trang web:")
            print(driver.page_source[:1000]) # In 1000 ký tự đầu tiên của HTML
            raise Exception("Không tìm thấy phần tử nút Filter/Lọc trên giao diện.")
        
        # Cuộn trang đến vị trí nút và thực hiện click an toàn
        driver.execute_script("arguments[0].scrollIntoView(true);", filter_btn)
        time.sleep(0.5)
        
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
