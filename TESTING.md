# Kiểm tra BMWTube — 04/10/2026

## Cập nhật chế độ công khai

Đã kiểm tra cú pháp và tải lại Home trong trình duyệt: bỏ mục đăng nhập, hiển thị thiết lập API key và lối mở YouTube khi chưa có khóa. Home/search bằng API thực vẫn chưa được xác minh do chưa có key. Tìm kiếm không khóa hiện mở YouTube Search trực tiếp, thay cho màn xác nhận ở phiên bản trước.

## Đã chạy

- `npm test`: 5/5 nhóm kiểm tra đạt; Telex nhiều âm tiết, dấu/case, URL được giữ nguyên, host giả và URL không hợp lệ bị loại, thời gian, giới hạn kích thước player.
- `node --check dist/app.js`, `node --check dist/core.js`, `node --check server.mjs`: kiểm tra cú pháp.
- Trình duyệt thực trong Codex, viewport 1280×480: gõ tuần tự `tieengs Vieejt` hiển thị `tiếng Việt`.
- Tìm kiếm không có key hiển thị lối mở truy vấn YouTube đúng Unicode và nút Cài đặt.
- Phát video mẫu chính thức của YouTube Developers `M7lc1UVf-VE`: player tải, phát nội dung thật, thời gian tiến và cập nhật tiêu đề. Kiểm tra pause và tua qua slider.
- Mở rộng trong trang: header/sidebar ẩn, video giữ 16:9 ở x=0, phần bên phải đen, có nút thoát. Fullscreen API bị trình duyệt xem trước trả về khỏi fullscreen nên đã bỏ phụ thuộc vào API đó.
- 1920×720: player x=0, y=88, kích thước 888.88×499.99, không tràn ngang.
- Dialog cài đặt mở, có key, liên kết đăng nhập YouTube, thông tin viewport, xóa lịch sử và quyền riêng tư.
- WebMCP: đăng ký `open_youtube_video`, URL hợp lệ mở cùng player và trả video ID; URL example.com bị từ chối, không điều hướng đến domain đó.

## Chưa xác minh

- Tìm kiếm/phân trang/API quota thực: chưa có YouTube Data API key của chủ project. Không dùng khóa của dự án khác.
- Đăng nhập/Premium trong iframe APTV, bàn phím và chạm kéo trên xe: chưa truy cập được thiết bị thực.
- Mạng offline, video riêng tư/chặn embed và các mã lỗi khác có xử lý trong code, chưa tái tạo tất cả trong trình duyệt thật.
- Chưa triển khai GitHub Pages; đã cung cấp workflow và hướng dẫn.

Đây là bản MVP chạy được trên trình duyệt đã kiểm tra, không phải xác nhận đạt đủ đặc tả trên APTV/CarPlay.

## Bổ sung CC

Kiểm tra trực tiếp video M7lc1UVf-VE: bấm Tắt phụ đề làm nội dung phụ đề biến mất; bấm Bật phụ đề hiển thị lại câu thoại trong iframe. Nhãn và aria-pressed của nút chuyển tương ứng. Kiểm tra cú pháp app.js đạt. Chưa kiểm chứng trên APTV.
