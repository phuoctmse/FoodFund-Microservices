# FoodFund (bản viết lại) — Lựa chọn công nghệ

> **Trạng thái:** NHÁP v0.1 — 2026-10-09 — chờ chủ dự án duyệt.
> **Đầu vào:** [`01-requirements.md`](./01-requirements.md) v1.0, [`02-decomposition.md`](./02-decomposition.md) v1.0.
> **Đã chốt trước:** Go cho 5 service lõi (Identity & Org, Campaign, Funds, Operations, Transparency) và Notification worker; Python cho service AI.
> **Quy ước:** mỗi quyết định ghi *Chọn / Đã cân nhắc / Lý do / Hệ quả*. Thông tin ghi *(chưa kiểm chứng)* phải được xác nhận trong các spike ở mục 13 trước khi viết plan triển khai.

---

## 0. Tóm tắt

| # | Hạng mục | Chọn |
|---|---|---|
| T-1 | Ngôn ngữ | Go (bản ổn định mới nhất) cho service lõi; Python ≥ 3.12 cho AI |
| T-2 | API phía client | REST + OpenAPI, sinh code từ spec |
| T-3 | Gọi đồng bộ nội bộ (chỉ đọc) | ConnectRPC + Protobuf, quản lý bằng `buf` |
| T-4 | Event bus | NATS JetStream; event định nghĩa bằng Protobuf |
| T-5 | Outbox / job / lịch | Bảng outbox + job queue chạy trên Postgres (River) trong từng service |
| T-6 | Cơ sở dữ liệu | PostgreSQL; mỗi service một database; truy cập bằng `pgx` + `sqlc`; migration bằng `goose` |
| T-7 | Gateway | Caddy (TLS, định tuyến, giới hạn tần suất); xác thực token trong từng service |
| T-8 | Danh tính | Keycloak (OIDC, đăng nhập Google qua identity brokering) |
| T-9 | Thanh toán | SePay API v2 — VA theo đơn hàng (chính); PayOS (phụ) — sau lớp adapter chung |
| T-10 | Tệp, PDF, email | Lưu trữ tương thích S3; PDF sinh trong Transparency; email qua SMTP (local: Mailpit) |
| T-11 | AI | FastAPI + Anthropic Python SDK, model `claude-opus-5-5`, structured outputs |
| T-12 | Frontend | React + TypeScript (Vite), client sinh từ OpenAPI |
| T-13 | Quan sát | OpenTelemetry; log JSON (`log/slog`); local: một container Grafana LGTM |
| T-14 | Chạy local, CI, deploy | Docker Compose; GitHub Actions; một VPS chạy Compose cho môi trường demo |

---

## T-1. Ngôn ngữ

- **Chọn:** Go cho Identity & Org, Campaign, Funds, Operations, Transparency, Notification worker; Python ≥ 3.12 cho AI.
- **Đã cân nhắc:** Python cho tất cả; TypeScript lõi + Python AI.
- **Lý do:** kiểu tĩnh và xử lý lỗi tường minh phù hợp code tiền (NFR-01); mỗi service là một binary nhỏ, ít RAM — quan trọng cho chạy local ≤ 10 phút (NFR-05) và chi phí demo (NFR-09). Python dùng cho AI vì hệ sinh thái và SDK.
- **Hệ quả:** hai bộ công cụ (Go: `golangci-lint`, `go test`; Python: `uv`, `ruff`, `pyright`, `pytest`). Hợp đồng giữa hai ngôn ngữ chỉ qua Protobuf event (T-4), không chia sẻ code.

## T-2. API phía client

- **Chọn:** REST + JSON, **OpenAPI-first** — viết spec trước, sinh server stub Go (`oapi-codegen`) và client TypeScript cho web.
- **Đã cân nhắc:** GraphQL Federation (như hệ thống cũ).
- **Lý do:** web tối thiểu (mục 7.1 requirements) không cần truy vấn linh hoạt; Transparency đã là read model gộp dữ liệu (D-3) nên không cần federation để ghép. Federation trong Go cần thêm router và thư viện riêng — tăng độ phức tạp mà không giải quyết requirement nào. Spec OpenAPI đồng thời là tài liệu API và cơ sở cho contract test.
- **Hệ quả:** mỗi service công bố một file `openapi.yaml`; CI kiểm tra code sinh ra khớp spec.

## T-3. Gọi đồng bộ nội bộ

- **Chọn:** ConnectRPC (`connect-go`) + Protobuf; schema quản lý bằng `buf` (lint + `buf breaking`).
- **Đã cân nhắc:** REST nội bộ; gRPC thuần.
- **Lý do:** chỉ có vài truy vấn đọc (ngân sách còn lại, tổng tiền đã nhận — mục 5 decomposition), nhưng cần hợp đồng có kiểu và kiểm tra thay đổi phá vỡ (C-6). Connect chạy trên HTTP thường, dễ debug bằng `curl`, dùng chung Protobuf với event.
- **Hệ quả:** thư mục `proto/` chung; `buf breaking` chạy trong CI.

## T-4. Event bus

- **Chọn:** NATS JetStream. Mỗi bounded context một stream; consumer bền (durable) cho mỗi service tiêu thụ; payload là Protobuf có `schemaVersion`.
- **Đã cân nhắc:** Kafka (hệ thống cũ), RabbitMQ, Redis Streams.
- **Lý do:** một binary nhẹ, chạy local nhanh; có lưu bền, ack, gửi lại, giới hạn số lần gửi — đủ cho C-3/C-4. Kafka quá nặng cho một VPS demo và một người vận hành.
- **Hệ quả:** dead-letter (C-4) hiện thực bằng giới hạn số lần gửi + chuyển sang stream lỗi; cần thư viện nội bộ nhỏ `libs/events` (publish, subscribe, inbox) dùng chung cho các service Go. Service AI dùng client NATS cho Python.

## T-5. Outbox, job, lịch tự động

- **Chọn:** job queue chạy trên Postgres (**River**) trong từng service Go: ghi dữ liệu nghiệp vụ và chèn job "publish event" **trong cùng một transaction** (đây chính là transactional outbox — C-2); job đẩy event lên NATS, River lo thử lại. Lịch tự động (đóng gây quỹ, huỷ link treo, nhắc hạn báo cáo, đối soát hằng ngày) dùng job định kỳ của River.
- **Đã cân nhắc:** tự viết bảng outbox + tiến trình relay; cron riêng.
- **Lý do:** bớt code tự viết cho phần dễ sai (relay, retry, khoá khi chạy nhiều bản); job định kỳ không chạy trùng.
- **Hệ quả:** phụ thuộc River *(chưa kiểm chứng: giấy phép bản miễn phí và tính năng job định kỳ — spike S-3)*. Phương án dự phòng: bảng outbox tự viết (~200 dòng).

## T-6. Cơ sở dữ liệu

- **Chọn:** PostgreSQL. Môi trường local/demo: **một instance, mỗi service một database và một user riêng** (không có quyền sang database khác). Truy cập bằng `pgx` + `sqlc` (SQL viết tay, sinh code có kiểu); migration bằng `goose`.
- **Đã cân nhắc:** ORM (GORM, ent).
- **Lý do:** sổ cái cần kiểm soát transaction và câu SQL tường minh; `sqlc` bắt lỗi SQL lúc build.
- **Sổ cái & audit (FR-LED, NFR-02, BR-14):**
  - Tiền lưu `BIGINT` (VND, không phần thập phân).
  - Bảng `postings` và `audit_log`: user ứng dụng **không có quyền UPDATE/DELETE** (cấp quyền ở mức database), chỉ INSERT.
  - Mỗi `journal_entry` cân bằng (tổng nợ = tổng có): kiểm tra bằng constraint trigger hoãn đến cuối transaction, kèm test.
  - Khoá ngoại không dùng `ON DELETE CASCADE` cho dữ liệu tiền/chứng từ.
- **Hệ quả:** một instance là điểm hỏng chung ở môi trường demo — chấp nhận được với phạm vi portfolio; ranh giới database vẫn tách để có thể tách instance sau.

## T-7. Gateway

- **Chọn:** Caddy làm reverse proxy: TLS tự động, định tuyến `/api/{service}/…` và `/webhooks/{provider}` tới service, giới hạn tần suất cho webhook. **Xác thực token (JWT từ Keycloak) thực hiện trong từng service** bằng middleware dùng chung `libs/auth`; kiểm tra quyền sở hữu tài nguyên tại service sở hữu dữ liệu (C-7).
- **Đã cân nhắc:** tự viết gateway Go; Envoy; KrakenD.
- **Lý do:** gateway không chứa nghiệp vụ (decomposition mục 2) nên không cần viết code; xác thực ở service là phòng thủ nhiều lớp và test được bằng unit test.
- **Hệ quả:** **điều chỉnh nhỏ so với `02-decomposition.md`:** gateway không xác thực token, chỉ TLS + định tuyến + giới hạn tần suất (đã cập nhật dòng Gateway trong tài liệu đó).

## T-8. Danh tính

- **Chọn:** Keycloak — OIDC; đăng nhập Google qua identity brokering; realm và người dùng mẫu cho từng vai trò được import tự động khi khởi động local.
- **Đã cân nhắc:** Zitadel, Ory, dịch vụ quản lý (Cognito như hệ thống cũ, Auth0…).
- **Lý do:** chạy được hoàn toàn local, không cần credential cloud (NFR-05); chuẩn OIDC nên đổi nhà cung cấp sau không ảnh hưởng service; phổ biến, dễ giải thích khi phỏng vấn. Tài nguyên tối thiểu khoảng 1,25 GB RAM theo một bài so sánh *(chưa kiểm chứng với tài liệu chính thức — spike S-4)*.
- **Hệ quả:** vai trò và tổ chức **không** lưu trong Keycloak — Identity & Org là nguồn sự thật (FR-ID-02); token chỉ mang `sub`, service tra vai trò hiện tại từ projection của Identity & Org. Tránh được tình huống vai trò đã đổi nhưng token cũ vẫn mang vai trò cũ.

## T-9. Thanh toán

- **Chọn:**
  - **SePay API v2 — "VA theo đơn hàng"** là kênh chuyển khoản chính: mỗi khoản quyên góp được cấp một tài khoản ảo riêng, **ngân hàng chỉ chấp nhận đúng số tiền**, VA tự huỷ sau khi thanh toán hoặc hết hạn ([SePay — VA theo đơn hàng](https://developer.sepay.vn/en/sepay-api/api-va-theo-don-hang)). Sandbox `https://userapi-sandbox.sepay.vn/v2` hỗ trợ giả lập thanh toán VA cho BIDV, Sacombank, Vietcombank, VietinBank, Shinhan ([SePay Sandbox](https://developer.sepay.vn/en/sepay-api/v2/sandbox)). API v1 đã ngừng phát triển.
  - **PayOS** là kênh thứ hai; webhook có chữ ký và có môi trường test ([payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/)) *(thuật toán ký chưa đọc — spike S-1)*.
  - Cả hai sau một interface `PaymentProvider` trong module `payment` của Funds; mỗi provider có **trình giả lập** (`tools/paysim`) gửi webhook đã ký để test và chạy local.
- **Lý do:** VA theo đơn hàng khớp giao dịch theo số tài khoản thay vì nội dung chuyển khoản → loại bỏ phần lớn ca "không khớp", "chuyển thiếu/dư" của hệ thống cũ (mục 8 requirements). Webhook SePay được xác thực bằng HMAC-SHA256 hoặc API key ([SePay webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)).
- **Hệ quả & đề xuất điều chỉnh requirement (cần chủ dự án duyệt):**
  1. **FR-PAY-02 (PayOS) hạ từ [M] xuống [S]** — làm SePay VA trước; PayOS thêm sau khi luồng chính ổn định.
  2. **BR-11 (định danh nhận tiền riêng mỗi campaign):** VA theo đơn hàng cho định danh riêng *mỗi khoản quyên góp* dưới tài khoản chính của nền tảng; việc dùng **tiền tố VA riêng cho mỗi campaign** *(chưa kiểm chứng — spike S-1)* sẽ quyết định BR-11 đáp ứng ở mức nào. Mô hình dữ liệu vẫn gắn mọi VA với campaign.
  3. FR-PAY-03 (chuyển thiếu/dư) và FR-PAY-10 (hàng chờ đối soát) **vẫn giữ** cho PayOS và cho tiền vào tài khoản chính ngoài VA.

## T-10. Tệp, PDF, email

- **Lưu trữ tệp:** API tương thích S3, URL ký sẵn (FR-UPL-01). Local: một trình giả lập S3 trong Compose; demo: dịch vụ object storage có gói miễn phí *(lựa chọn cụ thể và giấy phép của trình giả lập — spike S-5)*.
- **PDF báo cáo (FR-TRN-02):** sinh trong Transparency bằng thư viện PDF thuần Go hỗ trợ font Unicode tiếng Việt *(chọn thư viện sau khi kiểm tra tình trạng bảo trì — spike S-5)*; CSV bằng thư viện chuẩn. Báo cáo được lưu kèm mã băm để chứng minh bất biến.
- **Email (FR-NTF-01):** Notification gửi qua SMTP; local dùng **Mailpit** để xem email; demo dùng một nhà cung cấp email giao dịch có gói miễn phí *(chưa kiểm chứng hạn mức)*.

## T-11. AI

- **Chọn:** service Python: **FastAPI** (health, endpoint nội bộ chạy lại phân tích) + consumer NATS; **Anthropic Python SDK**; model **`claude-opus-5-5`**.
- **AI-01 — xác minh chứng từ:**
  - Ảnh hoá đơn + danh sách món đã duyệt + số đã giải ngân → **structured outputs** (`client.messages.parse()` với model Pydantic) trả về: danh sách dòng hàng (tên, số lượng, đơn giá, thành tiền), tổng tiền, ngày, nhà cung cấp, độ tin cậy, danh sách cờ (`TOTAL_MISMATCH`, `OVER_DISBURSED`, `ITEM_NOT_APPROVED`, `DUPLICATE_SUSPECTED`, `UNREADABLE`).
  - Phép so sánh số tiền và phát hiện trùng **tính bằng code** từ dữ liệu trích xuất, không để model tự cộng.
  - Kết quả chỉ là gợi ý; admin quyết định (NFR-10).
- **AI-04 — tóm tắt báo cáo:** đầu vào là số liệu đã chốt từ báo cáo; model chỉ diễn đạt. Không gấp nên có thể dùng Batch API (giảm 50% chi phí).
- **Cấu hình model:**
  - `output_config.effort` đặt **tường minh** (mặc định của model này là `medium`); bắt đầu ở `low` cho AI-01 và chỉ tăng nếu eval cho thấy cần.
  - Prompt hệ thống cố định đặt trước, bật prompt caching.
  - Bật **fallback phía server** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) để yêu cầu bị từ chối được chạy lại trên model dự phòng; luôn kiểm tra `stop_reason` trước khi đọc kết quả.
- **Kiểm soát chi phí:** giới hạn ngân sách tháng trong service (đếm `usage` từng lần gọi, vượt ngưỡng → tạm dừng phân tích và cảnh báo, luồng duyệt vẫn chạy — NFR-07); giới hạn kích thước ảnh. Giá tham khảo `claude-opus-5-5`: $4 / $20 cho mỗi triệu token vào/ra *(chi phí mỗi hoá đơn cần đo thực tế bằng eval)*.
- **Eval (NFR-10):**
  - Tập 30–50 ảnh hoá đơn có nhãn (tự thu thập/tự tạo, không chứa dữ liệu cá nhân thật), kèm JSON đáp án.
  - Chỉ số: khớp tổng tiền, F1 dòng hàng, precision/recall cho từng loại cờ.
  - CI chạy phần chấm điểm trên **phản hồi đã ghi lại** (không tốn tiền); chạy eval thật thủ công hoặc định kỳ với trần chi phí.
- **Dữ liệu:** ảnh hoá đơn được gửi tới API của Anthropic — ghi rõ trong tài liệu dự án; không gửi thông tin donor.

## T-12. Frontend

- **Chọn:** React + TypeScript (Vite); client API sinh từ OpenAPI; đăng nhập OIDC với Keycloak.
- **Đã cân nhắc:** Go render HTML + htmx.
- **Lý do:** thể hiện được phía client cho vị trí SE I tổng quát; client có kiểu sinh từ spec giảm lỗi tích hợp. Phạm vi giữ đúng các màn hình ở mục 7.1 requirements.
- **Hệ quả:** thư viện UI chọn khi bắt đầu frontend; không đặt mục tiêu thiết kế cầu kỳ.

## T-13. Quan sát

- **Chọn:** OpenTelemetry SDK (Go, Python) cho trace và metric; log JSON qua `log/slog` kèm `correlationId` (C-8). Local: một container Grafana LGTM (Grafana + Loki + Tempo + Prometheus). Demo: chạy cùng VPS nếu đủ RAM, nếu không thì dùng gói miễn phí của một dịch vụ quan sát *(chưa kiểm chứng)*.
- **Cảnh báo bắt buộc (NFR-08):** webhook xác thực thất bại, hàng chờ đối soát quá hạn, job vào dead-letter, báo cáo sắp trễ hạn.

## T-14. Chạy local, CI, deploy

- **Local (NFR-05):** `docker compose up` dựng hạ tầng (Postgres, NATS, Keycloak, trình giả lập S3, Mailpit, LGTM) + các service; script seed tạo dữ liệu mẫu và người dùng mỗi vai trò; `tools/paysim` giả lập thanh toán. Mục tiêu đo được: từ clone sạch đến gọi được API qua Caddy ≤ 10 phút.
- **CI (GitHub Actions)** — mỗi PR:
  - Go: `golangci-lint`, `go test` (unit + integration với testcontainers-go cho Postgres/NATS), ngưỡng coverage theo NFR-06.
  - Python: `ruff`, `pyright`, `pytest`, chấm điểm eval trên phản hồi đã ghi lại.
  - Hợp đồng: `buf lint`, `buf breaking`, kiểm tra code sinh từ OpenAPI.
  - Bảo mật: quét secret (gitleaks), quét lỗ hổng phụ thuộc.
  - **Smoke:** dựng Compose, chạy luồng quyên góp → giải ngân bằng `paysim`.
  - Nhánh mặc định được bảo vệ: CI phải xanh mới merge.
- **Deploy demo:** một VPS chạy Docker Compose + Caddy; image build trong CI, đẩy lên GitHub Container Registry; deploy bằng workflow thủ công.

---

## 12. Ước tính chi phí demo (NFR-09: ≤ ~25 USD/tháng)

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| VPS 4 vCPU / 8 GB RAM | ~7–15 USD | Giá Hetzner đang thay đổi trong năm 2026 và gói rẻ có lúc hết hàng ([findstack](https://findstack.com/resources/hetzner-price-increase-2026), [bitdoze](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans)) *(chưa kiểm chứng)* |
| Tên miền | ~1 USD | |
| Anthropic API | ≤ 5 USD | Trần cứng trong service AI |
| Object storage, email, quan sát | 0 USD | Gói miễn phí *(chưa kiểm chứng)* |
| **Tổng** | **~13–21 USD** | |

**RAM dự kiến trên VPS:** Postgres ~0,5–1 GB · Keycloak ~1,25 GB · NATS < 100 MB · 6 tiến trình Go ~30–80 MB mỗi cái · AI (Python) ~150–300 MB · Caddy < 50 MB · LGTM ~1 GB → **~4–5 GB**, vừa VPS 8 GB *(con số ước lượng, đo lại trong spike S-4)*.

---

## 13. Spike kỹ thuật trước khi viết plan triển khai

Mỗi spike là thử nghiệm nhỏ (≤ 1–2 ngày), kết quả ghi lại thành ADR ngắn trong `docs/adr/`.

| Mã | Câu hỏi cần trả lời | Ảnh hưởng |
|---|---|---|
| S-1 | SePay sandbox: tạo VA theo đơn hàng, giả lập thanh toán, nhận webhook đã ký end-to-end? Có tiền tố VA riêng cho mỗi campaign không? Thuật toán ký webhook PayOS? | T-9, BR-11 |
| S-2 | Kiểm tra cân bằng bút toán bằng constraint trigger hoãn + quyền chỉ INSERT hoạt động đúng với `pgx`/`sqlc`? | T-6, FR-LED |
| S-3 | River: giấy phép bản miễn phí, job định kỳ, chèn job trong transaction của `pgx` → publish NATS → consumer idempotent | T-4, T-5 |
| S-4 | Đo thời gian `docker compose up` từ máy sạch và RAM thực tế (đặc biệt Keycloak) | NFR-05, NFR-09 |
| S-5 | Chọn trình giả lập S3 (giấy phép), thư viện PDF Go hỗ trợ tiếng Việt, nhà cung cấp email/quan sát miễn phí | T-10, T-13 |
| S-6 | AI-01 trên 5–10 ảnh hoá đơn thật: chất lượng trích xuất ở effort `low` vs `medium`, chi phí mỗi ảnh | T-11 |

---

## 14. Cấu trúc repo dự kiến

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
├── web/                 # React + TypeScript
├── tools/paysim/        # Giả lập webhook SePay/PayOS đã ký
├── deploy/              # docker-compose, Caddyfile, realm Keycloak, seed
├── docs/                # requirements, decomposition, tech-stack, adr/
└── go.work
```

---

## 15. Cần chủ dự án duyệt

1. Toàn bộ lựa chọn T-1 … T-14.
2. **Đề xuất điều chỉnh requirement ở T-9:** hạ FR-PAY-02 (PayOS) xuống [S]; BR-11 phụ thuộc kết quả spike S-1.
3. Thứ tự: chạy spike S-1 … S-6 trước, sau đó mới viết plan triển khai.
