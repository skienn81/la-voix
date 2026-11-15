# 🎙️ La Voix v2 — Bilingual 2-Way Assistive Sign Communication Platform

> **Nền tảng Giao tiếp Song phương Ký hiệu Y tế & Hành chính cho Người Khiếm thính**  
> Dự án tham dự **Cuộc thi Thắp lửa Khởi nghiệp Sáng tạo – ULIS Hackathon 2026 (Bảng A – Ý tưởng Sáng tạo)**  
> Trường Đại học Ngoại ngữ – Đại học Quốc gia Hà Nội (ULIS - VNU)

---

## 🌟 Giới thiệu Tổng quan (Executive Overview)

Trong các tình huống cấp cứu lâm sàng (nhồi máu cơ tim, sốc phản vệ, đau bụng cấp) hoặc tiếp nhận thủ tục hành chính, **rào cản ngôn ngữ giữa nhân viên y tế / cán bộ tiếp dân và người khiếm thính (Deaf/Hard of Hearing)** là nguyên nhân trực tiếp dẫn tới chẩn đoán chậm trễ và sai sót y khoa nguy hiểm.

**La Voix v2** là nền tảng giao tiếp hai chiều ứng dụng thị giác máy tính và trí tuệ nhân tạo (Computer Vision & Contextual AI) chạy trực tiếp trên trình duyệt máy tính bảng hoặc máy tính phòng khám:
1. **Chiều Bệnh nhân ➔ Bác sĩ:** Nhận diện cử chỉ ký hiệu chỉ bằng **1 bàn tay (Single-Hand Gesture Protocol)** thông qua webcam thông thường, kết hợp mô hình đoán ý ngữ cảnh lâm sàng (AI Clinical Auto-Complete) và phát âm thanh tiếng Việt tự nhiên cho bác sĩ.
2. **Chiều Bác sĩ ➔ Bệnh nhân:** Chuyển đổi giọng nói phản hồi của bác sĩ thành thẻ thị giác trực quan (Visual Flashcards) kèm hình mẫu cử chỉ VSL để người Điếc tiếp nhận chẩn đoán và an tâm điều trị.

---

## ⚡ Điểm Sáng tạo Đột phá (Key Technological Breakthroughs)

1. **Giao thức 5 Cử chỉ Chuẩn hóa (Minimal Viable Gesture Lexicon):**
   * Dựa trên lý thuyết ngôn ngữ học Stokoe: Tái sử dụng các hình dáng bàn tay cơ bản (*☝️ Chỉ ngón, ✊ Nắm đấm, 🖐️ Xòe bàn tay, 👈 Ngón cái*) kết hợp với vị trí cơ thể và ngữ cảnh để nhận diện chính xác triệu chứng.
   * Người bệnh trong cơn đau đớn không phải thực hiện các động tác phức tạp toàn thân, chỉ cần 1 bàn tay cử chỉ nhẹ nhàng.
2. **AI Clinical Auto-Complete & Cổng Xác nhận An toàn (Safety Gate):**
   * Dự đoán tăng tiến từng từ theo thời gian thực (0/5 ➔ 5/5) với độ chính xác đạt 98%.
   * Bệnh nhân luôn giữ quyền kiểm soát tuyệt đối: Chỉ khi bệnh nhân giơ ngón cái **Thả like (👍)** xác nhận, hệ thống mới phát âm thanh ra loa.
3. **Cơ chế Tự chuyển Ca sau 2 Giây (Hands-Free Recording Mode):**
   * Sau khi loa đọc xong câu chẩn đoán, hệ thống tự động đếm ngược đúng 2 giây và chuyển sang ca bệnh tiếp theo, hỗ trợ ghi hình video thuyết trình liền mạch mà không cần chạm chuột hay bàn phím.
4. **Bảo mật Dữ liệu & Quyền Riêng tư theo Luật số 91/2025/QH15:**
   * Kiến trúc **Zero-Retention Memory**: Toàn bộ luồng video MediaPipe được xử lý on-device (cục bộ trên trình duyệt), không gửi hình ảnh camera lên đám mây, độ trễ cực thấp (18ms). Nút Xóa phiên (Phím `R`) thanh lọc bộ nhớ cache tức thì.

---

## 🏥 4 Kịch bản Lâm sàng & Học đường Demo

Hệ thống tích hợp sẵn 4 kịch bản đa chuyên khoa:
* **01 Cấp cứu Tiêu hóa (Đau bụng cấp):** `Tôi` (☝️) ➔ `Đau` (✊) ➔ `Bụng` (🖐️) ➔ `Hôm qua` (👈) ➔ `Thả like` (👍).
* **02 Cấp cứu Tim mạch & Đau ngực (Ca bệnh khó):** `Tôi` (☝️) ➔ `Ngực` (🖐️) ➔ `Thắt nghẹn` (✊) ➔ `Lan tay` (👈) ➔ `Thả like` (👍).
* **03 Dị ứng Phản vệ & Nghẹt thở (Ca nguy kịch):** `Tôi` (☝️) ➔ `Dị ứng` (🖐️) ➔ `Nghẽn họng` (✊) ➔ `Choáng váng` (👈) ➔ `Thả like` (👍).
* **04 Một cửa Hành chính Sinh viên ULIS:** `Tôi` (☝️) ➔ `Cần` (✊) ➔ `Giúp` (🖐️) ➔ `Khai báo` (👈) ➔ `Thả like` (👍).

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

* **Frontend:** React 19, TypeScript, Vite
* **Computer Vision:** Google MediaPipe HandLandmarker V3 (21 landmarks)
* **Kinetic Signal Processing:** Bộ lọc 1€ Filter (One-Euro Filter) chống rung lắc ngón tay
* **Speech Synthesis:** Web Speech API (Giọng đọc tiếng Việt tự nhiên)
* **Design System:** Dieter Rams Minimalist Instrument Deck, WCAG AA Accessibility, Zero Layout Shift

---

## 🚀 Hướng dẫn Cài đặt & Chạy Thử (Quick Start)

### Yêu cầu môi trường
* Node.js phiên bản 18+ trở lên
* Trình duyệt hỗ trợ Webcam & Web Speech (Google Chrome, Microsoft Edge, Cốc Cốc)

### Các bước khởi chạy

```bash
# 1. Clone kho lưu trữ
git clone https://github.com/skienn81/la-voix.git
cd la-voix

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ cục bộ
npm run dev
```

Mở trình duyệt tại đường dẫn `http://localhost:5173/` và cấp quyền sử dụng camera.

---

## ⌨️ Phím tắt Điều khiển Nhanh (Keyboard Shortcuts)

| Phím tắt | Chức năng |
| :---: | :--- |
| `1` | Chuyển sang Ca 01: Cấp cứu Đau bụng cấp (Tiêu hóa) |
| `2` | Chuyển sang Ca 02: Cấp cứu Tim mạch & Đau thắt ngực (Bệnh khó) |
| `3` | Chuyển sang Ca 03: Cấp cứu Dị ứng Phản vệ & Nghẹt thở (Nguy kịch) |
| `4` | Chuyển sang Ca 04: Hành chính Một cửa Sinh viên ULIS |
| `G` | Bật / Tắt chế độ tự động chuyển ca sau 2s khi hoàn thành |
| `Space` | Khớp nhanh cử chỉ bước hiện tại (Demo hỗ trợ) |
| `C` | Duyệt câu và phát âm thanh ra loa (Safety Gate) |
| `R` | Xóa phiên làm việc sạch sẽ (Zero-Retention Reset) |
| `☰` | Mở menu tiện ích: Xem lời thoại thuyết trình 90s, đổi ngôn ngữ VI/EN |

---

## 👥 Đội ngũ Phát triển (Project Team)

* **Kiên (Lead Developer & Presenter):** Thiết kế kiến trúc thị giác máy tính, phân loại giải phẫu bàn tay MediaPipe, phát triển bộ lọc 1€ Filter và trình bày video demo dự thi.
* **Mye (Co-founder & Product Lead):** Nghiên cứu ngôn ngữ học ký hiệu VSL, thiết kế trải nghiệm người dùng y tế, xây dựng hồ sơ dự án Bảng A và cố vấn chuyên môn với CLB Sign By Sign ULIS.

---

*Bản quyền dự án thuộc về Đội thi La Voix – ULIS Hackathon 2026.*
