# FoodFund (bản viết lại) — Lựa chọn công nghệ

> **Trạng thái:** v1.1 — 2026-10-17. T-1 … T-14 đã chốt (2026-10-11). Bốn quyết định lớn có mục ADR riêng ở [Phần 2](#phần-2--quyết-định-lớn-adr): ADR-001 PostgreSQL 18, ADR-002 Traefik, ADR-003 Temporal, ADR-004 Kubernetes.
> **Quy ước:** mỗi hạng mục ghi *Chọn / Đã cân nhắc / Lý do / Hệ quả*, kèm *Bằng chứng*. Điểm *(chưa kiểm chứng)* được xác nhận trong spike ([Phần 3](#spike-kỹ-thuật)).
> **Đang chờ sửa** theo [thiết kế spike luồng tiền §12](./spikes/money-flow/design.md#12-đầu-ra): T-6 và ADR-001 (bỏ "pending/post/void có hạn", ghi mô hình transfer hai chân), ADR-003 luật 3 (UNIQUE ở DB là bảo đảm chống trùng).

**Loại bằng chứng:**
- **[Audit]** quan sát/đo trực tiếp trên hệ thống cũ trong buổi audit (2026-10-07);
- **[Tài liệu]** tài liệu chính thức hoặc nguồn công khai, có link;
- **[Đo]** đo trên máy phát triển ([Phụ lục](#phụ-lục--phép-đo-go-vs-python-2026-10-09));
- **[Requirement]** suy ra trực tiếp từ `01-requirements.md` / `02-decomposition.md`;
- **[Đánh giá]** nhận định của người thiết kế, chưa có bằng chứng khách quan.

**Mức bằng chứng:** *Mạnh* = có tài liệu/đo xác nhận đúng tính năng cần; *Trung bình* = có bằng chứng một phần, phần còn lại là đánh giá; *Yếu* = chủ yếu là đánh giá.

---

## 0. Tóm tắt

| # | Hạng mục | Chọn | Mức bằng chứng |
|---|---|---|---|
| T-1 | Ngôn ngữ | Go (bản ổn định mới nhất) cho service lõi; Python ≥ 3.12 cho AI (Temporal worker, không FastAPI) | Trung bình — đo trên máy + chủ dự án chọn |
| T-2 | API phía client | REST + **OpenAPI 3.0.x** viết spec trước, sinh code (`oapi-codegen`, client TypeScript); lệnh khởi động quy trình dài trả `202 Accepted` | Trung bình — audit + tài liệu |
| T-3 | Gọi đồng bộ nội bộ (chỉ đọc) | ConnectRPC + Protobuf (`buf`), chỉ cho 1–2 truy vấn đọc; phần lớn giao tiếp là activity Temporal | Trung bình — tài liệu |
| T-4 | Event bus | NATS JetStream (Apache 2.0, ở lại CNCF) **chỉ để phát tin** tới read model và Notification; stream lưu đĩa, luôn có giới hạn; cài khi có consumer đầu tiên | Trung bình — audit + tài liệu; RAM chưa đo |
| T-5 | Điều phối quy trình | **[ADR-003](#adr-003-temporal):** Temporal (tự host, lưu trên PostgreSQL 18); worker Go + Python | Trung bình — tài liệu; footprint và độ phức tạp chưa đo (S-3, S-4) |
| T-6 | Cơ sở dữ liệu | **[ADR-001](#adr-001-postgresql-18):** PostgreSQL 18 chạy bằng operator CloudNativePG; mỗi service một database; `pgx` + `sqlc`; `goose`; backup PITR | Mạnh — dữ liệu D1–D5 trong ADR-001 |
| T-7 | Gateway | **[ADR-002](#adr-002-traefik-qua-gateway-api):** Traefik ≥ 3.7.10 làm controller Gateway API (`HTTPRoute` chuẩn; `RateLimit`, `IPAllowList` qua `ExtensionRef`); cert-manager cho demo; Envoy Gateway dự phòng; Cloudflare Tunnel sau | Trung bình — chấm theo E-1…E-10, K-1…K-6; còn spike S-7 |
| T-8 | Danh tính | Keycloak (Apache 2.0; OIDC, đăng nhập Google qua identity brokering) | Trung bình — tài liệu; RAM chưa đo |
| T-9 | Thanh toán | SePay VA theo đơn hàng + PayOS, **cả hai [M]**, sau interface `PaymentProvider`; dev/CI/demo dùng sandbox + `paysim` | Mạnh — audit + tài liệu nhà cung cấp |
| T-10 | Tệp, PDF, email | Lưu trữ API S3: **SeaweedFS** (local) / **Cloudflare R2** (demo); PDF: Maroto v2 hoặc Typst (chọn ở S-5); email SMTP: Mailpit (local) / **Brevo** (demo) | Trung bình — tài liệu; PDF tiếng Việt chưa đo |
| T-11 | AI | **Đã chốt:** tự chạy model mở — S-6 so Qwen3-VL-4B và Vintern-1B-v3.5; Temporal worker Python; adapter 5 chế độ; E2E/demo trên HF Spaces ZeroGPU (miễn phí), dự phòng Modal | Trung bình — tài liệu HF; chất lượng tiếng Việt chưa đo (S-6) |
| T-12 | Frontend | React + TypeScript **có SSR** (Next.js standalone hoặc React Router v7 — chọn sau prototype) + **BFF** giữ token OIDC phía server; client sinh từ OpenAPI | Yếu — chủ yếu đánh giá |
| T-13 | Quan sát | OpenTelemetry (Go, Python); log JSON; local: `otel-lgtm` (tắt mặc định); demo: **Grafana Cloud gói miễn phí** | Trung bình — tài liệu nhà cung cấp |
| T-14 | Chạy local, CI, deploy | **[ADR-004](#adr-004-kubernetes-từ-ngày-đầu):** kind v0.33.0 với node image cố định v1.35.8 (local, CI) + kubeadm một node (demo); Calico; `make up`; chart/operator chính chủ, không Bitnami | Trung bình — đo máy phát triển; còn spike S-4, S-8 |

---

# Phần 1 — Quyết định theo hạng mục

## T-1. Ngôn ngữ

- **Chọn:** Go cho Identity & Org, Campaign, Funds, Operations, Transparency, Notification worker; Python ≥ 3.12 cho AI.
- **Đã cân nhắc:** Python cho tất cả; TypeScript lõi + Python AI.
- **Lý do:** kiểu tĩnh và xử lý lỗi tường minh phù hợp code tiền (NFR-01); mỗi service là một binary nhỏ, ít RAM. Python dùng cho AI vì hệ sinh thái model.
- **Hệ quả:** hai bộ công cụ (Go: `golangci-lint`, `go test`; Python: `uv`, `ruff`, `pyright`, `pytest`). Service AI chỉ là Temporal worker → **không dùng FastAPI** (bớt một framework). Hợp đồng giữa hai ngôn ngữ chỉ qua Protobuf (activity, event), không chia sẻ code.
- **Bằng chứng (*Trung bình*):**
  - **[Đo]** Service HTTP tối thiểu ([Phụ lục](#phụ-lục--phép-đo-go-vs-python-2026-10-09)): Go dùng ~20 MB RAM, khởi động ~0,52 giây; FastAPI dùng ~62 MB, khởi động ~1,1 giây — cùng phương pháp đo, 3 lần chạy.
  - **[Đánh giá — nói thẳng]** Chênh lệch RAM tuyệt đối cho 6 service chỉ khoảng 250 MB ở mức hello-world — **nhỏ** so với Keycloak (~1,25 GB). RAM **không phải** lý do quyết định. Lý do chính: chủ dự án chọn Go; kiểu tĩnh và lỗi tường minh hợp code tiền (Python có `pyright` cũng đạt được phần lớn điều này).
  - **Sẽ đổi quyết định nếu:** tốc độ làm một mình được ưu tiên hơn việc học Go → Python cho tất cả.

## T-2. API phía client

- **Chọn:** REST + JSON, **OpenAPI-first** — viết spec trước bằng **OpenAPI 3.0.x**, sinh server stub Go (`oapi-codegen`, chế độ strict server) và client TypeScript cho web.
- **Đã cân nhắc:** GraphQL Federation (hệ thống cũ); Connect cho cả phía ngoài (một hệ schema, nhưng ít người quen, mất lợi thế Swagger khi demo); `huma` (viết code trước, tự sinh spec 3.1).
- **Lý do:** web tối thiểu không cần truy vấn linh hoạt; Transparency đã gộp dữ liệu; reviewer thử API ngay bằng Swagger; trang công khai (sao kê) tận dụng cache HTTP; webhook ngân hàng vốn là REST. `oapi-codegen` mới hỗ trợ OpenAPI 3.1 ở mức ban đầu (v2.8, cần Go 1.25) → dùng 3.0.x để công cụ hai phía đều ổn định.
- **Quy ước do có Temporal:** lệnh khởi động quy trình dài (tạo khoản quyên góp, yêu cầu giải ngân…) trả **`202 Accepted` + ID**; client đọc trạng thái từ database của service, không chờ workflow chạy xong.
- **Hệ quả:** mỗi service công bố `openapi.yaml`; CI kiểm tra code sinh ra khớp spec.
- **Bằng chứng (*Trung bình*):**
  - **[Audit]** Gateway Apollo của hệ thống cũ không phục vụ request nào cho đến khi kiểm tra xong từng subgraph: mỗi subgraph không sẵn sàng bị thử lại ~34 giây, **tuần tự** cho 4 subgraph. Lưu ý công bằng: một phần là do cách hiện thực (compose lúc khởi động), không hoàn toàn do Federation.
  - **[Requirement]** Web chỉ ở mức tối thiểu (mục 7.1 requirements); Transparency đã là read model gộp dữ liệu (D-3) → không còn nhu cầu ghép schema từ nhiều service.
  - **[Tài liệu]** `oapi-codegen` sinh interface server cho `net/http` chuẩn, có chế độ strict server tự xử lý marshal/unmarshal, và sinh client ([oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)).
  - **Sẽ đổi nếu:** có nhiều loại client cần truy vấn linh hoạt (ví dụ thêm app mobile).

## T-3. Gọi đồng bộ nội bộ

- **Chọn:** ConnectRPC (`connect-go`) + Protobuf; schema quản lý bằng `buf` (lint + `buf breaking`).
- **Phạm vi:** chỉ 1–2 truy vấn đọc (ví dụ Operations hỏi Funds ngân sách còn lại để báo lỗi sớm). Phần lớn giao tiếp giữa service đã là **activity Temporal** (`02-decomposition.md` mục 3).
- **Đã cân nhắc:** REST nội bộ; gRPC thuần.
- **Lý do:** dùng chung một nguồn schema Protobuf với activity và event; Connect chạy trên HTTP thường, gọi được bằng `curl`.
- **Hệ quả:** thư mục `proto/` chung; `buf breaking` chạy trong CI.
- **Bằng chứng (*Trung bình*):**
  - **[Tài liệu]** Connect chạy trên HTTP/1.1, HTTP/2, HTTP/3; gọi được bằng cURL với JSON; hỗ trợ đầy đủ giao thức gRPC và gRPC-Web ([Connect docs](https://connectrpc.com/docs/introduction)). `buf` phát hiện thay đổi phá vỡ ([Buf CLI](https://webflow-new.buf.build/product/cli)).
  - **[Requirement]** C-6 (contract test cho schema); dùng chung Protobuf với event (T-4).
  - **[Đánh giá]** REST nội bộ cũng làm được; chọn Protobuf để có **một** nguồn schema cho cả RPC và event.

## T-4. Event bus

- **Chọn:** NATS JetStream, **chỉ để phát tin** tới read model (Transparency), Notification và projection; luồng tiền đi qua Temporal (ADR-003).
- **Giấy phép:** rủi ro chuyển sang BSL năm 2025 đã được giải quyết — ngày 01/05/2025 NATS **ở lại CNCF dưới Apache 2.0**, thương hiệu chuyển cho Linux Foundation.
- **Đã cân nhắc:** Kafka (hệ thống cũ, quá nặng); bỏ hẳn NATS, workflow gọi trực tiếp activity của từng bên nhận (bên phát phải biết danh sách bên nhận → ghép nối chặt với ~5 bên nhận × ~15 loại event).
- **Cách dùng:** mỗi bounded context một stream; **lưu trên đĩa và luôn đặt giới hạn** (`max_age`, `max_bytes`) — stream lưu RAM không giới hạn sẽ phình vô hạn; consumer bền cho mỗi bên nhận; payload Protobuf có `schemaVersion`; giới hạn số lần gửi → stream lỗi + cảnh báo.
- **Hệ quả:** cài NATS **khi có consumer đầu tiên** (không cài sẵn từ ngày đầu); thư viện nhỏ `libs/events` (publish, subscribe, inbox) cho Go; client NATS cho Python nếu cần.
- **Bằng chứng (*Trung bình*):**
  - **[Audit]** Service `user` và `campaign` cũ **crash ngay khi khởi động** nếu không có Kafka (`KafkaJSConnectionError … Port … NaN`). Stack Kafka nằm riêng ở `infrastructure/docker-compose.yml` với 3 container (Zookeeper, Kafka, Debezium Connect) và README không nhắc tới.
  - **[Tài liệu]** JetStream có `AckWait` (hết hạn thì gửi lại), `MaxDeliver` (giới hạn số lần gửi), và phát advisory khi vượt giới hạn — dùng làm hàng lỗi (dead-letter) có thể phát lại ([Synadia: reliable delivery & DLQ](https://www.synadia.com/blog/jetstream-reliable-delivery-dlq-replay), [NATS docs: consumers](https://docs.nats.io/~/revisions/FTWMYYvWt52KJd0gQISk/using-nats/developer/develop_jetstream/consumers)). Đáp ứng C-3/C-4.
  - **Chưa có:** số đo RAM của NATS → spike S-4.
  - **Sẽ đổi nếu:** cần CDC bằng Debezium hoặc lưu trữ/phát lại event ở quy mô rất lớn.

## T-5. Điều phối quy trình (thay cho outbox, job, lịch tự động)

- **Chọn:** **Temporal** tự host trên PostgreSQL 18; worker Go cho service lõi, worker Python cho AI. Các quy trình dài (VA hết hạn, đóng gây quỹ, saga giải ngân, tiền dư, hạn báo cáo, phân tích chứng từ, đối soát hằng ngày) viết thành workflow. `temporal server start-dev` chỉ cho test tự động và thử nhanh. Bối cảnh, phương án đã cân nhắc, luật thiết kế và bằng chứng: [ADR-003](#adr-003-temporal).
- **Hệ quả:** bỏ River và outbox tự viết; thêm một thành phần phải vận hành; phải tuân thủ luật tất định và versioning.

## T-6. Cơ sở dữ liệu

- **Chọn:** PostgreSQL 18 qua CloudNativePG ([ADR-001](#adr-001-postgresql-18)); **một instance, mỗi service một database và một user riêng**. Truy cập bằng `pgx` + `sqlc` (SQL viết tay, sinh code có kiểu); migration bằng `goose`; khoá chính `uuidv7()`.
- **Đã cân nhắc:** ORM (GORM, ent).
- **Lý do:** sổ cái cần kiểm soát transaction và câu SQL tường minh; `sqlc` bắt lỗi SQL lúc build.
- **Sổ cái & audit (FR-LED, NFR-02, BR-14):**
  - Tiền lưu `BIGINT` (VND).
  - Bảng `postings` và `audit_log`: user ứng dụng chỉ INSERT, **không UPDATE/DELETE** (cấp quyền ở mức database).
  - Mỗi `journal_entry` cân bằng: kiểm tra bằng constraint trigger hoãn đến cuối transaction.
  - Không `ON DELETE CASCADE` cho dữ liệu tiền/chứng từ.
  - Ngữ nghĩa chuyển khoản bất biến + pending/post/void có hạn.
- **Hệ quả:** một instance là điểm hỏng chung → PITR bắt buộc (ADR-001); ranh giới database vẫn tách để tách instance sau.
- **Bằng chứng (*Mạnh*):** dữ liệu D1–D5 trong ADR-001, thêm:
  - **[Tài liệu]** `sqlc` hỗ trợ `pgx/v5` từ v1.18.0 qua `sql_package: "pgx/v5"` ([sqlc — Using Go and pgx](https://docs.sqlc.dev/en/latest/guides/using-go-and-pgx.html)). *(Khả năng báo lỗi SQL lúc sinh code chưa được trích dẫn — kiểm tra trong spike S-2.)*
  - **[Audit]** Hệ thống cũ: `onDelete: Cascade` trên dữ liệu tiền, xoá cứng campaign, `received_amount` cập nhật hai lần không nguyên tử → cần transaction tường minh và quyền chỉ-INSERT ở mức database.

## T-7. Gateway

- **Chọn:** Traefik ≥ 3.7.10 làm controller **Gateway API**, route bằng `HTTPRoute` chuẩn, `Middleware` (`RateLimit`, `IPAllowList`…) gắn qua `ExtensionRef`; Envoy Gateway dự phòng; Cloudflare Tunnel bật sau. Chi tiết và phương án đã cân nhắc: [ADR-002](#adr-002-traefik-qua-gateway-api).
- **Đã cân nhắc thêm (ngoài ADR-002):** APISIX (cần etcd); Caddy (tự cấp và gia hạn TLS mặc định — [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) — nhưng không bù được việc thiếu rate limit).
- **Xác thực:** JWT (Keycloak) kiểm tra **trong từng service** bằng `libs/auth`; quyền sở hữu tài nguyên kiểm tại service sở hữu dữ liệu (C-7). Gateway chỉ TLS + định tuyến + giới hạn tần suất.
- **Bằng chứng (*Trung bình*):**
  - **[Requirement]** C-7/NFR-04 buộc kiểm tra quyền tại service sở hữu dữ liệu → service phải xác thực token dù gateway có làm hay không → gateway không cần logic.
  - **[Tài liệu]** Traefik có sẵn `RateLimit`, `IPAllowList`, `Buffering`, `ForwardAuth` ([Traefik middlewares](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/)).

## T-8. Danh tính

- **Chọn:** Keycloak (Apache 2.0) — OIDC; đăng nhập Google qua identity brokering; realm và người dùng mẫu cho từng vai trò import tự động khi khởi động (`--import-realm`).
- **Đã cân nhắc:**

  | Phương án | Lý do không chọn |
  |---|---|
  | Zitadel | **Chuyển sang AGPL 3.0 từ v3** → tăng rủi ro giấy phép; lợi thế nhiều tenant (B2B) không cần |
  | Ory (Kratos, Hydra…) | Bộ linh kiện tự lắp — quá nhiều việc cho một người |
  | Authentik | Không có lợi thế rõ cho FoodFund |
  | Cognito, Auth0 (dịch vụ) | Không chạy được local (NFR-05); hệ thống cũ gặp đúng vấn đề này |

- **Hệ quả:** vai trò và tổ chức **không** lưu trong Keycloak — Identity & Org là nguồn sự thật (FR-ID-02); token chỉ mang `sub`, service tra vai trò hiện tại từ projection → không có chuyện vai trò đã đổi mà token cũ vẫn mang vai trò cũ. Rủi ro còn lại: RAM (sizing chính thức 1.250 MB cho production) → đo ở S-4.
- **Bằng chứng (*Trung bình*):**
  - **[Audit]** Service `auth` cũ phụ thuộc AWS Cognito thật → không chạy được local; luồng Google tự viết đổi mật khẩu người dùng (`libs/aws-cognito/aws-cognito.service.ts:851-853`).
  - **[Tài liệu]** `--import-realm` nạp file realm JSON khi khởi động, bỏ qua nếu realm đã có → seed sẵn người dùng cho từng vai trò, phục vụ NFR-05 ([Red Hat build of Keycloak — Importing and Exporting Realms](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/24.0/html/server_guide/importexport-)).
  - **[Tài liệu]** Hướng dẫn sizing chính thức: bộ nhớ cơ sở **1250 MB** (gồm cache realm và 10.000 phiên) — con số cho production, môi trường dev có thể thấp hơn nhưng **chưa đo** ([Keycloak sizing](https://www.keycloak.org/high-availability/single-cluster/concepts-memory-and-cpu-sizing)).
  - **Bằng chứng mâu thuẫn:** Zitadel được một nguồn nêu ~512 MB nhưng khuyến nghị nhiều hơn ([Zitadel minimum specs](https://help.zitadel.com/what-are-zitadel-minimum-self-hosted-specs), [SSD Nodes](https://www.ssdnodes.com/learn/lang/it/keycloak-vs-authentik-vs-zitadel)) → không đủ căn cứ để nói Zitadel nhẹ hơn trong thực tế.
  - **[Đánh giá]** Keycloak phổ biến, dễ giải thích khi phỏng vấn. Đăng nhập Google qua identity brokering là tính năng chuẩn của Keycloak *(chưa trích dẫn trực tiếp)*.
  - **Sẽ đổi nếu:** spike S-4 cho thấy Keycloak làm vượt RAM VPS hoặc vượt 10 phút khởi động.

## T-9. Thanh toán

- **Chọn:** **SePay VA theo đơn hàng** và **PayOS**, **cả hai giữ mức [M]**, sau interface `PaymentProvider` trong module `payment` của Funds; mỗi provider có trình giả lập `tools/paysim` gửi webhook đã ký.
- **Phát hiện làm đổi đề xuất cũ:** VA theo đơn hàng của SePay ở môi trường thật **chỉ dành cho tài khoản doanh nghiệp BIDV**, giá liên hệ ([SePay](https://sepay.vn/en/tai-khoan-ao-theo-don-hang.html)) → **rút lại đề xuất hạ PayOS xuống [S]**. Ưu tiên cuối cùng giữa hai kênh quyết định sau spike S-1 (kèm kiểm tra điều kiện mở tài khoản PayOS — *chưa kiểm chứng*).
- **Lý do giữ VA:** khớp giao dịch theo số tài khoản ảo thay vì nội dung chuyển khoản → loại phần lớn ca "không khớp", "chuyển thiếu/dư" của hệ thống cũ; sandbox giả lập được thanh toán VA ([SePay Sandbox](https://developer.sepay.vn/en/sepay-api/v2/sandbox)); webhook xác thực HMAC-SHA256/API key ([SePay webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)).
- **Hệ quả:**
  - Dev, CI và demo chạy **sandbox + `paysim`**; README ghi rõ demo dùng sandbox.
  - BR-11 (định danh nhận tiền riêng mỗi campaign): mô hình dữ liệu gắn mọi VA/link với campaign; mức đáp ứng ở môi trường thật phụ thuộc S-1.
  - FR-PAY-03 (thiếu/dư) và FR-PAY-10 (hàng chờ đối soát) giữ cho PayOS và tiền vào ngoài VA.
- **Bằng chứng (*Mạnh*):**
  - **[Audit]** Lỗi thanh toán của hệ thống cũ đều đến từ việc khớp theo nội dung/số tiền: coi hai khoản cùng số tiền là trùng, tiền không khớp vào thẳng ví admin, phải xử lý chuyển thiếu/dư (mục 8 requirements).
  - **[Tài liệu]** VA theo đơn hàng: mỗi đơn một VA, **ngân hàng báo lỗi ngay nếu chuyển sai số tiền**, VA tự huỷ sau khi thanh toán hoặc hết hạn; API v1 ngừng phát triển ([SePay — VA theo đơn hàng](https://developer.sepay.vn/en/sepay-api/api-va-theo-don-hang)). Sandbox giả lập thanh toán VA cho BIDV, Sacombank, Vietcombank, VietinBank, Shinhan ([SePay Sandbox](https://developer.sepay.vn/en/sepay-api/v2/sandbox)). Webhook xác thực HMAC-SHA256/API key, gửi lại tối đa 7 lần trong 5 giờ ([SePay webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)).
  - **[Tài liệu]** PayOS có chữ ký webhook và môi trường test ([payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/)).

## T-10. Tệp, PDF, email

- **Lưu trữ tệp (FR-UPL-01):** code **chỉ dùng API S3** + URL ký sẵn → đổi nơi lưu là đổi cấu hình.

  | Môi trường | Chọn | Lý do |
  |---|---|---|
  | Local (kind) | **SeaweedFS** (Apache 2.0, Go, chạy được một node) | MinIO bản cộng đồng **đã ngừng** (không còn image từ 10/2025, rồi archive) → không dùng |
  | Demo | **Cloudflare R2** | Gói miễn phí ~10 GB, không tính phí băng thông ra *(một nguồn mâu thuẫn — kiểm tra trang giá)*; không tốn RAM VPS |

  Đã cân nhắc: Garage (AGPL 3.0, một nguồn nói cần ≥ 3 node), RustFS (mới, ít lịch sử vận hành).
- **PDF báo cáo (FR-TRN-02):** sinh trong Transparency; chọn giữa **Maroto v2** (thuần Go, font UTF-8, dựa trên gofpdf) và **Typst** (dàn trang tốt nhất, thêm một binary và ngôn ngữ template) sau **spike S-5 kiểm tra đủ 134 chữ cái tiếng Việt có dấu**, gồm chữ mang hai dấu. Gotenberg (Chromium) loại vì quá nặng. CSV bằng thư viện chuẩn; báo cáo lưu kèm mã băm.
- **Email (FR-NTF-01):** Notification gửi qua **SMTP chuẩn**; local **Mailpit**; demo **Brevo** (300 email/ngày miễn phí; hệ thống cũ cũng dùng Brevo). Resend chỉ 100/ngày; SendGrid đã bỏ gói miễn phí từ 05/2025.
- **Bằng chứng (*Trung bình*):**
  - **[Tài liệu]** MinIO bản cộng đồng ngừng phát hành image từ 10/2025, vào chế độ bảo trì rồi archive ([pinggy](https://pinggy.io/amp/blog/minio_archived_self_hosted_s3_alternatives/), [glukhov](https://glukhov.org/data-infrastructure/object-storage/minio-dead/)).
  - **[Tài liệu]** Cloudflare R2: miễn phí ~10 GB, không phí băng thông ra theo phần lớn nguồn ([filebase](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/)).
  - **[Tài liệu]** Tiếng Việt có 134 chữ cái mang dấu, có chữ mang hai dấu → phải test thư viện PDF; Maroto hỗ trợ font UTF-8 tuỳ chỉnh, Typst nhận thư mục font qua `--font-path`.
  - **[Tài liệu]** Email: Brevo 300/ngày; Resend 100/ngày; SendGrid bỏ gói miễn phí 05/2025 ([freetier](https://freetier.co/articles/free-email-sending-tiers-2026)).

## T-11. AI

- **Chọn (đã chốt 2026-10-10):** **tự chạy model mở trên Hugging Face Hub**; spike S-6 chỉ đánh giá **2 ứng viên**:

  | Ứng viên | Giấy phép | Vì sao |
  |---|---|---|
  | **Qwen3-VL-4B-Instruct** (Alibaba Qwen) | Apache 2.0 | Model thị giác đa năng, trả JSON trực tiếp; OCR 32 ngôn ngữ (**chưa xác nhận có tiếng Việt**); có bản 8B cùng họ làm bậc nâng cấp ([model card](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct)) |
  | **Vintern-1B-v3.5** (5CD-AI) | MIT | Chuyên tiếng Việt (vi-MTVQA 41,9 so với 24,8 của model nền); rất nhẹ, có đường chạy CPU bằng llama.cpp; nhưng kém model nền ở DocVQA/OCRBench ([model card](https://huggingface.co/5CD-AI/Vintern-1B-v3_5)) |

  Đã loại khỏi S-6 theo quyết định chủ dự án: PaddleOCR-VL-1.6 và các API trả phí (Anthropic, Gemini, Mistral OCR, FPT.AI). Loại vì giấy phép: LayoutLMv3 (CC BY-NC-SA), Qwen2.5-VL-3B (giấy phép nghiên cứu), Chandra OCR 2 (OpenRAIL-M sửa đổi).
- **Service AI:** **Temporal worker Python** (task queue `ai`) + endpoint health tối thiểu; **không dùng FastAPI**, không có API công khai (`02-decomposition.md` v1.1).
- **Adapter với 5 chế độ** (đổi bằng cấu hình, không sửa code; 4 chế độ dùng giao thức kiểu OpenAI, `hf-zerogpu` dùng API Gradio):

  | Chế độ | Dùng khi | Dữ liệu ra nước ngoài |
  |---|---|---|
  | `fake` | Code hằng ngày, CI — trả **phản hồi thật đã ghi lại** từ model (contract test) | Không |
  | `local` | **Eval S-6** trên RTX 3070 (vLLM trong WSL2 hoặc llama.cpp); chạy offline bằng bản GGUF | Không |
  | `hf-zerogpu` | **Test E2E và demo (mặc định)** — mỗi model một HF Space ZeroGPU (tài khoản free host tối đa 2 Space; GPU 48 GB; quota 5 phút/ngày với tài khoản free, 40 phút với PRO) | **Có** |
  | `modal` | **Dự phòng** khi ZeroGPU xếp hàng lâu, hết quota, hoặc Vintern không chạy được — vLLM trên Modal, tự tắt khi không dùng, trong mức ~$30 credit/tháng của gói Starter *(nguồn bên thứ ba)* | **Có** |
  | `hf-endpoint` | Dự phòng trả phí — HF Inference Endpoint (vLLM), số bản tối thiểu = 0 | **Có** |

- **Phân bổ chạy model (ADR-004, luật 8):** laptop chỉ chạy stack app; test E2E và demo gọi model ở ZeroGPU (app và model chạy song song thật); eval S-6 chạy local vì cần nhiều ảnh, vượt quota ZeroGPU.
- **AI-01 — xác minh chứng từ:**
  - Đầu vào: ảnh phiếu siêu thị/cửa hàng, giấy viết tay/bảng kê, ảnh chụp màn hình chuyển khoản (video không phân tích) + danh sách món đã duyệt + tổng tiền người nộp khai + số đã giải ngân → model trả **JSON theo schema cố định** (ép bằng structured output của vLLM, kiểm tra lại bằng Pydantic): dòng hàng (tên, số lượng, đơn giá, thành tiền), tổng tiền, ngày, người bán, độ tin cậy, cờ (`TOTAL_MISMATCH`, `OVER_DISBURSED`, `ITEM_NOT_APPROVED`, `DECLARED_TOTAL_MISMATCH`, `UNREADABLE`). Ảnh trùng phát hiện bằng perceptual hash trong Operations (FR-DSB-08), không qua model.
  - Phép so sánh số tiền và phát hiện trùng **tính bằng code**, không để model tự cộng.
  - Kết quả chỉ là gợi ý; admin quyết định (NFR-10).
- **AI-04 — tóm tắt báo cáo:** **giai đoạn 1 không dùng AI** — Transparency sinh tóm tắt từ template, số liệu lấy từ sổ cái (FR-TRN-02). AI-04 hạ xuống [C]; nếu làm ở giai đoạn 2: model chỉ viết lại câu chữ, code đối chiếu mọi con số với bản template, lệch → dùng bản template.
- **Eval (NFR-10):**
  - Dữ liệu: MC-OCR 2021 (2.436 hoá đơn tiếng Việt chụp bằng điện thoại, 4 trường — **kiểm tra giấy phép dữ liệu trước khi dùng**) + ảnh tự tạo **bắt buộc đủ 3 loại**: phiếu POS, giấy viết tay/bảng kê, ảnh chụp màn hình chuyển khoản (mỗi loại ≥ 15 ảnh; MC-OCR chủ yếu là phiếu in nên không đại diện cho chợ). Không chứa dữ liệu cá nhân thật. Chỉ số báo cáo **theo từng loại chứng từ**.
  - Chỉ số: khớp chính xác tổng tiền, ngày, người bán; F1 dòng hàng; recall cờ sai lệch; tỉ lệ JSON đúng schema; thời gian xử lý mỗi ảnh trên GPU và CPU; VRAM/RAM tối đa.
  - Luật chọn: model **nhẹ hơn** thắng nếu cả hai đạt ngưỡng (ví dụ tổng tiền đúng ≥ 95% với phiếu in, recall cờ ≥ 90%).
  - CI chấm điểm trên phản hồi đã ghi lại (không cần GPU).
- **Khi cả hai trượt ngưỡng:** thử Qwen3-VL-8B lượng tử 4-bit (local) hoặc bản đầy đủ trên ZeroGPU; vẫn trượt → mở lại đánh giá API hoặc chuỗi OCR (PaddleOCR-VL) + bóc trường.
- **Dữ liệu:** `fake`/`local` giữ dữ liệu trong hệ thống; `hf-zerogpu`/`modal`/`hf-endpoint` gửi ảnh ra nước ngoài → test E2E và demo chỉ dùng ảnh tự tạo; vận hành thật cần xử lý theo Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026).
- **Bằng chứng (*Trung bình*):**
  - **[Tài liệu]** Qwen3-VL-4B: Apache 2.0, OCR 32 ngôn ngữ; Vintern-1B-v3.5: MIT, chuyên tiếng Việt, có số liệu vi-MTVQA/DocVQA/OCRBench trên model card.
  - **[Tài liệu]** HF API (kiểm tra 2026-10-10): Qwen3-VL-4B có nhà cung cấp Featherless đang chạy; Vintern-1B-v3.5 và PaddleOCR-VL-1.6 **không có** nhà cung cấp serverless → demo dùng Inference Endpoints (T4 $0,50/giờ, L4 $0,80/giờ, tính theo phút, tự tắt khi không dùng — [HF pricing](https://huggingface.co/docs/inference-endpoints/en/pricing)).
  - **[Tài liệu]** TGI của HF ở chế độ bảo trì từ 12/2025, HF khuyến nghị vLLM/SGLang ([HF docs](https://huggingface.co/docs/text-generation-inference/en/index.md)) → dùng vLLM/llama.cpp.
  - **[Đo]** Laptop: **RTX 3070 Laptop 8 GB VRAM** (driver 596.21); RAM khả dụng ~4,9 GB khi Docker chưa chạy, committed 20,2 GB > RAM vật lý; 2 khe × 8 GB, máy báo hỗ trợ tối đa 32 GB → chạy model song song với stack app trên laptop không ổn định; đưa model lên ZeroGPU.
  - **[Tài liệu]** ZeroGPU: tài khoản free (email đã xác minh, trên 30 ngày) host tối đa 2 Space; chỉ Gradio SDK; quota GPU theo ngày: free 5 phút, PRO 40 phút; HF Spaces CPU Basic miễn phí phần cứng nhưng tạo Space chạy Gradio/Docker mới cần gói trả phí ([ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu), [Spaces GPUs](https://huggingface.co/docs/hub/spaces-gpus)). Oracle Always Free bị cắt còn 2 OCPU/12 GB từ 15/06/2026 và thu hồi máy nhàn rỗi 7 ngày ([InfoQ](https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)) → loại.
  - **[Requirement]** NFR-07 (AI không chặn duyệt), NFR-10.
  - **Chưa có:** không tìm thấy benchmark nào so các model này trên hoá đơn tiếng Việt → S-6 là nguồn bằng chứng duy nhất.
  - **Rủi ro:** Vintern phụ thuộc một nhóm nhỏ, chưa có bản nào trong năm 2026 → nếu thắng, lưu bản sao trọng số; Qwen3-VL là dự phòng. Vintern cần `trust_remote_code` → kiểm tra khi deploy lên HF Endpoint.

## T-12. Frontend

- **Chọn:** React + TypeScript **có SSR** — Next.js (chạy standalone) hoặc React Router v7, chọn sau một prototype nhỏ *(tình trạng 2026 của hai framework chưa kiểm chứng)*; client API sinh từ OpenAPI.
- **Lý do cần SSR:** trang campaign được **chia sẻ lên Facebook/Zalo** để kêu gọi quyên góp (FR-CMP-08) → thẻ Open Graph (ảnh, tiêu đề, mô tả) phải render phía server; SPA thuần làm việc này kém. Màn admin, bếp vẫn chạy như SPA.
- **Đăng nhập — mô hình BFF:** token OIDC (Keycloak) giữ ở server của frontend, trình duyệt chỉ giữ cookie phiên `HttpOnly` → không lưu token trong trình duyệt.
- **Đã cân nhắc:** SPA thuần (React + Vite — chia sẻ link kém); Go render trang công khai + SPA cho admin (hai cách làm UI phải duy trì).
- **Hệ quả:** thêm một pod Node trong cluster; màn nộp chứng từ ưu tiên điện thoại (FR-DSB-09); thư viện UI chọn khi bắt đầu frontend.
- **Bằng chứng (*Yếu*):**
  - **[Requirement]** FR-CMP-08 (chia sẻ campaign lên mạng xã hội cần thẻ Open Graph render phía server).
  - **[Đánh giá]** Phổ biến, thể hiện kỹ năng frontend cho vị trí SE I tổng quát; BFF tránh lưu token trong trình duyệt. Chưa kiểm chứng tình trạng 2026 của Next.js và React Router v7 → prototype trước khi chọn.

## T-13. Quan sát

- **Chọn:** OpenTelemetry SDK (Go, Python) cho trace và metric; log JSON (`log/slog`) kèm `correlationId` (C-8).

  | Môi trường | Backend | Ghi chú |
  |---|---|---|
  | Local | `otel-lgtm` (Grafana + Loki + Tempo + Prometheus), **tắt mặc định** | Grafana ghi rõ image này chỉ dành cho dev/demo/test; bật khi cần để tiết kiệm RAM |
  | Demo | **Grafana Cloud gói miễn phí** — 10.000 series metric, 50 GB log, 50 GB trace, lưu 14 ngày *(nguồn bên thứ ba — kiểm tra trang giá)* | Không tốn RAM VPS |

- Temporal UI đã cho xem từng bước của mọi quy trình tiền — không cần công cụ riêng cho phần đó.
- **Cảnh báo bắt buộc (NFR-08):** webhook xác thực thất bại, hàng chờ đối soát quá hạn, event vào stream lỗi, báo cáo sắp trễ hạn, workflow lỗi.
- **Bằng chứng (*Trung bình*):**
  - **[Requirement]** NFR-08 (trace xuyên service, cảnh báo).
  - **[Tài liệu]** Image `otel-lgtm` chỉ dành cho dev/demo/test ([Grafana docs](https://grafana.com/docs/opentelemetry/docker-lgtm/)); Grafana Cloud gói miễn phí 10.000 series, 50 GB log, 50 GB trace, lưu 14 ngày ([last9](https://last9.io/blog/grafana-cloud-pricing/), [costbench](https://costbench.com/software/observability/grafana-cloud/free-plan/)).
  - **[Đánh giá]** OpenTelemetry là chuẩn mở, không khoá nhà cung cấp (hệ thống cũ dùng Datadog + Sentry trả phí).

## T-14. Chạy local, CI, deploy

- **Chọn ([ADR-004](#adr-004-kubernetes-từ-ngày-đầu)):** Kubernetes từ ngày đầu — **kind** (node image cố định `kindest/node:v1.35.8`) ở local và CI, **kubeadm một node** cho demo; cùng CNI (Calico), cùng Helm values cho mọi môi trường. Một công cụ dùng cho cả FoodFund và luyện thi CKA/CKAD (kind dựng node bằng kubeadm).
- **Local (NFR-05):** `make up` tạo cluster kind từ file cấu hình trong repo (mở cổng 80/443 bằng `extraPortMappings`), cài hạ tầng (CloudNativePG, Temporal, Keycloak, Traefik, SeaweedFS, Mailpit; NATS khi có consumer đầu tiên; `otel-lgtm` tuỳ chọn), deploy các service, seed dữ liệu mẫu và người dùng mỗi vai trò; `tools/paysim` giả lập thanh toán. Service đang phát triển chạy bằng `go run` nối vào cluster (cách cụ thể chọn ở S-8). Mục tiêu đo được: từ clone sạch đến gọi được API qua Traefik ≤ 10 phút.
- **CI (GitHub Actions)** — mỗi PR:
  - Go: `golangci-lint`, `go test` (unit + integration với testcontainers-go cho Postgres/NATS), ngưỡng coverage theo NFR-06.
  - Python: `ruff`, `pyright`, `pytest`, chấm điểm eval trên phản hồi đã ghi lại.
  - Hợp đồng: `buf lint`, `buf breaking`, kiểm tra code sinh từ OpenAPI.
  - Bảo mật: quét secret (gitleaks), quét lỗ hổng phụ thuộc.
  - **Smoke:** dựng cluster kind bằng `make up`, chạy luồng quyên góp → giải ngân bằng `paysim`.
  - Nhánh mặc định được bảo vệ: CI phải xanh mới merge.
- **Deploy demo:** **kubeadm một node** trên VPS (containerd, Calico, local-path-provisioner, gỡ taint control-plane để chạy workload); Traefik `hostNetwork`; image build trong CI, đẩy lên GitHub Container Registry; deploy bằng `helm upgrade` từ workflow thủ công (không GitOps ở giai đoạn 1); cert-manager cấp chứng chỉ; Cloudflare Tunnel phía trước khi bật.
- **Bằng chứng (*Trung bình*):** đo RAM, máy phát triển và tài liệu Temporal/Bitnami ở ADR-004, thêm:
  - **[Audit]** Hệ thống cũ: `docker-compose up` theo README thất bại (thiếu `.env.docker`, không có Postgres/Redis/Kafka); bước test trong CI bị comment; không có smoke test → cần một lệnh dựng đủ hạ tầng và job smoke trong CI.
  - **[Requirement]** NFR-05, NFR-09, NFR-14; requirements v1.1 đưa Kubernetes vào phạm vi (mục 7.1).

---

# Phần 2 — Quyết định lớn (ADR)

Mỗi ADR ghi bối cảnh, quyết định, phương án đã cân nhắc, hệ quả và điều kiện để xem lại. Kết quả spike liên quan ở [`spikes/s4-s7-s9.md`](./spikes/s4-s7-s9.md).

## ADR-001. PostgreSQL 18

- **Trạng thái:** Đã chấp nhận — 2026-10-10. **Người quyết định:** chủ dự án.
- **Liên quan:** `01-requirements.md` (FR-LED, BR-14, NFR-02, NFR-05, NFR-09), `02-decomposition.md` (mục 3), T-6.
- **Loại quyết định:** cửa một chiều — đổi engine sau này rất đắt (dữ liệu, SQL, công cụ, các thành phần phụ thuộc).

### Bối cảnh

Hệ thống cần một nơi lưu dữ liệu nghiệp vụ cho 6 service và **sổ cái tiền kép**. Dữ liệu cũ (`seed_data/*.sql`) là dump PostgreSQL 17.7 nhưng chỉ chứa dữ liệu demo (35 user, 15 campaign, 11 donation), nên **không dùng được để lập luận về khối lượng**.

### Quyết định

Dùng **PostgreSQL 18** cho mọi service (mỗi service một database và một user riêng), cho Keycloak và cho engine điều phối quy trình. Lên PostgreSQL 19 sau khi bản này có bản vá đầu tiên.

### Dữ liệu làm căn cứ

| # | Dữ liệu | Kết quả | Nguồn |
|---|---|---|---|
| D1 | Hình dạng dữ liệu (đo từ schema cũ) | 36 bảng, 26 khoá ngoại, 13 ràng buộc UNIQUE, 13 enum, 11 cột `jsonb`, 145 index, bảng partition theo tháng → dữ liệu **quan hệ chặt** kèm một phần bán cấu trúc | `seed_data/*.sql` |
| D2 | Yêu cầu nhất quán | Bút toán nhiều dòng phải ghi nguyên tử và cân bằng; dữ liệu tiền chỉ thêm → cần transaction ACID nhiều câu lệnh và constraint trigger hoãn tới cuối transaction | FR-LED, BR-14; [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) |
| D3 | Khối lượng (mô hình xấu nhất, giả định ghi rõ) | 100 campaign × 2.000 donation/năm × ~10 dòng ≈ 2 triệu dòng/năm; đỉnh ~0,3 lượt ghi/giây → **khối lượng không phân biệt được các lựa chọn** | Giả định, không phải đo |
| D4 | Các thành phần khác cùng hỗ trợ | Keycloak: PostgreSQL 14–18; Temporal: PostgreSQL 12+ (gồm advanced visibility, không cần Elasticsearch); DBOS: chỉ PostgreSQL/SQLite → Postgres là engine **duy nhất** mọi ứng viên đều hỗ trợ → chỉ vận hành một loại database | [Keycloak DB](https://www.keycloak.org/server/db), [Temporal visibility](https://docs.temporal.io/self-hosted-guide/visibility), [DBOS Go](https://github.com/dbos-inc/dbos-transact-golang) |
| D5 | Lịch sử, giấy phép, vòng đời | Hệ thống cũ đã chạy PostgreSQL 17.7 managed; PostgreSQL License, quản trị cộng đồng; PG18 GA 25/09/2025, PG19 beta 4 ngày 24/09/2026 | Header dump; [PG19 beta 4](https://www.postgresql.org/about/news/postgresql-19-beta-4-3386/) |

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| MySQL 8.4 | Không mất D1/D5, nhưng không có phương án DBOS (D4); ràng buộc hoãn tới cuối transaction *(theo hiểu biết, chưa kiểm chứng)* |
| MongoDB | Mất khoá ngoại (D1); Keycloak và Temporal không hỗ trợ (D4); giấy phép SSPL |
| TigerBeetle (dùng một mình) | Chỉ có `accounts`/`transfers`, không lưu được dữ liệu nghiệp vụ; khuyến nghị 6 replica cho production. **Mượn mô hình** chuyển khoản hai pha của nó cho sổ cái trong Postgres |
| SQLite | Keycloak không hỗ trợ (D4); nhiều service ghi đồng thời |
| Distributed SQL (CockroachDB, YugabyteDB) | Không có nhu cầu ghi đa vùng |

### Hệ quả

- **Tích cực:** một công nghệ database để vận hành, backup, nâng cấp; ràng buộc ở mức database bảo vệ tiền ngay cả khi code sai; dùng được `uuidv7()` (PG18) cho khoá chính có thứ tự thời gian.
- **Tiêu cực / phải xử lý ngay:**
  - Một instance là điểm hỏng chung → **bắt buộc có backup khôi phục theo thời điểm (PITR)** từ ngày đầu, hoặc dùng Postgres managed khi deploy demo. Có bài kiểm tra khôi phục định kỳ.
  - Các service dùng chung instance có thể ảnh hưởng nhau về tài nguyên → mỗi service một user, giới hạn kết nối theo user.
- **Ràng buộc thiết kế đi kèm:** sổ cái theo ngữ nghĩa chuyển khoản bất biến và chuyển khoản pending/post/void có hạn (giữ tiền giải ngân, VA hết hạn); số dư tính từ bút toán, không cập nhật trực tiếp.

### Triển khai trên Kubernetes (theo ADR-004)

- Chạy bằng operator **CloudNativePG**; PITR qua backup lên object storage của operator; khôi phục được kiểm tra định kỳ ([CloudNativePG docs](https://cloudnative-pg.io/docs/1.30/)).
- **Không dùng chart/image Bitnami** (ADR-004, luật 1).
- **Đã kiểm chứng (spike S-9, 2026-10-11):** Temporal 1.32.0 (chart 1.7.0) tự tạo schema trên **PostgreSQL 18.6** bằng plugin `postgres12_pgx` (schema `temporal` 1.19, `temporal_visibility` 1.14); tạo namespace và chạy workflow thành công. Không cần chạy schema tay, không cần PostgreSQL 17 dự phòng.

### Điều kiện để xem lại quyết định

- Xuất hiện yêu cầu ghi đa vùng toàn cầu.
- Xuất hiện nhu cầu phân tích dữ liệu lớn → thêm database phân tích **bên cạnh**, không thay Postgres.
- Spike S-2 cho thấy không ép được tính cân bằng của bút toán trong Postgres một cách đáng tin cậy.

## ADR-002. Traefik qua Gateway API

- **Trạng thái:** Đã chấp nhận — 2026-10-10; sửa 2026-10-11 theo ADR-004 (kind/kubeadm thay k3d/k3s). **Người quyết định:** chủ dự án.
- **Liên quan:** `01-requirements.md` (NFR-01, NFR-04, NFR-05, NFR-09), `02-decomposition.md` (Gateway, C-7, C-9), T-7, ADR-004.
- **Loại quyết định:** cửa hai chiều nếu giữ các luật ở mục "Luật chống nợ".
- **Đã thay thế:** Caddy (rate limit không có sẵn, cần module cộng đồng — [stackharbor](https://stackharbor.com/en/knowledge-base/caddy-rate-limiting/)).

### Yêu cầu của lớp biên

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

### Quyết định

- **Traefik ≥ 3.7.10** làm controller Gateway API (CVE ở 3.7.0–3.7.6 đã sửa ở 3.7.7 — [CVE-2026-65601](https://app.opencve.io/cve/CVE-2026-65601); 3.7.10 là phiên bản trong báo cáo conformance). Cài bằng **Helm chart chính chủ** với values trong repo (kind và kubeadm đều **không** cài sẵn ingress/gateway controller).
- **Route viết bằng `HTTPRoute` chuẩn**; rate limit và lọc IP là `Middleware` của Traefik gắn qua filter `ExtensionRef` ([Traefik — Kubernetes advanced](https://doc.traefik.io/traefik/expose/kubernetes/advanced/)).
- **Chứng chỉ:** demo dùng cert-manager + Let's Encrypt (HTTP-01 qua listener cổng 80 của Gateway — [NGF + cert-manager](https://docs.nginx.com/nginx-gateway-fabric/traffic-security/integrate-cert-manager/)); local dùng HTTP hoặc chứng chỉ tự ký.
- **Mở cổng 80/443:** local — `extraPortMappings` của node kind + Traefik `hostPort`; demo — Traefik `hostNetwork` (hoặc `hostPort`) trên VPS kubeadm. Không dùng Service `LoadBalancer` (VPS không có cloud LB; cloud-provider-kind là phương án thay thế ở local, xem ADR-004).
- **Cloudflare Tunnel** để giai đoạn sau (mục cuối).

### Phương án đã cân nhắc

Mọi ứng viên chính đều "Conformant" với Gateway API v1.6.x ([danh sách chính thức](https://gateway-api.sigs.k8s.io/docs/implementations/list/)) → khác biệt nằm ngoài phần chuẩn.

| Phương án | Kết luận |
|---|---|
| **Envoy Gateway** | Mô hình chính sách tốt nhất: `SecurityPolicy` (lọc `clientCIDRs`), `ClientTrafficPolicy` (xác định IP gốc), `BackendTrafficPolicy` (rate limit) ([SecurityPolicy](https://gateway.envoyproxy.io/latest/concepts/gateway_api_extensions/security-policy/)). Nặng hơn: control plane mặc định xin 256 Mi (giới hạn 1 Gi) cộng pod Envoy riêng ([Helm values](https://gateway.envoyproxy.io/docs/install/gateway-helm-api/)); nhiều CRD hơn → **phương án dự phòng** |
| NGINX Gateway Fabric | Có `RateLimitPolicy`, nhưng **không tìm thấy lọc IP** (allow/deny thuộc NGINX Ingress Controller — sản phẩm khác) |
| Cilium | Gateway API gắn với CNI Cilium, phải chọn từ lúc tạo cluster; ADR-004 chọn Calico → quá xâm lấn |
| Istio | Service mesh — vượt nhu cầu |
| Kong | Bỏ image OSS từ 3.10 (03/2025) → rủi ro giấy phép |
| ingress-nginx | Đã ngừng hỗ trợ 03/2026 ([nguồn](https://platformengineeringplaybook.com/blog/ingress-nginx-retirement-gateway-api-migration-2026/)) |

### Luật chống nợ

1. **Chỉ dùng `HTTPRoute` chuẩn; không dùng `IngressRoute`** (CRD riêng của Traefik).
2. Phần riêng của Traefik chỉ gồm các `Middleware` có sẵn (`RateLimit`, `IPAllowList`, `Buffering`, `Headers`); **cấm plugin bên thứ ba**.
3. **Không xác thực, không nghiệp vụ ở biên.** Service tự verify JWT (C-7) và chữ ký webhook (C-9). Lọc IP chỉ là lớp phòng thủ thêm, không thay HMAC.
4. Danh sách IP SePay là **cấu hình có ngày kiểm tra lại**.
5. **Code service không đọc header riêng của Cloudflare** hay của proxy; chỉ dùng `X-Forwarded-For` chuẩn do proxy đặt.

### Phương án dự phòng: Envoy Gateway

Kích hoạt khi spike S-7 thất bại.

| Phần | Khi chuyển |
|---|---|
| `HTTPRoute` của 6 service + webhook | Giữ nguyên |
| Rate limit | Viết lại thành `BackendTrafficPolicy` |
| Lọc IP SePay | Viết lại thành `SecurityPolicy` + `ClientTrafficPolicy` |

### IP thật của client (K-4)

IP thật phụ thuộc **đường đi của traffic trước khi tới proxy** — đổi controller không tự giải quyết.

| Môi trường | Đường đi | Kỳ vọng | Trạng thái |
|---|---|---|---|
| Demo (VPS kubeadm) | Internet → cổng 80/443 của VPS → Traefik `hostNetwork` | Traefik nghe trực tiếp trên mạng của máy chủ → thấy IP nguồn thật, không qua NAT của kube-proxy | **Chưa kiểm chứng** — S-7 |
| Demo, nếu dùng `hostPort` thay `hostNetwork` | Qua plugin `portmap` của CNI (DNAT) | DNAT chỉ đổi địa chỉ đích nên IP nguồn thường được giữ | **Chưa kiểm chứng** — S-7 |
| Local (kind trên Docker Desktop) | Windows → Docker Desktop → container node kind (`extraPortMappings`) → Traefik `hostPort` | IP nguồn là địa chỉ nội bộ của Docker, không phải IP thật | Lọc IP ở local chỉ test được bằng cấu hình giả lập (cho phép dải nội bộ) |

### Spike S-7 (bắt buộc, trên VPS kubeadm một node)

1. `IPAllowList` gắn qua `ExtensionRef` hoạt động (có báo lỗi cộng đồng chưa rõ cách xử lý — [thread](https://community.traefik.io/t/error-trying-to-use-basicauth-middleware-in-an-httproute-kubernetes-gateway/29689)) — làm được ngay trên kind.
2. Traefik `hostNetwork` (hoặc `hostPort`) nhận đúng IP thật của request từ bên ngoài — phải làm trên VPS.

Trượt một trong hai → chuyển sang Envoy Gateway.

**Kết quả 2026-10-11:** điểm 1 **đạt** trên kind với Traefik v3.7.14 — `IPAllowList` trả 403, đối chứng dải Docker trả 200, `RateLimit` trả 429 đúng; báo lỗi cộng đồng không tái hiện. Ở local backend chỉ thấy `X-Forwarded-For: 172.18.0.1` (IP nội bộ Docker) như dự đoán. Điểm 2 chưa làm (cần VPS).

### Lớp biên giai đoạn hiện tại (chưa có Cloudflare)

| Trách nhiệm | Đảm nhận |
|---|---|
| Chứng chỉ HTTPS (demo) | cert-manager + Let's Encrypt |
| Định tuyến, chuyển HTTP → HTTPS, rate limit, lọc IP SePay, giới hạn body, header bảo mật, CORS | Traefik |
| Tường lửa VPS | Chỉ mở 80, 443, SSH (chỉ khoá, giới hạn IP nếu được). **API server của kubeadm (cổng 6443) chỉ cho IP quản trị.** Postgres, NATS, Keycloak admin, Temporal UI, dashboard Traefik không công khai |
| Quyền của controller | Controller đọc API Kubernetes với RBAC tối thiểu từ Helm chart — không dùng Docker socket |
| Access log | Traefik ghi log JSON gửi về hệ thống quan sát |

**Rủi ro chấp nhận:** IP máy chủ lộ, không có chống DDoS (rate limit chỉ chống lạm dụng ở tầng ứng dụng).

### Bật Cloudflare Tunnel ở giai đoạn sau

Chuẩn bị ngay từ bây giờ:

| Việc | Vì sao |
|---|---|
| Quản lý DNS tên miền ở Cloudflare từ đầu | Tunnel yêu cầu nameserver Cloudflare |
| Đăng ký webhook SePay/PayOS bằng tên miền, không bằng IP | Bật Tunnel không phải đăng ký lại |
| Upload tệp đi thẳng tới storage bằng URL ký sẵn | Tránh giới hạn của lớp trung gian |
| Luồng không có Cloudflare luôn chạy được và có CI kiểm tra | Cloudflare là lớp tuỳ chọn, rút ra được |

**Spike S-10 trước khi bật:** `cloudflared` chạy trong cluster; lọc IP SePay khi Traefik đứng sau `cloudflared` (chỉ tin header từ pod `cloudflared`, hoặc lọc tại Cloudflare); giới hạn kích thước/thời gian request của Cloudflare gói miễn phí.

### Hệ quả

- **Tích cực:** 1 pod, ít khái niệm; cùng cách cài (Helm) và cách mở cổng (`hostPort`/`hostNetwork`) ở local và demo; route chuẩn nên đổi controller chỉ viết lại 2 chính sách.
- **Tiêu cực:** còn hai điểm chưa kiểm chứng (S-7); chưa có che IP và chống DDoS cho tới khi có Cloudflare.

### Điều kiện để xem lại quyết định

- S-7 thất bại → Envoy Gateway.
- Cần tính năng biên phức tạp hơn (xác thực ở biên, quota theo khách hàng) → đánh giá lại Envoy Gateway.

## ADR-003. Temporal

- **Trạng thái:** Đã chấp nhận — 2026-10-10. **Người quyết định:** chủ dự án.
- **Liên quan:** `01-requirements.md` (BR-01, BR-03, BR-12, FR-PAY-05, FR-TRN-02, NFR-01, NFR-07), `02-decomposition.md` (mục 5, 6), T-4, T-5, ADR-001.
- **Loại quyết định:** gần một chiều — cách viết workflow ngấm vào code nghiệp vụ; đổi engine sau này tốn công viết lại các workflow.
- **Thay thế:** River làm outbox/job/lịch trong tech-stack v0.3 (hồ sơ kiến trúc A).

### Bối cảnh

FoodFund là hệ thống **nặng về quy trình, lưu lượng thấp, đòi hỏi đúng tuyệt đối**. Các quy trình kéo dài, có hẹn giờ và chờ con người:

| Quy trình | Thời gian | Hẹn giờ / chờ tín hiệu | Requirement |
|---|---|---|---|
| VA thanh toán hết hạn | giờ | hẹn giờ | FR-PAY-05 |
| Đóng gây quỹ (chờ giao dịch treo, chốt số liệu) | ngày | hẹn giờ | BR-01 |
| Saga giải ngân (giữ tiền → admin chuyển → fundraiser xác nhận → ghi sổ, hoặc hoàn lại) | giờ–ngày | chờ tín hiệu, có hạn | BR-03, BR-07 |
| Xử lý tiền dư (thông báo → hết hạn phản đối → hoàn tiền → chuyển phần còn lại) | ngày | hẹn giờ + tín hiệu | BR-12 |
| Báo cáo công khai (15 / 30 ngày) | tuần | hẹn giờ | FR-TRN-02 |
| Phân tích chứng từ bằng AI | phút | gọi service Python, có thể lỗi | AI-01, NFR-07 |
| Đối soát hằng ngày | định kỳ | lịch | NFR-01 |

Hệ thống cũ tự xử lý các quy trình này bằng cron + cột trạng thái + outbox tự viết, và hỏng ở đúng những chỗ đó: campaign treo mãi khi phase bị huỷ, cập nhật không nguyên tử, sự kiện hoàn tiền được phát nhưng không có ai xử lý (mục 8 requirements).

### Quyết định

Dùng **Temporal** (tự host) làm lớp điều phối:

- **Server:** Temporal server + Web UI; lưu trạng thái trong **PostgreSQL 18** (database riêng trên cùng instance — ADR-001). PostgreSQL 12+ hỗ trợ cả lưu trữ lẫn advanced visibility, **không cần Elasticsearch** ([Temporal visibility](https://docs.temporal.io/self-hosted-guide/visibility)).
- **Worker:** service Go dùng Temporal Go SDK; service AI dùng Temporal Python SDK (phân tích chứng từ là một activity chạy trên worker Python).
- **Local và CI (kind) / demo (kubeadm một node) — theo ADR-004:** Helm chart chính chủ, **tắt các dependency đóng gói sẵn**, trỏ vào PostgreSQL của CloudNativePG. `temporal server start-dev` (Web UI `localhost:8233`) chỉ dùng cho test tự động và thử nhanh ngoài cluster; dev server **không dành cho production** ([Temporal CLI server](https://docs.temporal.io/cli/server)).
- **PostgreSQL 18 — đã kiểm chứng (S-9, 2026-10-11):** chart 1.7.0 với `manageSchema: true`, plugin `postgres12_pgx` tạo schema thành công trên PG 18.6; workflow chạy được. Với `numHistoryShards: 4`, cả 6 pod Temporal chỉ dùng **~190 MiB**.
- **Giấy phép:** MIT ([temporalio/temporal](https://github.com/temporalio/temporal)).

### Thay đổi so với thiết kế trước

| Trước (hồ sơ A) | Sau |
|---|---|
| River: outbox + job + lịch | **Bỏ.** Retry, hẹn giờ, lịch định kỳ do Temporal đảm nhận |
| Saga giải ngân tự lưu trạng thái trong Funds | Workflow Temporal đọc như code tuần tự |
| Luồng xuyên service dựa hoàn toàn vào event (choreography) | **Điều phối có chủ (orchestration)** cho các quy trình tiền; workflow gọi activity của service khác qua task queue riêng |
| NATS JetStream cho mọi giao tiếp bất đồng bộ | **Chỉ còn phát event tới read model** (Transparency, Notification). Spike S-3 đánh giá bỏ hẳn NATS |

### Danh mục workflow dự kiến

| Workflow | Service sở hữu | Activity ở service khác |
|---|---|---|
| `DonationPaymentWorkflow` (theo dõi VA, hết hạn) | Funds | — |
| `FundingCloseWorkflow` | Campaign | Funds: chốt tổng tiền, phân bổ ngân sách / mở tiền dư |
| `DisbursementWorkflow` (saga) | Funds | Operations: cập nhật trạng thái yêu cầu; Campaign: chuyển phase |
| `SurplusCaseWorkflow` | Funds | Notification: gửi thông báo |
| `ReportDeadlineWorkflow` | Transparency | Funds: đối chiếu số liệu sổ cái |
| `ExpenseProofAnalysisWorkflow` | Operations | AI (Python): trích xuất và gắn cờ |
| `DailyReconciliation` (Temporal Schedule) | Funds | — |

### Luật thiết kế bắt buộc

1. **Workflow phải tất định:** không dùng `time.Now`, goroutine, số ngẫu nhiên, duyệt map không sắp xếp trong code workflow; mọi I/O (DB, HTTP, gọi service) nằm trong **activity** ([Temporal Go versioning](https://docs.temporal.io/develop/go/workflows/versioning)).
2. **Activity idempotent:** activity có thể chạy lại → mọi thao tác ghi dùng khoá chống trùng (ví dụ ràng buộc UNIQUE theo mã giao dịch ngân hàng / ID workflow + bước).
3. **Điểm vào không cần outbox:** webhook đã verify chữ ký → khởi động/gửi tín hiệu tới workflow với **workflow ID tất định** (ví dụ theo mã giao dịch của nhà cung cấp) để Temporal tự chống trùng → activity ghi sổ cái. *(Kiểm chứng trong spike S-3.)*
4. **Phát event cho read model** là một activity chạy **sau** activity ghi DB → giao ít nhất một lần → consumer idempotent (C-3).
5. **Thay đổi workflow đang chạy** dùng cơ chế versioning của Temporal (Worker Versioning hoặc patching); CI chạy **replay test** trên lịch sử workflow đã ghi lại.
6. Temporal server ngừng → workflow **tạm dừng rồi chạy tiếp** khi server lên lại, không mất trạng thái; API đọc và nhận webhook vẫn hoạt động (webhook trả lỗi tạm thời để nhà cung cấp gửi lại).

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| River + NATS + saga tự viết (hồ sơ A) | Phải tự viết trạng thái saga, hẹn giờ nhiều ngày, chờ tín hiệu — đúng chỗ hệ thống cũ hỏng |
| DBOS (thư viện trên Postgres, MIT) | Gọn nhất về hạ tầng nhưng bản Go **chưa 1.0** (0.19, 07/2026) → chưa đặt lên luồng tiền ([DBOS Go](https://github.com/dbos-inc/dbos-transact-golang)) |
| Restate (một binary, có Go SDK) | Giấy phép **BSL 1.1** (được dùng production cho service của mình; sang Apache 2.0 sau 4 năm) ([LICENSE](https://raw.githubusercontent.com/restatedev/restate/main/LICENSE)); độ trưởng thành thấp hơn Temporal |
| Hatchet (MIT, chỉ cần Postgres) | Mạnh về task queue; mô hình saga dài ngày, chờ tín hiệu kém trực quan hơn Temporal |

### Hệ quả

- **Tích cực:** hẹn giờ nhiều ngày, chờ tín hiệu, retry, bù trừ được viết như code tuần tự; Web UI xem từng bước của mọi quy trình tiền (hỗ trợ điều tra và minh bạch); bỏ được River và phần lớn vai trò của NATS; một công cụ điều phối dùng chung cho cả Go và Python.
- **Tiêu cực:**
  - **Đường cong học:** luật tất định và versioning — sai là workflow lỗi khi replay.
  - **Thêm một thành phần phải vận hành:** một phép đo bên thứ ba ghi nhận Temporal ~668 MB + UI ~9 MB (cộng Postgres ~239 MB) khi không dùng Elasticsearch ([Railway](https://railway.com/deploy/temporal-or-durable-workflows-no-elastic)); S-9 đo được ~190 MiB với `numHistoryShards: 4`.
  - Triển khai bằng Helm trên Kubernetes — đúng cách self-host được hỗ trợ chính thức ([Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment)); kéo theo chi phí học Kubernetes (ADR-004).
  - `02-decomposition.md` mục 5–6 phải cập nhật từ choreography sang orchestration cho các luồng tiền.

### Điều kiện để xem lại quyết định

- Spike S-3/S-4/S-9 cho thấy Temporal làm vượt RAM (laptop hoặc VPS demo), vượt mục tiêu chạy local ≤ 10 phút, hoặc không chạy ổn trên PostgreSQL 18 → chuyển sang DBOS (khi có bản Go 1.0) hoặc Restate.
- Sau 2 tuần làm việc với Temporal, luật tất định/versioning làm chậm tiến độ rõ rệt so với kế hoạch.

## ADR-004. Kubernetes từ ngày đầu

kind cho local và CI, kubeadm một node cho demo.

- **Trạng thái:** Đã chấp nhận — 2026-10-10; **sửa 2026-10-11**: đổi từ k3d/k3s sang kind/kubeadm (mục "Lịch sử"). **Người quyết định:** chủ dự án.
- **Liên quan:** `01-requirements.md` (mục 7.1, NFR-05, NFR-09, NFR-14), ADR-001, ADR-002, ADR-003.
- **Loại quyết định:** gần một chiều — manifest, Helm chart và cách vận hành ngấm vào toàn bộ dự án.
- **Thay thế:** "Docker Compose cho local và demo" trong T-14 cũ; mục "Kubernetes ngoài phạm vi" trong requirements 7.1.

### Bối cảnh

- Chủ dự án muốn chạy Kubernetes ngay từ khi bắt đầu, cả ở máy phát triển, và **chỉ dùng một công cụ** để vừa làm FoodFund vừa luyện thi **CKA và CKAD**.
- CKA hiện thi trên **Kubernetes v1.35**, gồm Troubleshooting 30%, Kiến trúc/Cài đặt/Cấu hình cluster 25% (có "tạo và quản lý cluster bằng kubeadm"), Services & Networking 20%, Workloads & Scheduling 15%, Storage 10%; phiên bản thi được cập nhật 4–8 tuần sau mỗi bản Kubernetes mới ([Linux Foundation — CKA](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)).
- Temporal chỉ hỗ trợ chính thức việc tự host bằng Helm chart trên Kubernetes ([Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment)).

**Máy phát triển (đo 2026-10-10/11):** RAM 15,9 GB (2 khe × 8 GB, máy báo hỗ trợ tối đa 32 GB), Ryzen 7 5800H 8 nhân/16 luồng, RTX 3070 Laptop 8 GB VRAM, ổ C trống ~440 GB; Docker Desktop 29.4.1 (WSL2, VM nhận ~7,7 GB RAM).

**RAM đo thực tế (S-4, 2026-10-11):** hạ tầng đầy đủ (kind + Calico + Traefik + CloudNativePG/PG 18.6 + Temporal + Keycloak, chưa có service ứng dụng) dùng **~2,15 GB** trong VM; dựng tuần tự lần đầu **~7,6 phút**. Ước tính ban đầu là 4–6 GB cho cả stack. Chi tiết theo thành phần ở [kết quả spike](./spikes/s4-s7-s9.md).

### Quyết định

| Môi trường | Kubernetes | Ghi chú |
|---|---|---|
| Local | **kind v0.33.0**, node image **cố định `kindest/node:v1.35.8`** (theo digest trong release notes) | kind dựng node **bằng kubeadm** → control plane là static pod trong `/etc/kubernetes/manifests`, giống môi trường thi CKA. Bản mặc định của kind v0.33.0 là v1.37 → **phải cố định** ([kind v0.33.0](https://github.com/kubernetes-sigs/kind/releases/tag/v0.33.0)) |
| CI | **kind**, cùng cấu hình với local | Job smoke trong GitHub Actions |
| Demo | **kubeadm một node** trên VPS (cùng minor version với local) | Local và demo **cùng là kubeadm**; tự dựng VPS (`kubeadm init`, CNI, nâng cấp) chính là bài luyện phần cài đặt của CKA |

**Thành phần hạ tầng trong cluster:**

| Thành phần | Cách cài | Tham chiếu |
|---|---|---|
| CNI | **Calico** v3.32.2 ở cả local (kind với `disableDefaultCNI: true`) và demo — cùng CNI hai môi trường, thực thi NetworkPolicy (có trong đề CKA/CKAD), tốn ~115 MiB. Dự phòng ở local: kindnet mặc định — **đã kiểm chứng 2026-10-11: kindnet trong kind v0.33.0 CÓ thực thi NetworkPolicy** (default-deny chặn đúng), trái với tài liệu minikube | — |
| Lưu trữ | kind có sẵn StorageClass `standard` (local-path); VPS kubeadm cài **local-path-provisioner** | ADR-001 (CloudNativePG cần StorageClass) |
| Lớp biên | Traefik (Gateway API), cài bằng Helm. Mở cổng: local dùng `extraPortMappings` 80/443 của node kind + Traefik `hostPort`; demo dùng Traefik `hostNetwork`/`hostPort` (VPS không có cloud load balancer) | ADR-002 |
| PostgreSQL 18 | Operator **CloudNativePG** (backup + PITR lên object storage) | ADR-001 |
| Temporal | Helm chart chính chủ, tắt dependency đóng gói sẵn | ADR-003 |
| Keycloak | Operator hoặc chart chính chủ (chọn ở S-4) | T-8 |
| NATS | Helm chart chính chủ, khi có consumer đầu tiên | T-4 |
| Chứng chỉ (demo) | cert-manager + Let's Encrypt | ADR-002 |
| Quan sát | `otel-lgtm` — tuỳ chọn, tắt mặc định ở local; demo dùng Grafana Cloud | T-13 |

**Về LoadBalancer:** tài liệu kind hiện giới thiệu **cloud-provider-kind** để cấp LoadBalancer (từ v0.9.0 hỗ trợ cả Ingress và Gateway API) ([kind — Ingress](https://kind.sigs.k8s.io/docs/user/ingress/)). FoodFund chọn `extraPortMappings` + `hostPort` vì tất định, giống cách mở cổng trên VPS kubeadm, và không thêm tiến trình chạy ngoài cluster. cloud-provider-kind là phương án thay thế nếu S-4 cho thấy cách trên bất tiện; khả năng truy cập IP LoadBalancer từ Windows qua Docker Desktop **chưa kiểm chứng**.

### Luật đi kèm

1. **Không dùng Helm chart/image của Bitnami.** Từ 28/08/2025 image chuyển sang `bitnamilegacy` và không còn cập nhật bảo mật ([GitLab](https://gitlab.com/gitlab-com/gl-infra/production-engineering/-/issues/27125), [Broadcom](https://vcf.broadcom.com/vsc/bitnamiAnnouncement.pdf)). Chỉ dùng chart/operator chính chủ.
2. **Cố định phiên bản** mọi chart, image và **node image của kind** (theo digest); không dùng `latest`. Local và demo cùng minor version Kubernetes.
3. **Một đường chạy duy nhất:** `make up` kiểm tra công cụ (Docker, kind, kubectl, helm), tạo cluster kind từ file cấu hình trong repo, cài hạ tầng, deploy service, seed dữ liệu. Không duy trì song song Compose.
4. **Mọi pod khai báo `requests`/`limits`.**
5. **Service sẵn sàng cho Kubernetes (NFR-14):** cấu hình qua biến môi trường, `/healthz` và `/readyz`, tắt êm khi nhận SIGTERM, log JSON ra stdout, không ghi trạng thái ra đĩa cục bộ.
6. **Không làm ở giai đoạn 1:** GitOps (ArgoCD/Flux), nhiều node cho stack app, service mesh, autoscaling. Deploy demo bằng `helm upgrade`.
7. **Vòng lặp code nhanh:** service đang phát triển chạy trực tiếp trên máy (`go run`) nối vào hạ tầng trong cluster qua port-forward; hoặc nạp image bằng `kind load docker-image` — chọn ở spike S-8.
8. **Phân bổ chạy model AI.** Laptop chỉ chạy stack app; test E2E và demo gọi model ở **HF Spaces ZeroGPU** (dự phòng Modal, rồi HF Endpoint); eval S-6 chạy model local trên RTX 3070 (không bật app; bằng container Docker có GPU hoặc llama.cpp trên Windows, vì distro Ubuntu đã gỡ); code hằng ngày và CI dùng chế độ `fake` với phản hồi thật đã ghi lại. Nâng RAM lên 32 GB là phương án nếu stack app vẫn quá chật.
9. **Cluster luyện thi tách khỏi cluster FoodFund.** Luyện CKA/CKAD trên cluster kind riêng (có thể nhiều node), **không chạy cùng lúc** với stack FoodFund vì RAM; xoá khi xong (`kind delete cluster --name …`).
10. **Bộ nhớ của WSL.** VM WSL giữ cache file mà không trả cho Windows. Đã đặt `%UserProfile%\.wslconfig` với `[wsl2] memory=6GB` (có hiệu lực). `autoMemoryReclaim` không thu hồi cache khi cluster đang chạy, nên khi cần RAM thì chạy `wsl -d docker-desktop -u root -- sh -c "sync; echo 3 > /proc/sys/vm/drop_caches"` (trả lại ~2,9 GB); nên đưa thành `make reclaim`.

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| k3d (local) + k3s (demo) — *quyết định cũ* | Nhẹ nhất, có sẵn LB, nhưng k3s gộp control plane vào một binary, không dùng kubeadm → không luyện được phần nặng điểm nhất của CKA; chủ dự án muốn một công cụ cho cả dự án và luyện thi |
| minikube | Nhiều addon nhất nhưng nặng nhất; GPU không hỗ trợ trên Windows desktop; không sát CKA bằng kind |
| Docker Desktop Kubernetes (chế độ kind) | Cần đăng nhập Docker, đổi sang containerd image store; khó cố định phiên bản hơn kind CLI |
| Talos | Hướng production, không dùng kubeadm |
| kubeadm trên VM ở local | Sát CKA nhất nhưng mỗi VM ~2 GB — không đủ RAM để chạy cùng stack; phần này được luyện trên VPS demo |
| k3s cho demo, kind cho local | Local và demo khác bản phân phối (khác cách mở cổng, lưu trữ, LB) → hai bộ cấu hình |
| Kubernetes managed (EKS/GKE/DOKS) cho demo | Vượt ngân sách NFR-09 |

### Hệ quả

- **Tích cực:** một công cụ cho FoodFund, CKAD và CKA; local và demo cùng là kubeadm, cùng CNI; đúng phiên bản thi (1.35); Temporal chạy đúng cách triển khai chính thức; PITR qua CloudNativePG.
- **Tiêu cực:**
  - **Nặng hơn k3d** (control plane đầy đủ) trên laptop vốn đã chật RAM → đo ở S-4; Calico thêm RAM so với kindnet.
  - **Mất các tiện ích sẵn có của k3s**: LB (thay bằng `extraPortMappings`/`hostPort`), lưu trữ local-path trên VPS (cài thêm).
  - **VPS demo nhiều việc vận hành hơn k3s**: tự cài container runtime, kubeadm, CNI, local-path-provisioner, tự nâng cấp — đổi lại là bài luyện CKA thật.
  - NFR-05: người lạ cần Docker + kind + kubectl + helm; kéo node image ~vài trăm MB → đo ở S-4.

### Spike liên quan

- **S-4** (một phần đạt), **S-7** (phần 1 đạt, phần 2 cần VPS), **S-9** (đạt): [kết quả](./spikes/s4-s7-s9.md).
- **S-8:** cách code nhanh với cluster local — chưa làm.

### Điều kiện để xem lại quyết định

- S-4 cho thấy không chạy đủ stack trên laptop 16 GB dù đã tắt phần tuỳ chọn và dùng kindnet → nâng RAM 32 GB, hoặc quay lại k3d cho local (vẫn giữ kind cho luyện thi).
- S-8 cho thấy mỗi vòng sửa–chạy vượt ~30 giây với mọi cách đã thử.

### Lịch sử

- **2026-10-10:** chọn k3d (local, CI) + k3s một node (demo) — nhẹ nhất, có sẵn LB.
- **2026-10-11:** đổi sang kind + kubeadm vì chủ dự án muốn một công cụ dùng cho cả dự án và luyện thi CKA/CKAD; k3d đã gỡ khỏi máy, kind v0.33.0 đã cài (checksum khớp bản phát hành).

---

# Phần 3 — Chi phí, spike, cấu trúc repo

## Ước tính chi phí demo

Mục tiêu NFR-09: ≤ ~25 USD/tháng.

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| VPS 4 vCPU / 8 GB RAM | ~7–15 USD | Giá Hetzner đang thay đổi trong năm 2026 và gói rẻ có lúc hết hàng ([findstack](https://findstack.com/resources/hetzner-price-increase-2026), [bitdoze](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans)) *(chưa kiểm chứng)* |
| Tên miền | ~1 USD | |
| Model AI (HF ZeroGPU) | 0 USD | 2 Space miễn phí; dự phòng Modal trong mức credit miễn phí |
| Cloudflare R2, Brevo, Grafana Cloud | 0 USD | Gói miễn phí *(kiểm tra trang giá trước khi deploy)* |
| **Tổng** | **~8–16 USD** | |

**RAM dự kiến trên VPS:** kubeadm control plane + Calico ~0,8–1,2 GB *(chưa đo)* · Postgres ~0,5–1 GB · Keycloak ~1,25 GB · NATS < 100 MB · Temporal + UI ~0,7 GB *(số đo bên thứ ba, chưa đo)* · 6 tiến trình Go ~30–80 MB mỗi cái · AI worker (Python, không chạy model) ~150 MB · frontend Node ~150–300 MB · Traefik < 100 MB *(chưa đo)* → **~4–5 GB**, vừa VPS 8 GB (model ở ZeroGPU; lưu trữ, email, quan sát dùng dịch vụ ngoài) *(đo lại trong spike S-4)*.

## Spike kỹ thuật

Kết quả spike ghi ở `docs/spikes/` rồi cập nhật vào hạng mục hoặc ADR liên quan.

| Mã | Câu hỏi cần trả lời | Ảnh hưởng | Trạng thái (2026-10-17) |
|---|---|---|---|
| S-1 | SePay sandbox: tạo VA theo đơn hàng, giả lập thanh toán, nhận webhook đã ký end-to-end? Có tiền tố VA riêng cho mỗi campaign không? Thuật toán ký webhook PayOS? | T-9, BR-11 | Chủ dự án đã làm (2026-10-11), chưa có tài liệu kết quả riêng. Đã dùng: SePay và PayOS theo dõi cùng tài khoản; định danh giao dịch là `id` ([thiết kế luồng tiền D-8](./spikes/money-flow/design.md#2-quyết-định)) |
| S-2 | Kiểm tra cân bằng bút toán bằng constraint trigger hoãn + quyền chỉ INSERT hoạt động đúng với `pgx`/`sqlc`? | T-6, FR-LED | Gộp với S-3 thành [spike luồng tiền](./spikes/money-flow/plan.md); đang làm |
| S-3 | Saga giải ngân trên Temporal + Postgres: giữ tiền → chờ tín hiệu có hạn → ghi sổ hoặc hoàn lại; webhook khởi động workflow với ID tất định (chống trùng); replay test; có bỏ được NATS không | T-4, T-5, ADR-003 | Như S-2 |
| S-4 | Đo thời gian `make up` (kind + Calico) từ máy sạch và RAM thực tế (đặc biệt Keycloak, Temporal, control plane); test NetworkPolicy default-deny trên Calico và kindnet | NFR-05, NFR-09 | Một phần ([kết quả](./spikes/s4-s7-s9.md)): hạ tầng ~2,15 GB, dựng ~7,6 phút; chưa đo service ứng dụng và lần chạy thứ hai |
| S-5 | PDF: Maroto v2 vs Typst với đủ 134 chữ cái tiếng Việt có dấu (gồm chữ hai dấu), kiểm tra bằng trích xuất văn bản; SeaweedFS chạy một node trong kind; xác nhận gói miễn phí R2, Brevo, Grafana Cloud | T-10, T-13 | Chưa làm |
| S-6 | (a) Eval AI-01: Qwen3-VL-4B vs Vintern-1B-v3.5 trên MC-OCR + ảnh tự tạo đủ 3 loại (phiếu POS, viết tay, chuyển khoản), báo cáo theo từng loại, chạy **local** trên RTX 3070 (đo cả CPU). (b) Deploy 2 Space ZeroGPU (Gradio): Vintern với `trust_remote_code` có chạy không; thời gian mỗi lần gọi; quota có trừ vào tài khoản của token gọi không; thời gian chờ khi Space ngủ/xếp hàng. (c) Nếu (b) trượt: deploy lên Modal | T-11, ADR-004 | Chưa làm |
| S-7 | Traefik: `IPAllowList` gắn qua `ExtensionRef` hoạt động (làm trên kind); Traefik `hostNetwork`/`hostPort` nhận đúng IP thật từ bên ngoài (làm trên VPS kubeadm) — trượt → Envoy Gateway | T-7, ADR-002 | Phần 1 (kind) đạt; phần 2 cần VPS |
| S-8 | Vòng lặp code nhanh với cluster local: `go run` + port-forward hay công cụ đồng bộ code vào pod (kiểm tra tình trạng bảo trì của Tilt) | T-14, ADR-004 | Chưa làm |
| S-9 | Temporal trên PostgreSQL 18: công cụ quản lý schema có hỗ trợ không, hay phải chạy thủ công / dùng PG17 riêng | T-5, T-6, ADR-001, ADR-003 | Đạt: Temporal 1.32 tự tạo schema trên PG 18.6 |
| S-10 | Trước khi bật Cloudflare Tunnel: `cloudflared` trong cluster, lọc IP SePay phía sau tunnel, giới hạn request của Cloudflare gói miễn phí | T-7, ADR-002 | Chưa làm |

T-12 không cần spike: quyết định theo đánh giá, dễ thay sau.

## Cấu trúc repo dự kiến

```
foodfund/
├── services/
│   ├── identity/        # Go
│   ├── campaign/        # Go
│   ├── funds/           # Go (module: payment, reconciliation, ledger, disbursement, refund-surplus, approval)
│   ├── operations/      # Go
│   ├── transparency/    # Go
│   ├── notification/    # Go worker
│   └── ai/              # Python (uv)
├── libs/                # Go dùng chung: auth, events (publish/subscribe/inbox), observability, testkit
├── proto/               # Protobuf: event + RPC nội bộ (buf)
├── api/                 # OpenAPI spec từng service
├── web/                 # React + TypeScript có SSR + BFF (Next.js hoặc React Router v7)
├── tools/paysim/        # Giả lập webhook SePay/PayOS đã ký
├── deploy/              # cấu hình cluster kind, Helm values (hạ tầng + service), HTTPRoute, realm Keycloak, seed
├── docs/                # requirements, decomposition, tech-stack (gồm ADR), spikes/
└── go.work
```

## Trạng thái duyệt

- **2026-10-11:** chủ dự án duyệt toàn bộ T-1 … T-14 theo bảng tóm tắt (mục 0).
- Điều chỉnh requirement đi kèm: **giữ FR-PAY-02 (PayOS) ở [M]** (rút lại đề xuất hạ xuống [S]); thêm **FR-CMP-08** (chia sẻ campaign lên mạng xã hội có ảnh xem trước).
- **2026-10-17:** gộp 4 file ADR vào Phần 2; bằng chứng của từng hạng mục chuyển từ phụ lục vào chính hạng mục đó. Nội dung quyết định không đổi.

---

## Phụ lục — Phép đo Go vs Python (2026-10-09)

**Mục đích:** có số liệu cho T-1 thay vì khẳng định chung chung.

**Môi trường:** Windows 11 Pro, Go 1.26.2, Python 3.13.3, FastAPI 0.143.0, uvicorn 0.54.0, pydantic 2.14.0. Docker không chạy nên không đo được Keycloak, NATS, Postgres.

**Phương pháp:** mỗi bên một endpoint `GET /health` trả JSON. Chạy tiến trình, đo thời gian tới khi trả lời được request đầu tiên; nghỉ 2 giây rồi đo working set của **cả cây tiến trình** (cả hai bên đều có một tiến trình console host đi kèm; với Python còn có trình khởi chạy của venv); gửi 1.000 request tuần tự từ PowerShell. Lặp 3 lần.

| Lần | Service | Khởi động (ms) | RAM nghỉ (MB) | RAM sau 1.000 request (MB) | 1.000 request (ms) |
|---|---|---|---|---|---|
| 1 | Go `net/http` | 624 | 20,1 | 23,3 | 169 |
| 1 | FastAPI + uvicorn | 1.110 | 62,4 | 62,5 | 550 |
| 2 | Go `net/http` | 523 | 20,1 | 23,3 | 117 |
| 2 | FastAPI + uvicorn | 1.103 | 62,4 | 62,5 | 517 |
| 3 | Go `net/http` | 524 | 20,1 | 24,6 | 111 |
| 3 | FastAPI + uvicorn | 1.091 | 62,5 | 62,6 | 518 |

**Kết luận:** trong phép đo này Go dùng RAM ít hơn ~3 lần và khởi động nhanh hơn ~2 lần.

**Giới hạn — đọc trước khi trích dẫn:**
- Chỉ là hello-world; service thật có driver DB, client NATS, SDK nên số tuyệt đối sẽ khác.
- Đo trên Windows, không phải container Linux như khi deploy.
- Thời gian 1.000 request gồm cả chi phí phía client PowerShell; không phải benchmark hiệu năng.
