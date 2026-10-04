# Kiểm tra BMWTube — 04/10/2026

## Giao diện player/điều hướng mới

Đã chuyển header thành cột icon riêng, thêm popup tìm kiếm và chọn bên player trong Cài đặt; danh sách và rail đổi bên theo lựa chọn. Player dùng chiều cao viewport, thumbnail danh sách cạnh player giảm còn khoảng một nửa, thông báo tự phát bị chặn đã bỏ. Chưa xác minh bản giao diện này trên APTV sau khi cập nhật.

Người dùng đã xác nhận trực tiếp trên APTV: m.youtube.com nhận đúng tài khoản Premium và phát video được. Chưa đối chiếu cùng video giữa m.youtube.com và player nhúng BMWTube.

## Cập nhật chế độ công khai

Ở bản trước đã kiểm tra Home public, thiết lập API key và lối mở YouTube khi chưa có key. Home/search bằng API thực vẫn chưa được xác minh do chưa có key. Tìm kiếm không khóa mở YouTube Search trực tiếp. Giao diện mới dùng cột điều hướng dọc và popup tìm kiếm.

## Đã chạy

- `npm test`: 5/5 nhóm kiểm tra đạt; Telex nhiều âm tiết, dấu/case, URL được giữ nguyên, host giả và URL không hợp lệ bị loại, thời gian, giới hạn kích thước player.
- `node --check dist/app.js`, `node --check dist/core.js`, `node --check server.mjs`: kiểm tra cú pháp.
- Trình duyệt thực trong Codex, viewport 1280×480: gõ tuần tự `tieengs Vieejt` hiển thị `tiếng Việt`.
- Tìm kiếm không có key hiển thị lối mở truy vấn YouTube đúng Unicode và nút Cài đặt.
- Phát video mẫu chính thức của YouTube Developers `M7lc1UVf-VE`: player tải, phát nội dung thật, thời gian tiến và cập nhật tiêu đề. Kiểm tra pause và tua qua slider.
- Mở rộng trong trang: header/sidebar ẩn, video giữ 16:9 ở x=0, phần bên phải đen, có nút thoát. Fullscreen API bị trình duyệt xem trước trả về khỏi fullscreen nên đã bỏ phụ thuộc vào API đó.
- Khi mở rộng ở viewport 1280×480, video đo được 853.33×480 CSS px từ góc trên trái. Sau 3.4 giây, thanh tua/nút có opacity 0 và visibility hidden; một lần chạm lớp đánh thức làm thanh hiện lại.
- 1920×720: player x=0, y=88, kích thước 888.88×499.99, không tràn ngang.
- Dialog cài đặt có key, vị trí player, liên kết m.youtube.com, thông tin viewport, xóa lịch sử và quyền riêng tư. Chưa kiểm tra lại dialog sau thay đổi giao diện mới.
- WebMCP: đăng ký `open_youtube_video`, URL hợp lệ mở cùng player và trả video ID; URL example.com bị từ chối, không điều hướng đến domain đó.

## Chưa xác minh

- Tìm kiếm/phân trang/API quota thực: chưa có YouTube Data API key của chủ project. Không dùng khóa của dự án khác.
- Player nhúng BMWTube nhận phiên Premium, bàn phím Telex và chạm kéo trên APTV sau bản giao diện mới: chưa kiểm tra.
- Mạng offline, video riêng tư/chặn embed và các mã lỗi khác có xử lý trong code, chưa tái tạo tất cả trong trình duyệt thật.
- GitHub Pages được triển khai theo commit; workflow Actions là nguồn xác nhận deploy.

Đây là bản MVP chạy được trên trình duyệt đã kiểm tra, không phải xác nhận đạt đủ đặc tả trên APTV/CarPlay.

## Bổ sung CC

Kiểm tra trực tiếp video M7lc1UVf-VE: bấm Tắt phụ đề làm nội dung phụ đề biến mất; bấm Bật phụ đề hiển thị lại câu thoại trong iframe. Nhãn và aria-pressed của nút chuyển tương ứng. Kiểm tra cú pháp app.js đạt. Chưa kiểm chứng trên APTV.
