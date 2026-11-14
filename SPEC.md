# CalmPlay — Kiến trúc MVP Cho Cuộc Thi ULIS Hackathon 2026 (Bảng B)

> Trạng thái: Đã chốt toàn bộ 8 nhánh thiết kế qua `/grill-me` (11/11/2026)  
> Mốc nộp hồ sơ Vòng Sơ khảo: `24:00` Chủ nhật `15/11/2026`  
> Vai trò nhóm: **Kiên** (Lead Dev, ULIS) phụ trách Web App, WebSocket Realtime & Triển khai Cloud. **Mye** (Co-founder dự kiến, ULIS — dự phòng ghép bạn ULIS khác nếu lệch hướng) phụ trách module Python `PySceneDetect`/`OpenCV`, hiệu chuẩn ngưỡng Brainrot và số liệu thực nghiệm 2 buổi tại gia đình.

---

## 1. Tóm tắt Sản phẩm & Điểm Khác Biệt Với YouTube Kids

**CalmPlay** là trình phát video an toàn đa thiết bị (Smart TV phòng khách + Tablet/Điện thoại) dành cho **trẻ 3-7 tuổi**, cho phép phụ huynh đang đi làm hoặc dạy học bên ngoài **hạ nhiệt và khóa TV êm ái từ xa qua 4G**, đồng thời tự động lọc bỏ nội dung **"Brainrot / AI Slop"** (video cắt cảnh liên tục 1-2 giây gây quá tải kích thích) bằng bộ phân tích kỹ thuật thị giác & âm thanh.

| Câu hỏi phản biện của BGK | YouTube Kids / Family Link | CalmPlay |
|---|---|---|
| Có chặn được video rác "AI slop / Brainrot" cắt cảnh loạn xạ? | Vẫn lọt nhiều vì hệ thống kiểm duyệt chủ yếu lọc từ ngữ thô tục/bạo lực, không chấm nhịp cắt cảnh. | Dùng thuật toán **`PySceneDetect` + `OpenCV` + biến động âm lượng RMS** chấm điểm *Overstimulation Score (0-100)*, chặn cứng mọi video nhịp kích thích cao. |
| Có tắt được Shorts trên TV và chặn đề xuất cuối video? | YouTube Kids **không có nút tắt Shorts trên Smart TV**. Cuối video vẫn hiện lưới đề xuất gây bấm lan man. | Giao diện 100% thẻ video dài dạng ngang, **0 Shorts, 0 thanh tìm kiếm**. Chắn lớp phủ chặn click vào logo YouTube và ngắt iframe trước khi lưới đề xuất bật lên. |
| Mẹ đang dạy học ngoài đường muốn tắt TV cho con thì sao? | Ngắt cứng bằng bộ đếm thời gian tại chỗ khiến trẻ dễ khóc ăn vạ, bắt nhập PIN trực tiếp lên TV (trẻ dễ nhìn lén). | **Quy trình Hạ Nhiệt 3 Nhịp Chống Sốc** điều khiển từ xa qua 4G: nhắc nhẹ ở góc màn -> chờ hết tập (tối đa 2.5 phút) -> chuyển sang 1 clip ru êm giảm sáng & giảm âm lượng -> khóa Màn hình Ngủ. |
| Điểm chạm DNA Ngoại ngữ (ULIS)? | Trộn lẫn tiếng Anh "Brainrot" cắt cảnh nhanh gây loạn chú ý. | Kho **Song ngữ chọn lọc**: tách riêng mục *Tiếng Anh nhịp chậm* (`cuts/min` thấp, phát âm rõ) và *Tiếng Việt êm*, mẹ bật/tắt mục ngoại ngữ bằng 1 nút gạt trên điện thoại. |

---

## 2. Quyết Định Kiến Trúc Đã Chốt (8 Nhánh)

1. **Thiết bị mục tiêu:** Chạy song song **Smart TV** (điều hướng D-pad bằng phím mũi tên + `Enter`, chữ/thẻ cỡ lớn đọc từ xa) và **Tablet/Điện thoại** (vùng chạm `>= 48x48px`). Không bắt trẻ đăng nhập tài khoản.
2. **Độ tuổi & Giao diện trẻ (`/tv`):** Dành cho bé **3-7 tuổi**. Chỉ hiện lưới thẻ hình ảnh trực quan và icon cảm xúc/chủ đề, ẩn thanh tìm kiếm và chữ dài dòng.
3. **Bộ lọc Brainrot 2 lớp:**
   - **Lớp 1 (Kho dựng sẵn chạy mượt trên Cloud):** Danh sách `25-30` tập video dài (Tiếng Việt + Tiếng Anh nhịp chậm) đã được module Python phân tích trước và lưu kèm toàn bộ chỉ số (`score`, `cuts_per_min`, `short_burst_ratio`, `audio_spikes`, `timeline`) trong `data/catalog.json`. Không phụ thuộc `yt-dlp` trực tiếp trên server cloud để tránh YouTube chặn IP `429/bot`.
   - **Lớp 2 (Tab `Bộ Soi Brainrot` `/inspector`):** Cho phép đối chiếu trực quan bảng so sánh video "Brainrot thực tế" với "Video nhịp êm". Khi chạy môi trường có Python + ffmpeg (máy nhóm quay demo hoặc server Docker), hỗ trợ upload file `.mp4` thật (`<= 50 MB`) để chạy `PySceneDetect` chấm điểm trực tiếp.
4. **Máy trạng thái Hạ Nhiệt 3 Nhịp (`/tv` <-> `/parent`):**
   - `ACTIVE`: Trẻ tự chọn thẻ video trong danh mục mẹ cho phép.
   - `WIND_DOWN_NOTICE`: Mẹ bấm **"Hạ nhiệt êm"** từ điện thoại -> góc TV hiện nhân vật nhắc nhẹ *"Sắp xong tập rồi, xem thêm 1 chuyện êm rồi nghỉ nhé"* -> chờ hết tập đang phát hoặc tối đa `150 giây`.
   - `CALM_FINAL`: Tự động chuyển sang `1` video kể chuyện/nhạc ru nhịp cực chậm (`Overstimulation Score <= 25`, `cuts/min < 5`). Kích hoạt lớp phủ ánh sáng ấm dịu mắt (`CSS warm tint`) và hạ âm lượng YouTube Player dần xuống.
   - `SLEEP_LOCKED`: Ngắt hoàn toàn YouTube IFrame (không lọt đề xuất), hiện Màn hình Ngủ. Chỉ mở lại bằng **PIN Phụ Huynh 4 số** trên TV hoặc nút mở khóa từ máy Mẹ.
   - Nút **Dừng Khẩn Cấp** riêng cho phép nhảy thẳng về `SLEEP_LOCKED` ngay lập tức.
5. **Nội dung Song ngữ ULIS:** Chia 3 nhóm rõ ràng trên TV: *Kể chuyện & Cổ tích Việt*, *Tiếng Anh nhịp chậm*, *Khoa học & Nhạc nhẹ*. Mẹ bật/tắt nhóm *Tiếng Anh* tức thì trên `/parent`. Khi vào bước `CALM_FINAL`, hệ thống ưu tiên pool ru êm Tiếng Việt.
6. **Hạ tầng triển khai:** Một codebase thống nhất gồm:
   - `server/` (`Node.js 24 + Express + ws`): Serve React build, quản lý phòng WebSocket xuyên mạng `4G <-> Wi-Fi` (không dùng WebRTC P2P vì dễ nghẽn CGNAT nhà mạng VN), đồng thời gọi script Python an toàn qua `execFile` nếu chạy cục bộ.
   - `client/` (`React + Vite`): 3 màn chính (`/tv`, `/parent`, `/inspector`).
   - `analyzer/` (`Python 3.12 + PySceneDetect + OpenCV + NumPy + ffmpeg`): Chấm điểm và tạo dữ liệu thực cho `data/catalog.json` + endpoint `.mp4`.
7. **Khóa app trung thực & Báo thoát:** Trình duyệt web **không thể khóa nút Home/YouTube trên phần cứng TV**. Giải pháp trung thực 2 tầng:
   - Tầng Web: Chặn click vào liên kết YouTube trong iframe, bật Fullscreen khi tương tác, khóa thoát Màn hình Ngủ bằng PIN 4 số, và **bắn cảnh báo tức thì về máy Mẹ qua WebSocket** ngay khi tab TV bị tắt, mất kết nối quá `10 giây` hoặc chuyển ẩn (`visibilitychange`).
   - Tầng OS (Hướng dẫn 1 bước trong `/parent`): Nhắc phụ huynh bật khóa gốc có sẵn như *Guided Access* (iPad/iPhone), *App Pinning* (Android Tablet) hoặc *Khóa PIN ứng dụng YouTube gốc* (Smart TV).
8. **Đội hình, Tên gọi & Thử nghiệm thực tế:** Tên sản phẩm **`CalmPlay`**. Mời **Mye** phụ trách module phân tích `PySceneDetect` + thu thập số liệu 2 buổi thử nghiệm thực tế cùng mẹ và em tại nhà trước `15/11` (thời gian trẻ buông TV, số lần phản kháng/khóc đòi xem tiếp so với cách tắt ngang cũ). Không thu thập dữ liệu khuôn mặt/sinh trắc học trẻ em (`Luật 91/2025/QH15`).

---

## 3. Công Thức Chấm Điểm Overstimulation (`0 - 100`)

Mỗi video (hoặc đoạn mẫu tối thiểu 60s) được chuẩn hóa từ 4 chỉ số vật lý đo được bởi `analyzer/score_video.py`:

1. **`cuts_per_min` (`40%` trọng số):** Số lần chuyển cảnh mỗi phút phát hiện qua `PySceneDetect` (`ContentDetector`), ngưỡng chuẩn hóa `0 -> 30+ cuts/min`.
2. **`short_burst_ratio` (`25%` trọng số):** Tỷ lệ cảnh cắt cực ngắn (`< 2.0 giây`) trên tổng số cảnh (đặc trưng gây nghiện của Brainrot/Cocomelon).
3. **`visual_jolt_index` (`20%` trọng số):** Độ biến thiên độ chói và màu sắc giữa các khung hình liên tiếp (`OpenCV` frame diff / HSV spike), bắt các đoạn nháy chớp liên tục ngay cả khi không đổi cảnh cứng.
4. **`audio_chaos_index` (`15%` trọng số):** Số lần âm lượng RMS (cửa sổ `250ms` từ `ffmpeg` mono WAV) tăng vọt đột ngột `> +9 dB` mỗi phút (tiếng hét, hiệu ứng "boing/boom" dồn dập).

**Ngưỡng phân loại:**
- `0 - 29`: **Nhịp Êm** (An toàn cho giờ hạ nhiệt / trước khi ngủ)
- `30 - 59`: **Nhịp Vừa** (Phù hợp giải trí & nghe Tiếng Anh ban ngày)
- `60 - 100`: **Kích Thích Cao / Rủi Ro Brainrot** (Tự động loại khỏi kho `/tv`, chỉ hiển thị làm đối chứng ở `/inspector`)

---

## 4. Ràng Buộc Bảo Mật & Ổn Định Kỹ Thuật

- **Ghép nối phòng an toàn:** TV tạo **Mã phòng 6 ký tự** (ví dụ `CP4829`, bỏ ký tự dễ nhầm `0/O/1/I`) kèm **PIN Phụ Huynh 4 số** do mẹ đặt (mặc định hiển thị lúc tạo phòng để dễ demo). Mọi lệnh thay đổi trạng thái từ `/parent` yêu cầu xác thực đúng mã phòng + token phiên/PIN.
- **Chống lỗi YouTube IFrame:** Mọi `youtubeId` trong `data/catalog.json` phải qua kiểm tra định dạng `/^[A-Za-z0-9_-]{11}$/` và kiểm chứng nhúng thật (`oEmbed` + trình duyệt headless) trước khi chốt kho. Bắt sự kiện `ENDED`, lỗi `101/150` và canh trước thời điểm kết thúc `1.5 giây` để chuyển trạng thái hoặc ẩn đề xuất.
- **Upload `.mp4` an toàn (`POST /api/analyze`):** Giới hạn kích thước `<= 50 MB`, kiểm tra magic bytes header file MP4/MOV/WebM, lưu tên UUID ngẫu nhiên, gọi Python bằng `execFile` (cấm nối chuỗi shell), giới hạn timeout `60 giây` và xóa file tạm trong khối `finally`.

---

## 5. Lộ Trình Thực Thi Tới 15/11/2026

- **Giai đoạn 1 (Chiều - Tối 11/11):** Xây dựng module Python `analyzer/` (`score_video.py`, kiểm tra gói `scenedetect`, `imageio-ffmpeg`), thu thập & chấm điểm thực `25-30` video Việt + Tiếng Anh nhịp chậm + clip Brainrot đối chứng vào `data/catalog.json`.
- **Giai đoạn 2 (12/11):** Hoàn thiện Backend `Node.js + Express + ws` (phòng đồng bộ 4G, API `/api/catalog`, `/api/analyze`, cảnh báo thoát app) và Frontend `React + Vite` cho 3 tuyến `/tv`, `/parent`, `/inspector`.
- **Giai đoạn 3 (13/11):** Kiểm thử tự động (WebSocket state machine, bảo mật upload, Playwright đa khung hình TV 1080p + Mobile 390px + IFrame playback thật), deploy bản Web public lên Cloud để test 4G ngoài đường <-> TV tại nhà.
- **Giai đoạn 4 (14/11 - Sáng 15/11):** Test thực tế 2 buổi với mẹ và em tại nhà, ghi nhận số liệu, quay clip demo `2-3 phút`, cập nhật bản đặc tả Word tối đa 2 trang và nộp form trước `24:00 15/11/2026`.
