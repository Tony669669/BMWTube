# BMWTube

**Chế độ công khai:** Home tải video công khai Việt Nam và tìm kiếm bằng YouTube Data API khi có API key. Đăng nhập Premium diễn ra trực tiếp trên m.youtube.com trong trình duyệt APTV; BMWTube không nhận hoặc lưu mật khẩu.

Ứng dụng web tĩnh cho trình duyệt **APTV trên iPhone → CarPlay → màn BMW G20 LCI**. Không giả định browser chạy trực tiếp trên iDrive. Không phụ thuộc framework hay backend.

## Chạy trên máy

Yêu cầu Node 22 trở lên. Không cần `npm install`.

```sh
cd /Applications/BMWTube
npm start
```

Mở http://localhost:4173. Localhost chỉ dùng trên máy này; để mở trong APTV cần URL HTTPS đã triển khai. Không mở `index.html` bằng `file://` vì module và YouTube origin cần HTTP(S).

## Chức năng

- Dán link YouTube hoặc video ID để phát bằng IFrame Player API chính thức, không cần API key.
- Player dùng toàn bộ chiều cao viewport ngay cả trước khi bật chế độ mở rộng. Cài đặt chọn player sát trái (ghế lái) hoặc sát phải (ghế phụ); danh sách video và cột điều hướng đổi bên theo lựa chọn. Hình và chữ của video không bị lật.
- Play/pause, thanh tua, thời gian, nút CC bật/tắt phụ đề. Không thêm volume, ±10s hay Next.
- Cột điều hướng luôn hiện với các nút riêng Trang chủ, Tìm kiếm, Cài đặt. Tìm kiếm và Cài đặt mở popup. Nút mở rộng ẩn danh sách và cột điều hướng; video 16:9 dùng hết chiều cao viewport. Thanh Play/Pause và tua phủ lên mép dưới video, tự ẩn sau 3 giây trong chế độ mở rộng và hiện lại khi chạm màn hình.
- Tìm kiếm và phân trang qua YouTube Data API v3 khi có API key; khám phá bằng `videos.list(mostPopular)` khi chưa có lịch sử.
- Sidebar là các kết quả cùng truy vấn hoặc danh sách đang duyệt, **không giả danh thuật toán Related của YouTube**.
- Telex tùy chọn trong popup tìm kiếm: `tieengs Vieejt` → `tiếng Việt`, `phowr` → `phở`, `truowngf` → `trường`. Xử lý trong BMWTube khi APTV gửi từng ký tự; trạng thái bật chỉ làm chữ sáng hơn. Dán văn bản giữ nguyên.
- Lịch sử video/tìm kiếm cục bộ, xóa trong Cài đặt. Không đồng bộ tài khoản.
- Trạng thái mất mạng, lỗi API/quota, video không cho nhúng, link sai, player không tải được; lối mở video gốc trên YouTube.
- Trang quyền riêng tư, thao tác bàn phím, nhãn accessibility; đo viewport qua visualViewport và resize.

## Tìm kiếm: cấu hình một lần trên từng trình duyệt

1. Trong Google Cloud tạo/chọn project, bật **YouTube Data API v3** và tạo API key.
2. Giới hạn key bằng **Websites / HTTP referrers** theo URL thực tế, ví dụ `https://TEN-TAI-KHOAN.github.io/*` và `http://localhost:4173/*` khi phát triển.
3. Giới hạn API của key về YouTube Data API v3.
4. Mở BMWTube → Cài đặt → nhập key → Lưu.

Khóa cho client browser không phải bí mật backend; người dùng có thể đọc được trong trình duyệt. Không đưa OAuth client secret vào trang. Khóa được lưu localStorage tại origin đó, không tự chuyển từ Mac sang APTV. Khi chưa có khóa, tìm kiếm có nút mở truy vấn trên YouTube; phát link vẫn hoạt động. Hạn mức API do Google Cloud quyết định, tìm kiếm chỉ chạy khi submit, không gọi theo từng phím.

## Đăng nhập YouTube / Premium

Trong Cài đặt → YouTube Premium, nút **Mở m.youtube.com** mở YouTube trong APTV. Chủ ứng dụng đã xác nhận trang mobile nhận đúng tài khoản Premium và phát video được; quay lại BMWTube bằng nút Back của APTV. BMWTube không nhận mật khẩu, không dùng OAuth đăng nhập và không đọc cookie YouTube.

Chưa xác nhận player nhúng BMWTube có nhận cùng phiên Premium hay không. So sánh bằng cùng tài khoản và cùng video; nút **YouTube ↗** mở video gốc tại m.youtube.com nếu cần. Google mô tả quyền lợi Premium trong [trợ giúp Premium](https://support.google.com/youtube/answer/6308116?hl=en).

Không có home feed cá nhân hay lịch sử tìm kiếm tài khoản trong bản này. API `relatedToVideoId` đã bị bỏ, nên dùng kết quả cùng truy vấn. Không scraping, proxy video, lấy token/cookie hoặc sửa nội dung youtube.com từ origin BMWTube.

Nguồn chính thức khảo sát ngày 04/10/2026:

- [YouTube Data API reference](https://developers.google.com/youtube/v3/docs)
- [Search API](https://developers.google.com/youtube/v3/docs/search/list)
- [Revision history — relatedToVideoId và home](https://developers.google.com/youtube/v3/revision_history)
- [IFrame API — playback, errors, autoplay](https://developers.google.com/youtube/iframe_api_reference)
- [Player parameters — controls, dimensions, inline playback](https://developers.google.com/youtube/player_parameters)
- [Player policies](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [APTV thêm browser qua CarPlay](https://aptvplayer.userjot.com/updates/p/1-5-11-ban-ben-geng-xin)

## GitHub Pages

Thư mục `dist/` chứa toàn bộ site. Đường dẫn asset là tương đối nên chạy được dưới `/BMWTube/`.

1. Đưa project vào repository GitHub và push nhánh `main`.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` kiểm tra và triển khai `dist/`.
4. Mở URL Pages trong **APTV → Quick → Browser**.
5. Thêm origin HTTPS đó vào referrer restrictions của API key, nhập key trong APTV.

Website: https://tony669669.github.io/BMWTube/ — repository: https://github.com/Tony669669/BMWTube. Mỗi lần push main sẽ tự triển khai lại. GitHub Pages không có đăng nhập bảo vệ riêng trong mã này; không đưa dữ liệu riêng hoặc secret vào thư mục `dist`.

## Kiến trúc

`dist/index.html` tạo các trạng thái browse/watch/settings. `app.js` quản lý UI, truy vấn API, player và localStorage. `core.js` chứa parser URL, Telex, thời gian và tính kích thước. `style.css` bố cục tối và touch targets. Player chỉ tải khi mở video. API không polling; tiến trình phát cập nhật mỗi 500 ms khi view player đang hiện. Không tải font ngoài. Metadata từ API được hiển thị qua textContent.

Tích hợp WebMCP tùy chọn `open_youtube_video` nếu browser hỗ trợ; không cần cho APTV. Không hỗ trợ request đến domain khác hoặc URL video sai định dạng.

## Kiểm tra

`npm test` kiểm tra Telex, URL/host validation, thời gian và kích thước 1280×480 / 1920×720. Các kích thước này là mô phỏng, không phải thông số thật của màn BMW.

Kết quả kiểm tra trình duyệt và giới hạn còn lại xem [TESTING.md](TESTING.md).

## Cần thử trên xe

- So sánh Premium và playback trên m.youtube.com với player nhúng BMWTube bằng cùng video.
- Vị trí player trái/phải, cột điều hướng ở mép đối diện, chạm tua, và chiều cao tại viewport BMW đã báo 1422×456 CSS px.
- Telex với bàn phím APTV và tự ẩn controls khi mở rộng.
- Video giới hạn tuổi/riêng tư/chặn embed có thể phải mở trên YouTube.
- Không có bộ lọc Shorts hoàn hảo trong API; UI không có mục Shorts nhưng kết quả API có thể chứa video dạng ngắn.

### Nút CC

CC nằm cạnh nút mở rộng, có gạch đỏ khi module phụ đề đang bật. Tích hợp kiểm tra `loadModule`/`unloadModule` của player hiện tại và cập nhật theo `onApiChange`. Hai hàm này không được cam kết trong tài liệu API công khai; nếu không có, nút bị vô hiệu hóa. Trạng thái ban đầu đọc module; sau thao tác phản ánh lựa chọn bật/tắt đã gửi. Không bảo đảm video có track hiển thị. Nếu không tải được module thì thông báo để mở trên YouTube. Cần xác minh lại trong APTV.
