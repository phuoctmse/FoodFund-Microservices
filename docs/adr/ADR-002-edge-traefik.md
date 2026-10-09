# ADR-002 — Lớp biên giới hệ thống: Traefik v3 (Cloudflare Tunnel bật sau)

- **Trạng thái:** Đã chấp nhận — 2026-10-10
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (NFR-01, NFR-04, NFR-05, NFR-09), `docs/rewrite/02-decomposition.md` (Gateway, C-7, C-9), `docs/rewrite/03-tech-stack.md` (T-7)
- **Loại quyết định:** cửa hai chiều — có thể đổi nếu giữ các luật ở mục "Luật chống nợ".
- **Thay thế:** lựa chọn Caddy trong `03-tech-stack.md` v0.2 (lý do: rate limit không có sẵn trong Caddy, phải dùng module cộng đồng và build lại binary).

## Bối cảnh

Lớp biên nhận traffic từ web và webhook ngân hàng (SePay, PayOS). Yêu cầu:

| Mã | Yêu cầu |
|---|---|
| E-1 | HTTPS công khai; SePay chỉ gửi webhook tới URL HTTPS |
| E-2 | Định tuyến `/api/{service}` và `/webhooks/{provider}` |
| E-3 | Chuyển nguyên vẹn body webhook để service verify chữ ký |
| E-4 | Chỉ cho IP của SePay gọi `/webhooks/sepay` (6 IPv4 + 2 IPv6 công bố, có thể thay đổi) |
| E-5 | Giới hạn tần suất theo IP |
| E-6 | Giới hạn kích thước body |
| E-7 | Che IP máy chủ, chống DDoS cơ bản |
| E-8 | Cấu hình là code, local giống demo |
| E-9 | Chi phí 0 |
| E-10 | Không chứa nghiệp vụ hay xác thực; có lộ trình sang Kubernetes Gateway API |

## Quyết định

1. **Traefik v3** làm reverse proxy cho cả local và demo; chỉ dùng middleware có sẵn: `RateLimit`, `IPAllowList`, `Buffering` ([Traefik middlewares](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/)).
2. **Cloudflare Tunnel chưa bật**; được thiết kế để bật ở giai đoạn deploy demo mà không sửa code service (mục "Chuẩn bị để bật Cloudflare Tunnel").

## Phương án đã cân nhắc

| Phương án | Kết luận |
|---|---|
| Caddy | TLS tự động tốt, nhưng **rate limit (E-5) không có sẵn**, cần module cộng đồng không chính thức + build lại ([stackharbor](https://stackharbor.com/en/knowledge-base/caddy-rate-limiting/)) → nợ bảo trì |
| Nginx | Đáp ứng đủ, nhưng tự lo chứng chỉ và cấu hình nhiều hơn |
| Envoy Gateway | Bản tham chiếu Gateway API của CNCF, nhưng thiết kế cho Kubernetes → là **đích đến nếu lên K8s** |
| Kong | Ngừng phát hành image OSS từ 3.10 (03/2025) → rủi ro giấy phép ([digitalapplied](https://www.digitalapplied.com/blog/supabase-self-hosted-envoy-gateway-migration-2026)) |
| APISIX | Cần thêm etcd → thêm thành phần phải vận hành |

## Luật chống nợ

1. Chỉ middleware có sẵn của Traefik; **cấm plugin bên thứ ba**.
2. **Không xác thực, không nghiệp vụ ở biên.** Service tự verify JWT (C-7) và chữ ký webhook (C-9). Lọc IP chỉ là lớp phòng thủ thêm, không thay HMAC.
3. Cấu hình Traefik nằm trong repo; local và demo dùng cùng cấu hình, khác nhau bằng biến môi trường.
4. Danh sách IP SePay là **cấu hình có ngày kiểm tra lại** ([SePay IP](https://developer.sepay.vn/en/dia-chi-ip)).
5. **Code service không đọc header riêng của Cloudflare.** Chỉ Traefik biết IP thật của client và chuyển tiếp theo chuẩn (`X-Forwarded-For`).
6. Nếu lên Kubernetes: dùng **Gateway API**, không dùng Ingress (ingress-nginx đã ngừng hỗ trợ 03/2026 — [nguồn](https://platformengineeringplaybook.com/blog/ingress-nginx-retirement-gateway-api-migration-2026/)).

## Lớp biên giai đoạn hiện tại (chưa có Cloudflare — quyết định 2026-10-10)

Phần mềm ở biên chỉ có Traefik; các trách nhiệm còn lại do máy chủ đảm nhận:

| Trách nhiệm | Đảm nhận |
|---|---|
| Chứng chỉ HTTPS | Traefik ACME với Let's Encrypt (CA mặc định); TLS-ALPN-01 cần cổng 443, HTTP-01 cần cổng 80, DNS-01 cho wildcard ([Traefik ACME](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/)) |
| Định tuyến, chuyển HTTP → HTTPS, `RateLimit`, `IPAllowList` (IP SePay), `Buffering`, `Headers` (header bảo mật, CORS) | Traefik |
| Tường lửa | Firewall VPS: chỉ mở 80, 443, SSH (chỉ khoá, giới hạn IP nếu được). Postgres, NATS, Keycloak admin, dashboard Traefik không công khai |
| Docker socket | Không mount trực tiếp vào Traefik. Dùng socket proxy chỉ cho phép đọc trong mạng Docker riêng, hoặc khai báo route bằng file — tài liệu Traefik cảnh báo truy cập Docker API không giới hạn có thể dẫn tới chiếm quyền máy chủ ([Traefik Docker provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/)) |
| Access log | Traefik ghi log JSON gửi về hệ thống quan sát |

**Rủi ro chấp nhận:** IP máy chủ lộ, không có chống DDoS (rate limit chỉ chống lạm dụng ở tầng ứng dụng). Xử lý bằng Cloudflare Tunnel ở giai đoạn sau.

## Chuẩn bị để bật Cloudflare Tunnel (làm ngay từ bây giờ)

| Việc | Vì sao |
|---|---|
| Đăng ký tên miền và **quản lý DNS ở Cloudflare từ đầu** (gói miễn phí) | Tunnel yêu cầu domain dùng nameserver Cloudflare; chuyển DNS sau này là bước dễ lỗi nhất |
| Đăng ký webhook với SePay/PayOS bằng **tên miền, không bằng IP** | Bật/tắt Tunnel không phải đăng ký lại webhook |
| Traefik có hai chế độ TLS chọn bằng biến môi trường: tự cấp chứng chỉ (không Tunnel) hoặc chỉ nhận HTTP nội bộ từ `cloudflared` (có Tunnel) | Bật Tunnel = đổi cấu hình, không đổi code |
| Lọc IP SePay đặt sau một tham số "nguồn IP tin cậy" | Khi qua Tunnel, Traefik chỉ thấy IP của `cloudflared`; phải lấy IP thật từ header **và** chỉ nhận traffic từ mạng nội bộ của `cloudflared`, nếu không header có thể bị giả |
| Upload tệp đi thẳng tới storage bằng URL ký sẵn, không qua Tunnel | Tránh giới hạn kích thước/thời gian request của lớp trung gian |
| Luồng local **không có** Cloudflare luôn chạy được và được CI kiểm tra | Chứng minh Cloudflare là lớp tuỳ chọn → rút ra được bất cứ lúc nào |

**Cần kiểm chứng trong spike S-7 trước khi bật Tunnel:** cách cấu hình `IPAllowList` của Traefik để lấy IP thật khi đứng sau `cloudflared`; giới hạn kích thước và thời gian request của Cloudflare gói miễn phí; hoặc đặt lọc IP SePay tại Cloudflare thay vì Traefik.

## Hệ quả

- **Tích cực:** đáp ứng E-1…E-6, E-8 bằng tính năng có sẵn; giấy phép MIT; tự phát hiện service qua label Docker; Cloudflare Tunnel (E-7, che IP, không mở port) thêm được sau mà không sửa service.
- **Tiêu cực:** khi chưa bật Tunnel, VPS phải mở cổng 80/443 và IP máy chủ lộ ra; chấp nhận được ở giai đoạn phát triển.

## Điều kiện để xem lại quyết định

- Chuyển lên Kubernetes → chuyển sang Gateway API (Envoy Gateway hoặc provider Gateway API của Traefik *(chưa kiểm chứng)*).
- Không được dùng Cloudflare (lý do pháp lý/dữ liệu) → giữ Traefik tự cấp chứng chỉ, thêm biện pháp che IP khác.
