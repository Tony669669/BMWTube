# Rà soát BMWTube — 04/10/2026

## Phạm vi

Đã đọc toàn bộ mã ứng dụng (`dist/index.html`, `style.css`, `app.js`, `core.js`, `privacy.html`), máy chủ preview, cấu hình npm, workflow Pages và tài liệu. Kiểm tra trình duyệt chạy trong profile Chrome headless riêng; mọi kết nối Google/YouTube được thay bằng dữ liệu giả, không dùng tài khoản hoặc API key thật.

## Lỗi đã sửa

- Fullscreen ở màn hẹp bị lấy chiều rộng làm flex-basis theo trục dọc: 390×844 chỉ tạo stage cao 390 px. Đã cố định trục bố cục fullscreen, kiểm tra chiều cao đủ viewport.
- Các màn không đủ chỗ cho danh sách bị ép sidebar về chiều rộng quá nhỏ. Tự chuyển danh sách xuống dưới khi không đủ chỗ, giữ bố cục trái/phải ở 1422×456.
- Liên kết YouTube trong fullscreen chỉ có opacity 0, vẫn có thể nhận chạm hoặc focus. Đã ẩn cả vùng thông tin khỏi tương tác.
- Lịch sử có ID không phải chuỗi làm `videoId` ném lỗi và ngừng khởi tạo app. Đã kiểm tra kiểu ID, key, Telex và các lựa chọn lưu trên thiết bị.
- Telex bỏ qua WebView không gửi `InputEvent.data`/`inputType`. Đã dùng phần văn bản vừa nối thêm, bảo toàn thao tác dán và IME composition.
- Gửi nhiều lần cùng truy vấn đang chờ tạo nhiều API request. Đã dùng chung request đang chạy theo khóa/endpoint/tham số; kết quả không được cache sau khi request hoàn tất.
- Vào player khi đang tải trang tiếp theo có thể để nút Xem thêm bị disabled sau khi quay lại. Đã khôi phục trạng thái phân trang và tiêu đề; phản hồi cũ không ghi đè view mới.
- Lỗi tải trang tiếp theo của search làm mất toàn bộ kết quả đang có. Đã giữ kết quả và cho thử tải lại.
- Mở link video trực tiếp từng tải Home rồi bỏ kết quả. Nay bỏ request Home không cần thiết; nút Back khôi phục Home nếu chưa có danh sách.
- Submit ô tìm kiếm trống, URL không hợp lệ hoặc lúc đang ghép ký tự từng đóng popup. Nay giữ popup và hiển thị lỗi trong dialog, không bị top layer che.
- Chạm padding popup từng đóng dialog như bấm nền ngoài. Nay chỉ đóng khi tọa độ nằm ngoài dialog.
- Thông báo lỗi có thể che nút fullscreen ở mép dưới. Đã chuyển thông báo lên phía trên.
- Kết thúc thao tác tua không phát change từng giữ trạng thái seeking. Đã xử lý pointerup/cancel; controls không tự làm mất focus bàn phím.

## Kiểm tra tự động

- `npm test`: 7/7 nhóm unit test đạt — Telex, URL/host validation, dữ liệu sai kiểu, thời gian, tính kích thước và mốc BMW 1422×456.
- `node --check dist/app.js`, `node --check server.mjs`: đạt.
- `git diff --check`: đạt.
- `npm run test:browser`: dùng Playwright đã cài ngoài project. Có thể đặt `PLAYWRIGHT_MODULE` thành đường dẫn module Playwright và `CHROME_PATH` thành executable Chrome. Không cần thêm dependency để chạy site.
- Bộ browser regression gồm 8 kịch bản: trái/phải và lưu cài đặt; fullscreen ở chiều rộng 320/390/844/1422; Telex/IME/paste; dữ liệu lưu hỏng; chống request search trùng; phân trang khi chuyển view và lỗi mạng; thứ tự phản hồi search; nút phát/tạm dừng/tua/CC và liên kết m.youtube.com.

## Giới hạn xác nhận

- Player/API trong bộ browser regression là giả lập: kiểm tra hành vi BMWTube, không chứng minh playback, phụ đề hoặc Premium thật trên APTV.
- Người dùng đã xác nhận m.youtube.com trên APTV nhận tài khoản Premium và phát được video. Chưa xác nhận player nhúng dùng cùng phiên.
- Viewport BMW 1422×456 CSS px, DPR 3 lấy từ ảnh người dùng cung cấp. Kiểm tra desktop không thay thế bàn phím, touch và WebView thực trên xe.
- CC dùng các hàm module mà YouTube không cam kết trong API công khai; có feature detection, nhưng vẫn cần thử trên APTV.
- GitHub Actions mặc định chạy unit tests trước khi triển khai. Browser regression là lệnh riêng, chưa đưa vào workflow.

## Sao lưu GitHub — 06/11/2026

- `npm test`: 15/15 đạt, gồm 8 kiểm thử mới cho schema sao lưu, tiếng Việt, loại khóa truy cập, khôi phục/hoàn tác, rollback khi hết bộ nhớ, đọc công khai, tạo nhánh và xung đột SHA.
- `npm run test:backup-browser`: 4 nhóm đạt với GitHub giả lập: khôi phục/hoàn tác ở 390×844 và 1422×456; lưu lần đầu, thay bản khi xung đột, nhớ/quên token và giữ API key; dữ liệu sai phiên bản và token lỗi. Đã xem ảnh giao diện ở cả hai kích thước.
- `node --check` cho app và các module sao lưu, `git diff --check`: đạt.
- `npm run test:browser` cũ dừng ở kiểm tra vị trí player `3 != 0` tại `tests/browser.mjs:53`. Chạy cùng bộ kiểm thử trên bản HEAD trước thay đổi, được trích riêng vào `/tmp`, cho đúng lỗi đó. Đây là lỗi có sẵn của kiểm thử/bố cục, không phải bằng chứng hồi quy do sao lưu.
- Không dùng token thật, không ghi bản sao lên GitHub và chưa triển khai website. Safari iPhone/APTV/CarPlay cần kiểm thử trên thiết bị thực; viewport Chrome không thay thế kiểm thử đó.

## Tìm bằng giọng nói — 13/11/2026

- `npm test`: 20/20 đạt, gồm nhận kết quả cuối, bỏ qua kết quả tạm/cũ, hủy, lỗi quyền/mạng/micro, thiếu hỗ trợ và thử lại.
- `npm run test:voice-browser`: đạt ở 390×844 và 1422×456 với Chrome và SpeechRecognition/YouTube API giả lập. Kiểm tra nút tròn 72px dưới ô nhập, tự tìm tiếng Việt, mở từ thanh điều hướng, Escape và lỗi quyền. Đã xem ảnh cả hai kích thước. Dùng `PLAYWRIGHT_MODULE` và `CHROME_PATH` như bộ kiểm tra trình duyệt hiện có.
- `node --check dist/app.js`, `node --check dist/voice-search.js`, `git diff --check`: đạt.
- Chưa xác minh giọng nói/micro thật trên APTV hoặc triển khai website.

### Tinh gọn giao diện micro

- Bỏ tiêu đề, nhãn và hướng dẫn trong popup; bỏ micro trên cả hai thanh điều hướng.
- Đổi phiên bản CSS/JS để tránh dùng CSS cũ.
- 20/20 unit test đạt; browser voice test đạt tại 390×844 và 1422×456, gồm kiểm tra nút tròn 72px căn giữa, nét SVG trắng, loại bỏ thành phần cũ và giữ luồng tìm/hủy/báo lỗi. Đã xem ảnh cả hai kích thước.

### Hiệu ứng trạng thái micro

- Viền xoay khi đang mở micro; chỉ chuyển xanh, phát hai vòng sóng và nhịp SVG sau sự kiện recognition start. Dừng/hủy/lỗi/hết giờ đưa về trạng thái nghỉ, bỏ qua start trễ của phiên cũ. Giữ nguyên thời điểm tự tìm và giới hạn 15 giây.
- `npm test`: 22/22 đạt, có kiểm thử start trễ và timeout. Browser test đạt ở 390×844 và 1422×456, xác minh trạng thái chờ/nghe/dừng, màu và animation, chế độ giảm chuyển động. Đã xem ảnh cả hai kích thước. Kiểm tra dùng nhận giọng nói giả lập; thiết bị APTV cần thử micro thật.

### Micro vàng 86px và mở tìm kiếm tức thì

- Nút micro 86×86px ở mọi trạng thái, SVG 38px; đang nghe dùng vàng hổ phách, nét icon tối và vòng sóng vàng. Bảng tìm kiếm và backdrop không có animation/transition khi mở; các dialog khác giữ hiệu ứng.
- 22/22 unit test đạt. Browser test đạt ở 390×844 và 1422×456, kiểm tra kích thước, màu, focus ô nhập, không có animation mở và hiệu ứng micro/giảm chuyển động. Đã xem ảnh cả hai kích thước.

### Giữ cố định đáy bảng khi bật micro

- Chừa vùng trạng thái cao 42px (hai dòng) ngay khi mở bảng. Nội dung dài cuộn trong vùng này.
- 22/22 unit test đạt. Browser test đạt ở 390×844 và 1422×456; so sánh toàn bộ kích thước/vị trí bảng và micro ở trạng thái nghỉ, mở, nghe, dừng, lỗi và thông báo dài. Xác minh vùng thông báo dài có cuộn; đã xem ảnh BMW.
