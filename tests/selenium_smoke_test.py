"""Selenium smoke checks for the TechStore shopping journey."""
import os

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


def run_comprehensive_ui_tests():
    print("[SELENIUM] Khởi chạy Chrome Headless Browser...")
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,1000")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    wait = WebDriverWait(driver, 10)
    try:
        driver.get(os.getenv("APP_URL", "http://localhost:3000"))

        title = wait.until(EC.visibility_of_element_located((By.ID, "welcome-title")))
        assert "Nâng tầm" in title.text
        print("✓ TC_UI_01 [PASSED]: Trang chủ hiển thị nội dung chào mừng.")

        products = wait.until(
            lambda browser: browser.find_elements(By.CLASS_NAME, "product-card")
            if len(browser.find_elements(By.CLASS_NAME, "product-card")) == 6 else False
        )
        assert len(products) == 6
        assert driver.find_element(By.ID, "product-list").get_attribute("aria-busy") == "false"
        print(f"✓ TC_UI_02 [PASSED]: API tải và hiển thị {len(products)} sản phẩm.")

        # TC_UI_03: Kiểm thử bộ lọc danh mục
        filter_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '.filter[data-filter="Âm thanh"]')))
        filter_btn.click()
        
        wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Sony')]")))
        assert "Sony" in driver.find_element(By.CLASS_NAME, "product-title").text
        
        driver.find_element(By.CSS_SELECTOR, '.filter[data-filter="all"]').click()
        wait.until(lambda browser: len(browser.find_elements(By.CLASS_NAME, "product-card")) == 6)
        print("✓ TC_UI_03 [PASSED]: Bộ lọc danh mục hoạt động và có thể đặt lại.")

        name_input = driver.find_element(By.ID, "customer-name")
        address_input = driver.find_element(By.ID, "customer-address")
        name_input.send_keys("Nguyen Van A")
        address_input.send_keys("123 Duong Le Loi, Ha Noi")
        
        # Click checkout lần 1 (Giỏ hàng trống)
        btn_checkout_1 = wait.until(EC.element_to_be_clickable((By.ID, "btn-checkout")))
        driver.execute_script("arguments[0].scrollIntoView(true);", btn_checkout_1)
        driver.execute_script("arguments[0].click();", btn_checkout_1)

        empty_cart_alert = wait.until(EC.visibility_of_element_located((By.ID, "checkout-alert")))
        assert "đang trống" in empty_cart_alert.text
        print("✓ TC_UI_04 [PASSED]: Chặn thanh toán khi giỏ hàng trống.")

        name_input.clear()
        address_input.clear()
        
        # Thêm sản phẩm vào giỏ hàng bằng JS Click chống bị che khuất
        add_btn = wait.until(EC.element_to_be_clickable((By.CLASS_NAME, "add-btn")))
        driver.execute_script("arguments[0].scrollIntoView(true);", add_btn)
        driver.execute_script("arguments[0].click();", add_btn)
        
        wait.until(lambda browser: browser.find_element(By.ID, "cart-count").text == "1")
        print("✓ TC_UI_05 [PASSED]: Thêm giỏ hàng và cập nhật số lượng.")

        name_input.send_keys("Nguyen Van A")
        address_input.send_keys("123 Duong Le Loi, Ha Noi")
        
        # Click checkout lần 2 (Thanh toán thành công)
        btn_checkout_2 = wait.until(EC.element_to_be_clickable((By.ID, "btn-checkout")))
        driver.execute_script("arguments[0].scrollIntoView(true);", btn_checkout_2)
        driver.execute_script("arguments[0].click();", btn_checkout_2)

        success = wait.until(EC.visibility_of_element_located((By.ID, "checkout-alert")))
        wait.until(lambda browser: "Đặt hàng thành công!" in browser.find_element(By.ID, "checkout-alert").text)
        assert "Mã đơn hàng: ORD_" in success.text
        assert driver.find_element(By.ID, "cart-count").text == "0"
        print("✓ TC_UI_06 [PASSED]: Thanh toán hợp lệ, sinh mã đơn và xóa giỏ hàng.")

        print("\n[FULL TEST SUITE PASSED] Tất cả 6 ca kiểm thử giao diện đạt.")
    except Exception as error:
        print(f"\n[TEST FAILED] Lỗi kiểm thử UI: {error}")
        raise
    finally:
        driver.quit()


if __name__ == "__main__":
    run_comprehensive_ui_tests()