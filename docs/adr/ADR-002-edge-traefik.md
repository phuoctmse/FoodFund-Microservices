# ADR-002 — Lớp biên giới hệ thống: Traefik qua Gateway API trên Kubernetes

- **Trạng thái:** Đã chấp nhận — 2026-10-10 (sửa cùng ngày: chuyển từ Traefik + file cấu hình trên Compose sang Traefik qua Gateway API trên Kubernetes); **sửa 2026-10-11**: môi trường đổi từ k3d/k3s sang kind/kubeadm theo [ADR-004](./ADR-004-kubernetes-from-day-one.md) — cập nhật K-1, cách mở cổng, IP thật, S-7.
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (NFR-01, NFR-04, NFR-05, NFR-09), `docs/rewrite/02-decomposition.md` (Gateway, C-7, C-9), `docs/rewrite/03-tech-stack.md` (T-7), ADR-004
- **Loại quyết định:** cửa hai chiều nếu giữ các luật ở mục "Luật chống nợ".
- **Đã thay thế:** Caddy (rate limit không có sẵn, cần module cộng đồng — [stackharbor](https://stackharbor.com/en/knowledge-base/caddy-rate-limiting/)).

## Yêu cầu của lớp biên

| Mã | Yêu cầu |
|---|---|
| E-1 | HTTPS công khai; SePay chỉ gửi webhook tới URL HTTPS ([SePay IP](https://developer.sepay.vn/en/dia-chi-ip)) |
| E-2 | Định tuyến `/api/{service}` và `/webhooks/{provider}` |
| E-3 | Chuyển nguyên vẹn body webhook để service verify chữ ký |
| E-4 | Chỉ cho IP của SePay gọi `/webhooks/sepay` (6 IPv4 + 2 IPv6 công bố, có thể thay đổi) |
| E-5 | Rate limit theo IP |
| E-6 | Giới hạn kích thước body |
| E-7 | Che IP máy chủ, chống DDoS cơ bản (để giai đoạn sau — Cloudflare) |
| E-8 | Cấu hình là code, local giống demo |
| E-9 | Chi phí 0 |
| E-10 | Không chứa nghiệp vụ hay xác thực; đổi controller được mà không viết lại route |
| K-1 | Chạy tốt trên kind (local, CI) và kubeadm một node (demo VPS, không có cloud load balancer) |
| K-4 | Proxy nhận đúng **IP thật** của client (điều kiện của E-4, E-5) |
| K-5 | Nhẹ: laptop 16 GB |
| K-6 | Ít khái niệm phải học (làm một mình) |

## Quyết định

- **Traefik ≥ 3.7.10** làm controller Gateway API (CVE ở 3.7.0–3.7.6 đã sửa ở 3.7.7 — [CVE-2026-65601](https://app.opencve.io/cve/CVE-2026-65601); 3.7.10 là phiên bản trong báo cáo conformance). Cài bằng **Helm chart chính chủ** với values trong repo (kind và kubeadm đều **không** cài sẵn ingress/gateway controller).
- **Route viết bằng `HTTPRoute` chuẩn**; rate limit và lọc IP là `Middleware` của Traefik gắn qua filter `ExtensionRef` ([Traefik — Kubernetes advanced](https://doc.traefik.io/traefik/expose/kubernetes/advanced/)).
- **Chứng chỉ:** demo dùng cert-manager + Let's Encrypt (HTTP-01 qua listener cổng 80 của Gateway — [NGF + cert-manager](https://docs.nginx.com/nginx-gateway-fabric/traffic-security/integrate-cert-manager/)); local dùng HTTP hoặc chứng chỉ tự ký.
- **Mở cổng 80/443:** local — `extraPortMappings` của node kind + Traefik `hostPort`; demo — Traefik `hostNetwork` (hoặc `hostPort`) trên VPS kubeadm. Không dùng Service `LoadBalancer` (VPS không có cloud LB; cloud-provider-kind là phương án thay thế ở local, xem ADR-004).
- **Cloudflare Tunnel** để giai đoạn sau (mục cuối).

## Phương án đã cân nhắc

Mọi ứng viên chính đều "Conformant" với Gateway API v1.6.x ([danh sách chính thức](https://gateway-api.sigs.k8s.io/docs/implementations/list/)) → khác biệt nằm ngoài phần chuẩn.

| Phương án | Kết luận |
|---|---|
| **Envoy Gateway** | Mô hình chính sách tốt nhất: `SecurityPolicy` (lọc `clientCIDRs`), `ClientTrafficPolicy` (xác định IP gốc), `BackendTrafficPolicy` (rate limit) ([SecurityPolicy](https://gateway.envoyproxy.io/latest/concepts/gateway_api_extensions/security-policy/)). Nặng hơn: control plane mặc định xin 256 Mi (giới hạn 1 Gi) cộng pod Envoy riêng ([Helm values](https://gateway.envoyproxy.io/docs/install/gateway-helm-api/)); nhiều CRD hơn → **phương án dự phòng** |
| NGINX Gateway Fabric | Có `RateLimitPolicy`, nhưng **không tìm thấy lọc IP** (allow/deny thuộc NGINX Ingress Controller — sản phẩm khác) |
| Cilium | Gateway API gắn với CNI Cilium, phải chọn từ lúc tạo cluster; ADR-004 chọn Calico → quá xâm lấn |
| Istio | Service mesh — vượt nhu cầu |
| Kong | Bỏ image OSS từ 3.10 (03/2025) → rủi ro giấy phép |
| ingress-nginx | Đã ngừng hỗ trợ 03/2026 ([nguồn](https://platformengineeringplaybook.com/blog/ingress-nginx-retirement-gateway-api-migration-2026/)) |

## Luật chống nợ

1. **Chỉ dùng `HTTPRoute` chuẩn; không dùng `IngressRoute`** (CRD riêng của Traefik).
2. Phần riêng của Traefik chỉ gồm các `Middleware` có sẵn (`RateLimit`, `IPAllowList`, `Buffering`, `Headers`); **cấm plugin bên thứ ba**.
3. **Không xác thực, không nghiệp vụ ở biên.** Service tự verify JWT (C-7) và chữ ký webhook (C-9). Lọc IP chỉ là lớp phòng thủ thêm, không thay HMAC.
4. Danh sách IP SePay là **cấu hình có ngày kiểm tra lại**.
5. **Code service không đọc header riêng của Cloudflare** hay của proxy; chỉ dùng `X-Forwarded-For` chuẩn do proxy đặt.

## Phương án dự phòng: Envoy Gateway

Kích hoạt khi spike S-7 thất bại.

| Phần | Khi chuyển |
|---|---|
| `HTTPRoute` của 6 service + webhook | Giữ nguyên |
| Rate limit | Viết lại thành `BackendTrafficPolicy` |
| Lọc IP SePay | Viết lại thành `SecurityPolicy` + `ClientTrafficPolicy` |

## IP thật của client (K-4)

IP thật phụ thuộc **đường đi của traffic trước khi tới proxy** — đổi controller không tự giải quyết.

| Môi trường | Đường đi | Kỳ vọng | Trạng thái |
|---|---|---|---|
| Demo (VPS kubeadm) | Internet → cổng 80/443 của VPS → Traefik `hostNetwork` | Traefik nghe trực tiếp trên mạng của máy chủ → thấy IP nguồn thật, không qua NAT của kube-proxy | **Chưa kiểm chứng** — S-7 |
| Demo, nếu dùng `hostPort` thay `hostNetwork` | Qua plugin `portmap` của CNI (DNAT) | DNAT chỉ đổi địa chỉ đích nên IP nguồn thường được giữ | **Chưa kiểm chứng** — S-7 |
| Local (kind trên Docker Desktop) | Windows → Docker Desktop → container node kind (`extraPortMappings`) → Traefik `hostPort` | IP nguồn là địa chỉ nội bộ của Docker, không phải IP thật | Lọc IP ở local chỉ test được bằng cấu hình giả lập (cho phép dải nội bộ) |

*(Bản trước ghi vấn đề ServiceLB/klipper-lb của k3s — không còn áp dụng sau khi đổi sang kubeadm.)*

## Spike S-7 (bắt buộc, trên VPS kubeadm một node)

1. `IPAllowList` gắn qua `ExtensionRef` hoạt động (có báo lỗi cộng đồng chưa rõ cách xử lý — [thread](https://community.traefik.io/t/error-trying-to-use-basicauth-middleware-in-an-httproute-kubernetes-gateway/29689)) — làm được ngay trên kind.
2. Traefik `hostNetwork` (hoặc `hostPort`) nhận đúng IP thật của request từ bên ngoài — phải làm trên VPS.

Trượt một trong hai → chuyển sang Envoy Gateway.

## Lớp biên giai đoạn hiện tại (chưa có Cloudflare)

| Trách nhiệm | Đảm nhận |
|---|---|
| Chứng chỉ HTTPS (demo) | cert-manager + Let's Encrypt |
| Định tuyến, chuyển HTTP → HTTPS, rate limit, lọc IP SePay, giới hạn body, header bảo mật, CORS | Traefik |
| Tường lửa VPS | Chỉ mở 80, 443, SSH (chỉ khoá, giới hạn IP nếu được). **API server của kubeadm (cổng 6443) chỉ cho IP quản trị.** Postgres, NATS, Keycloak admin, Temporal UI, dashboard Traefik không công khai |
| Quyền của controller | Controller đọc API Kubernetes với RBAC tối thiểu từ Helm chart — không dùng Docker socket |
| Access log | Traefik ghi log JSON gửi về hệ thống quan sát |

**Rủi ro chấp nhận:** IP máy chủ lộ, không có chống DDoS (rate limit chỉ chống lạm dụng ở tầng ứng dụng).

## Bật Cloudflare Tunnel ở giai đoạn sau

Chuẩn bị ngay từ bây giờ:

| Việc | Vì sao |
|---|---|
| Quản lý DNS tên miền ở Cloudflare từ đầu | Tunnel yêu cầu nameserver Cloudflare |
| Đăng ký webhook SePay/PayOS bằng tên miền, không bằng IP | Bật Tunnel không phải đăng ký lại |
| Upload tệp đi thẳng tới storage bằng URL ký sẵn | Tránh giới hạn của lớp trung gian |
| Luồng không có Cloudflare luôn chạy được và có CI kiểm tra | Cloudflare là lớp tuỳ chọn, rút ra được |

**Spike S-10 trước khi bật:** `cloudflared` chạy trong cluster; lọc IP SePay khi Traefik đứng sau `cloudflared` (chỉ tin header từ pod `cloudflared`, hoặc lọc tại Cloudflare); giới hạn kích thước/thời gian request của Cloudflare gói miễn phí.

## Hệ quả

- **Tích cực:** 1 pod, ít khái niệm; cùng cách cài (Helm) và cách mở cổng (`hostPort`/`hostNetwork`) ở local và demo; route chuẩn nên đổi controller chỉ viết lại 2 chính sách.
- **Mất so với bản k3s:** lợi thế "có sẵn trong k3s" không còn — Traefik vẫn được chọn vì nhẹ nhất và ít khái niệm nhất trong các ứng viên.
- **Tiêu cực:** còn hai điểm chưa kiểm chứng (S-7); chưa có che IP và chống DDoS cho tới khi có Cloudflare.

## Điều kiện để xem lại quyết định

- S-7 thất bại → Envoy Gateway.
- Cần tính năng biên phức tạp hơn (xác thực ở biên, quota theo khách hàng) → đánh giá lại Envoy Gateway.
