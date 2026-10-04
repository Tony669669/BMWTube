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
