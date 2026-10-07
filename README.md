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
- Cột điều hướng luôn hiện với icon nét mảnh kiểu macOS cho Trang chủ, Tìm kiếm, Cài đặt; logo play dùng màu tối trung tính. Tìm kiếm và Cài đặt mở popup. Nút mở rộng ẩn danh sách và cột điều hướng; video 16:9 dùng hết chiều cao viewport. Thanh Play/Pause và tua phủ lên mép dưới video, tự ẩn sau 3 giây trong chế độ mở rộng và hiện lại khi chạm màn hình.
- Tìm kiếm và phân trang qua YouTube Data API v3 khi có API key; kết quả hiển thị cả kênh và video. Chip **Kênh yêu thích** và **Video yêu thích** nằm cạnh tiêu đề truy vấn, lọc các kết quả đã tải theo channel ID/video ID lưu trên thiết bị; bật/tắt chip không gọi API. Khi bật cả hai, kết quả phải khớp cả hai bộ lọc. Mỗi lần gửi tìm kiếm hỏi riêng loại kênh và video để giữ bộ lọc video có thể nhúng; không gọi theo từng phím. Khám phá dùng `videos.list(mostPopular)`.
- Sidebar là các kết quả cùng truy vấn hoặc danh sách đang duyệt, **không giả danh thuật toán Related của YouTube**.
- Telex tùy chọn trong popup tìm kiếm: `tieengs Vieejt` → `tiếng Việt`, `phowr` → `phở`, `truowngf` → `trường`. Xử lý trong BMWTube khi APTV gửi văn bản qua input, kể cả khi thiếu inputType/data; trạng thái bật chỉ làm chữ sáng hơn. Dán văn bản giữ nguyên.
- Thư viện cục bộ có Tiếp tục xem (lưu vị trí và nút bỏ), Xem sau (đồng hồ để thêm/bỏ), Video yêu thích (sao để thêm/bỏ), và Kênh yêu thích (dấu trang để thêm/bỏ). Kênh hiện logo và tên theo hàng ngang; chọn tên để xem video của kênh. Trong Cài đặt, chọn mục mặc định khi mở Thư viện: Tiếp tục xem, Xem sau, Kênh yêu thích hoặc Playlist. Đã xem gần đây và tìm kiếm gần đây vẫn riêng. Dữ liệu chỉ lưu trên thiết bị, không đồng bộ tài khoản.
- Trạng thái mất mạng, lỗi API/quota, video không cho nhúng, link sai, player không tải được. Thông báo tự ẩn sau 2 giây. Player chính không có nút mở YouTube; đăng nhập YouTube vẫn nằm trong Cài đặt.
- Trang quyền riêng tư, thao tác bàn phím, nhãn accessibility; đo viewport qua visualViewport và resize.

## Tìm kiếm: cấu hình một lần trên từng trình duyệt

1. Trong Google Cloud tạo/chọn project, bật **YouTube Data API v3** và tạo API key.
2. Giới hạn key bằng **Websites / HTTP referrers** theo URL thực tế, ví dụ `https://TEN-TAI-KHOAN.github.io/*` và `http://localhost:4173/*` khi phát triển.
3. Giới hạn API của key về YouTube Data API v3.
4. Mở BMWTube → Cài đặt → nhập key → Lưu.

Khóa cho client browser không phải bí mật backend; người dùng có thể đọc được trong trình duyệt. Không đưa OAuth client secret vào trang. Khóa được lưu localStorage tại origin đó, không tự chuyển từ Mac sang APTV. Khi chưa có khóa, tìm kiếm có nút mở truy vấn trên YouTube; phát link vẫn hoạt động. Hạn mức API do Google Cloud quyết định, tìm kiếm chỉ chạy khi submit, không gọi theo từng phím. Các lần submit cùng truy vấn khi request còn đang chạy dùng chung một request; sau khi hoàn tất, gửi lại sẽ gọi API mới.

## Đăng nhập YouTube / Premium

Trong Cài đặt → YouTube Premium, nút **Mở m.youtube.com** mở YouTube trong APTV. Chủ ứng dụng đã xác nhận trang mobile nhận đúng tài khoản Premium và phát video được; quay lại BMWTube bằng nút Back của APTV. BMWTube không nhận mật khẩu, không dùng OAuth đăng nhập và không đọc cookie YouTube.

Chưa xác nhận player nhúng BMWTube có nhận cùng phiên Premium hay không. Đăng nhập YouTube vẫn có thể mở từ Cài đặt; player chính không hiển thị nút mở video gốc. Google mô tả quyền lợi Premium trong [trợ giúp Premium](https://support.google.com/youtube/answer/6308116?hl=en).

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

`npm test` kiểm tra Telex, URL/host validation, dữ liệu lưu sai kiểu, thời gian và tính kích thước, gồm mốc BMW 1422×456 CSS px từ ảnh APTV người dùng cung cấp. `npm run test:browser` chạy các kịch bản hồi quy bằng Playwright cài ngoài project (có thể đặt đường dẫn `PLAYWRIGHT_MODULE` và `CHROME_PATH`); toàn bộ YouTube/API được giả lập, không tốn quota.

Kết quả kiểm tra trình duyệt và giới hạn còn lại xem [TESTING.md](TESTING.md).

## Cần thử trên xe

- So sánh Premium và playback trên m.youtube.com với player nhúng BMWTube bằng cùng video.
- Vị trí player trái/phải, cột điều hướng ở mép đối diện, chạm tua, và chiều cao tại viewport BMW đã báo 1422×456 CSS px.
- Telex với bàn phím APTV và tự ẩn controls khi mở rộng.
- Video giới hạn tuổi/riêng tư/chặn embed có thể phải mở trên YouTube.
- Không có bộ lọc Shorts hoàn hảo trong API; UI không có mục Shorts nhưng kết quả API có thể chứa video dạng ngắn.

### Nút CC

CC nằm cạnh nút mở rộng. Mặc định CC tắt và nút màu ghi; trạng thái màu theo lựa chọn của BMWTube, không suy ra từ `getOptions()` vì API này liệt kê khả năng của module chứ không xác nhận phụ đề đang hiển thị. Khi player khởi tạo hoặc đổi video, BMWTube thử gọi `unloadModule('captions')` trước khi phát. `cc_load_policy: 0` vẫn theo tùy chọn người dùng của YouTube; `loadModule`/`unloadModule` không được cam kết trong tài liệu API công khai, nên tắt cưỡng bức là best effort và cần xác minh trên APTV. Không bảo đảm video có track phụ đề.
