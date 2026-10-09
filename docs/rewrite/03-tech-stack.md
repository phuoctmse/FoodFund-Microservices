# FoodFund (bản viết lại) — Lựa chọn công nghệ

> **Trạng thái:** NHÁP v0.6 — 2026-10-10 — đã chốt: T-5 Temporal ([ADR-003](../adr/ADR-003-workflow-temporal.md)), T-6 PostgreSQL 18 ([ADR-001](../adr/ADR-001-database-postgresql.md)), T-7 Traefik qua Gateway API ([ADR-002](../adr/ADR-002-edge-traefik.md)), T-11 model mở tự chạy (Qwen3-VL-4B / Vintern-1B-v3.5; E2E/demo trên HF ZeroGPU), T-14 Kubernetes từ ngày đầu ([ADR-004](../adr/ADR-004-kubernetes-from-day-one.md)); các mục khác chờ duyệt.
> **Đầu vào:** [`01-requirements.md`](./01-requirements.md) v1.0, [`02-decomposition.md`](./02-decomposition.md) v1.0.
> **Đã chốt trước:** Go cho 5 service lõi (Identity & Org, Campaign, Funds, Operations, Transparency) và Notification worker; Python cho service AI.
> **Quy ước:** mỗi quyết định ghi *Chọn / Đã cân nhắc / Lý do / Hệ quả*. Thông tin ghi *(chưa kiểm chứng)* phải được xác nhận trong các spike ở mục 13 trước khi viết plan triển khai.

---

## 0. Tóm tắt

| # | Hạng mục | Chọn | Mức bằng chứng (Phụ lục A) |
|---|---|---|---|
| T-1 | Ngôn ngữ | Go (bản ổn định mới nhất) cho service lõi; Python ≥ 3.12 cho AI | Trung bình — đo trên máy (Phụ lục B) + chủ dự án chọn |
| T-2 | API phía client | REST + OpenAPI, sinh code từ spec | Trung bình — audit + tài liệu |
| T-3 | Gọi đồng bộ nội bộ (chỉ đọc) | ConnectRPC + Protobuf, quản lý bằng `buf` | Trung bình — tài liệu |
| T-4 | Event bus | NATS JetStream **chỉ để phát event tới read model** (Transparency, Notification); có thể bỏ sau spike S-3 | Trung bình — audit + tài liệu; RAM chưa đo |
| T-5 | Điều phối quy trình | **Đã chốt (ADR-003):** Temporal (tự host, lưu trên PostgreSQL 18); worker Go + Python | Trung bình — tài liệu; footprint và độ phức tạp chưa đo (S-3, S-4) |
| T-6 | Cơ sở dữ liệu | **Đã chốt (ADR-001):** PostgreSQL 18 chạy bằng operator CloudNativePG; mỗi service một database; `pgx` + `sqlc`; `goose`; backup PITR | Mạnh — dữ liệu D1–D5 trong ADR-001 |
| T-7 | Gateway | **Đã chốt (ADR-002):** Traefik ≥ 3.7.10 làm controller Gateway API (`HTTPRoute` chuẩn; `RateLimit`, `IPAllowList` qua `ExtensionRef`); cert-manager cho demo; Envoy Gateway dự phòng; Cloudflare Tunnel sau | Trung bình — chấm theo E-1…E-10, K-1…K-6; còn spike S-7 |
| T-8 | Danh tính | Keycloak (OIDC, đăng nhập Google qua identity brokering) | Trung bình — audit + tài liệu; RAM chưa đo |
| T-9 | Thanh toán | SePay API v2 — VA theo đơn hàng (chính); PayOS (phụ) — sau lớp adapter chung | Mạnh — audit + tài liệu nhà cung cấp |
| T-10 | Tệp, PDF, email | Lưu trữ tương thích S3; PDF sinh trong Transparency; email qua SMTP (local: Mailpit) | Yếu — chưa chọn cụ thể (spike S-5) |
| T-11 | AI | **Đã chốt:** tự chạy model mở — S-6 so Qwen3-VL-4B và Vintern-1B-v3.5; Temporal worker Python; adapter 5 chế độ; E2E/demo trên HF Spaces ZeroGPU (miễn phí), dự phòng Modal | Trung bình — tài liệu HF; chất lượng tiếng Việt chưa đo (S-6) |
| T-12 | Frontend | React + TypeScript (Vite), client sinh từ OpenAPI | Yếu — chủ yếu đánh giá |
| T-13 | Quan sát | OpenTelemetry; log JSON (`log/slog`); local: một container Grafana LGTM | Yếu — chủ yếu đánh giá |
| T-14 | Chạy local, CI, deploy | **Đã chốt (ADR-004):** Kubernetes từ ngày đầu — k3d (local, CI), k3s một node (demo); `make up`; chart/operator chính chủ, không Bitnami | Trung bình — đo máy phát triển; còn spike S-4, S-8 |

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

- **Chọn:** NATS JetStream, **vai trò thu hẹp theo ADR-003:** chỉ phát event tới các read model (Transparency, Notification); các quy trình tiền đi qua Temporal. Spike S-3 đánh giá bỏ hẳn NATS. Mỗi bounded context một stream; consumer bền (durable) cho mỗi service tiêu thụ; payload là Protobuf có `schemaVersion`.
- **Đã cân nhắc:** Kafka (hệ thống cũ), RabbitMQ, Redis Streams.
- **Lý do:** một binary nhẹ, chạy local nhanh; có lưu bền, ack, gửi lại, giới hạn số lần gửi — đủ cho C-3/C-4. Kafka quá nặng cho một VPS demo và một người vận hành.
- **Hệ quả:** dead-letter (C-4) hiện thực bằng giới hạn số lần gửi + chuyển sang stream lỗi; cần thư viện nội bộ nhỏ `libs/events` (publish, subscribe, inbox) dùng chung cho các service Go. Service AI dùng client NATS cho Python.

## T-5. Outbox, job, lịch tự động

- **Chọn (đã chốt — [ADR-003](../adr/ADR-003-workflow-temporal.md)):** **Temporal** tự host, lưu trạng thái trên PostgreSQL 18 (không cần Elasticsearch); worker Go cho service lõi, worker Python cho AI; local dùng `temporal server start-dev`. Các quy trình dài (VA hết hạn, đóng gây quỹ, saga giải ngân, tiền dư, hạn báo cáo, phân tích chứng từ, đối soát hằng ngày) viết thành workflow.
- **Đã cân nhắc:** River + NATS + saga tự viết; DBOS (Go chưa 1.0); Restate (BSL 1.1); Hatchet.
- **Lý do:** FoodFund nặng về quy trình dài có hẹn giờ và chờ con người — đúng bài toán của durable execution; Temporal trưởng thành nhất cho luồng tiền.
- **Hệ quả:** bỏ River và outbox tự viết (điểm vào dùng workflow ID tất định để chống trùng — kiểm chứng ở S-3); thêm một thành phần phải vận hành; phải tuân thủ luật tất định và versioning của workflow (ADR-003).

## T-6. Cơ sở dữ liệu

- **Chọn (đã chốt — [ADR-001](../adr/ADR-001-database-postgresql.md)):** PostgreSQL 18 (lên 19 sau bản vá đầu tiên). Môi trường local/demo: **một instance, mỗi service một database và một user riêng** (không có quyền sang database khác). Truy cập bằng `pgx` + `sqlc` (SQL viết tay, sinh code có kiểu); migration bằng `goose`.
- **Đã cân nhắc:** ORM (GORM, ent).
- **Lý do:** sổ cái cần kiểm soát transaction và câu SQL tường minh; `sqlc` bắt lỗi SQL lúc build.
- **Sổ cái & audit (FR-LED, NFR-02, BR-14):**
  - Tiền lưu `BIGINT` (VND, không phần thập phân).
  - Bảng `postings` và `audit_log`: user ứng dụng **không có quyền UPDATE/DELETE** (cấp quyền ở mức database), chỉ INSERT.
  - Mỗi `journal_entry` cân bằng (tổng nợ = tổng có): kiểm tra bằng constraint trigger hoãn đến cuối transaction, kèm test.
  - Khoá ngoại không dùng `ON DELETE CASCADE` cho dữ liệu tiền/chứng từ.
- **Hệ quả:** một instance là điểm hỏng chung ở môi trường demo → **bắt buộc backup khôi phục theo thời điểm (PITR)** và bài kiểm tra khôi phục định kỳ, hoặc dùng Postgres managed khi deploy; ranh giới database vẫn tách để có thể tách instance sau. Khoá chính dùng `uuidv7()`. Sổ cái theo ngữ nghĩa chuyển khoản bất biến + pending/post/void có hạn.

## T-7. Gateway

- **Chọn (đã chốt — [ADR-002](../adr/ADR-002-edge-traefik.md)):** Traefik ≥ 3.7.10 làm controller **Gateway API** trên Kubernetes (ADR-004): route viết bằng `HTTPRoute` chuẩn (không dùng `IngressRoute`); `RateLimit`, `IPAllowList` (IP SePay), `Buffering`, `Headers` là `Middleware` gắn qua `ExtensionRef`; cert-manager + Let's Encrypt cho demo; Envoy Gateway là phương án dự phòng nếu spike S-7 thất bại; Cloudflare Tunnel bật sau (chuẩn bị: DNS ở Cloudflare từ đầu, webhook đăng ký bằng tên miền). **Xác thực token (JWT từ Keycloak) thực hiện trong từng service** bằng middleware dùng chung `libs/auth`; kiểm tra quyền sở hữu tài nguyên tại service sở hữu dữ liệu (C-7).
- **Đã cân nhắc:** Caddy (rate limit không có sẵn — cần module cộng đồng, build lại), Nginx, Envoy Gateway (dành cho Kubernetes), Kong (bỏ image OSS từ 3.10), APISIX (cần etcd).
- **Lý do:** đáp ứng requirement lớp biên E-1…E-10 bằng tính năng có sẵn; gateway không chứa nghiệp vụ nên không cần viết code; xác thực ở service là phòng thủ nhiều lớp và test được bằng unit test.
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

- **Lưu trữ tệp:** API tương thích S3, URL ký sẵn (FR-UPL-01). Local: một trình giả lập S3 trong cluster k3d; demo: dịch vụ object storage có gói miễn phí *(lựa chọn cụ thể và giấy phép của trình giả lập — spike S-5)*.
- **PDF báo cáo (FR-TRN-02):** sinh trong Transparency bằng thư viện PDF thuần Go hỗ trợ font Unicode tiếng Việt *(chọn thư viện sau khi kiểm tra tình trạng bảo trì — spike S-5)*; CSV bằng thư viện chuẩn. Báo cáo được lưu kèm mã băm để chứng minh bất biến.
- **Email (FR-NTF-01):** Notification gửi qua SMTP; local dùng **Mailpit** để xem email; demo dùng một nhà cung cấp email giao dịch có gói miễn phí *(chưa kiểm chứng hạn mức)*.

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
  - Ảnh hoá đơn + danh sách món đã duyệt + số đã giải ngân → model trả **JSON theo schema cố định** (ép bằng structured output của vLLM, kiểm tra lại bằng Pydantic): dòng hàng (tên, số lượng, đơn giá, thành tiền), tổng tiền, ngày, người bán, độ tin cậy, cờ (`TOTAL_MISMATCH`, `OVER_DISBURSED`, `ITEM_NOT_APPROVED`, `DUPLICATE_SUSPECTED`, `UNREADABLE`).
  - Phép so sánh số tiền và phát hiện trùng **tính bằng code**, không để model tự cộng.
  - Kết quả chỉ là gợi ý; admin quyết định (NFR-10).
- **AI-04 — tóm tắt báo cáo:** *chưa chốt* (giữ, hạ ưu tiên, hay thay bằng template).
- **Eval (NFR-10):**
  - Dữ liệu: MC-OCR 2021 (2.436 hoá đơn tiếng Việt chụp bằng điện thoại, 4 trường — **kiểm tra giấy phép dữ liệu trước khi dùng**) + 30–50 ảnh tự chụp (phiếu POS, bảng kê viết tay), không chứa dữ liệu cá nhân thật.
  - Chỉ số: khớp chính xác tổng tiền, ngày, người bán; F1 dòng hàng; recall cờ sai lệch; tỉ lệ JSON đúng schema; thời gian xử lý mỗi ảnh trên GPU và CPU; VRAM/RAM tối đa.
  - Luật chọn: model **nhẹ hơn** thắng nếu cả hai đạt ngưỡng (ví dụ tổng tiền đúng ≥ 95% với phiếu in, recall cờ ≥ 90%).
  - CI chấm điểm trên phản hồi đã ghi lại (không cần GPU).
- **Khi cả hai trượt ngưỡng:** thử Qwen3-VL-8B lượng tử 4-bit (local) hoặc bản đầy đủ trên ZeroGPU; vẫn trượt → mở lại đánh giá API hoặc chuỗi OCR (PaddleOCR-VL) + bóc trường.
- **Dữ liệu:** `fake`/`local` giữ dữ liệu trong hệ thống; `hf-zerogpu`/`modal`/`hf-endpoint` gửi ảnh ra nước ngoài → test E2E và demo chỉ dùng ảnh tự tạo; vận hành thật cần xử lý theo Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026).

## T-12. Frontend

- **Chọn:** React + TypeScript (Vite); client API sinh từ OpenAPI; đăng nhập OIDC với Keycloak.
- **Đã cân nhắc:** Go render HTML + htmx.
- **Lý do:** thể hiện được phía client cho vị trí SE I tổng quát; client có kiểu sinh từ spec giảm lỗi tích hợp. Phạm vi giữ đúng các màn hình ở mục 7.1 requirements.
- **Hệ quả:** thư viện UI chọn khi bắt đầu frontend; không đặt mục tiêu thiết kế cầu kỳ.

## T-13. Quan sát

- **Chọn:** OpenTelemetry SDK (Go, Python) cho trace và metric; log JSON qua `log/slog` kèm `correlationId` (C-8). Local: một container Grafana LGTM (Grafana + Loki + Tempo + Prometheus). Demo: chạy cùng VPS nếu đủ RAM, nếu không thì dùng gói miễn phí của một dịch vụ quan sát *(chưa kiểm chứng)*.
- **Cảnh báo bắt buộc (NFR-08):** webhook xác thực thất bại, hàng chờ đối soát quá hạn, job vào dead-letter, báo cáo sắp trễ hạn.

## T-14. Chạy local, CI, deploy

- **Chọn (đã chốt — [ADR-004](../adr/ADR-004-kubernetes-from-day-one.md)):** Kubernetes từ ngày đầu — **k3d** ở local và CI, **k3s một node** cho demo; cùng Helm values cho mọi môi trường.
- **Local (NFR-05):** `make up` tạo cluster k3d, cài hạ tầng (CloudNativePG, Temporal, Keycloak, NATS, Traefik, trình giả lập S3, Mailpit; LGTM tuỳ chọn), deploy các service, seed dữ liệu mẫu và người dùng mỗi vai trò; `tools/paysim` giả lập thanh toán. Service đang phát triển chạy bằng `go run` nối vào cluster (cách cụ thể chọn ở S-8). Mục tiêu đo được: từ clone sạch đến gọi được API qua Traefik ≤ 10 phút.
- **CI (GitHub Actions)** — mỗi PR:
  - Go: `golangci-lint`, `go test` (unit + integration với testcontainers-go cho Postgres/NATS), ngưỡng coverage theo NFR-06.
  - Python: `ruff`, `pyright`, `pytest`, chấm điểm eval trên phản hồi đã ghi lại.
  - Hợp đồng: `buf lint`, `buf breaking`, kiểm tra code sinh từ OpenAPI.
  - Bảo mật: quét secret (gitleaks), quét lỗ hổng phụ thuộc.
  - **Smoke:** dựng cluster k3d bằng `make up`, chạy luồng quyên góp → giải ngân bằng `paysim`.
  - Nhánh mặc định được bảo vệ: CI phải xanh mới merge.
- **Deploy demo:** k3s một node trên VPS; image build trong CI, đẩy lên GitHub Container Registry; deploy bằng `helm upgrade` từ workflow thủ công (không GitOps ở giai đoạn 1); cert-manager cấp chứng chỉ; Cloudflare Tunnel phía trước khi bật.

---

## 12. Ước tính chi phí demo (NFR-09: ≤ ~25 USD/tháng)

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| VPS 4 vCPU / 8 GB RAM | ~7–15 USD | Giá Hetzner đang thay đổi trong năm 2026 và gói rẻ có lúc hết hàng ([findstack](https://findstack.com/resources/hetzner-price-increase-2026), [bitdoze](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans)) *(chưa kiểm chứng)* |
| Tên miền | ~1 USD | |
| Anthropic API | ≤ 5 USD | Trần cứng trong service AI |
| Object storage, email, quan sát | 0 USD | Gói miễn phí *(chưa kiểm chứng)* |
| **Tổng** | **~13–21 USD** | |

**RAM dự kiến trên VPS:** k3s ~0,5 GB · Postgres ~0,5–1 GB · Keycloak ~1,25 GB · NATS < 100 MB · Temporal + UI ~0,7 GB *(số đo bên thứ ba, chưa đo)* · 6 tiến trình Go ~30–80 MB mỗi cái · AI (Python) ~150–300 MB · Traefik < 100 MB *(chưa đo)* · LGTM ~1 GB → **~4–5 GB**, vừa VPS 8 GB *(con số ước lượng, đo lại trong spike S-4)*.

---

## 13. Spike kỹ thuật trước khi viết plan triển khai

Mỗi spike là thử nghiệm nhỏ (≤ 1–2 ngày), kết quả ghi lại thành ADR ngắn trong `docs/adr/`.

| Mã | Câu hỏi cần trả lời | Ảnh hưởng |
|---|---|---|
| S-1 | SePay sandbox: tạo VA theo đơn hàng, giả lập thanh toán, nhận webhook đã ký end-to-end? Có tiền tố VA riêng cho mỗi campaign không? Thuật toán ký webhook PayOS? | T-9, BR-11 |
| S-2 | Kiểm tra cân bằng bút toán bằng constraint trigger hoãn + quyền chỉ INSERT hoạt động đúng với `pgx`/`sqlc`? | T-6, FR-LED |
| S-3 | Saga giải ngân trên Temporal + Postgres: giữ tiền → chờ tín hiệu có hạn → ghi sổ hoặc hoàn lại; webhook khởi động workflow với ID tất định (chống trùng); replay test; có bỏ được NATS không | T-4, T-5, ADR-003 |
| S-4 | Đo thời gian `make up` (k3d) từ máy sạch và RAM thực tế (đặc biệt Keycloak và Temporal) | NFR-05, NFR-09 |
| S-5 | Chọn trình giả lập S3 (giấy phép), thư viện PDF Go hỗ trợ tiếng Việt, nhà cung cấp email/quan sát miễn phí | T-10, T-13 |
| S-6 | (a) Eval AI-01: Qwen3-VL-4B vs Vintern-1B-v3.5 trên MC-OCR + ảnh tự chụp, chạy **local** trên RTX 3070 (đo cả CPU). (b) Deploy 2 Space ZeroGPU (Gradio): Vintern với `trust_remote_code` có chạy không; thời gian mỗi lần gọi; quota có trừ vào tài khoản của token gọi không; thời gian chờ khi Space ngủ/xếp hàng. (c) Nếu (b) trượt: deploy lên Modal | T-11, ADR-004 |
| S-7 | Traefik trên k3s một node: `IPAllowList` gắn qua `ExtensionRef` hoạt động; proxy nhận đúng IP thật của request từ bên ngoài (trượt → Envoy Gateway) | T-7, ADR-002 |
| S-8 | Vòng lặp code nhanh với cluster local: `go run` + port-forward hay công cụ đồng bộ code vào pod (kiểm tra tình trạng bảo trì của Tilt) | T-14, ADR-004 |
| S-9 | Temporal trên PostgreSQL 18: công cụ quản lý schema có hỗ trợ không, hay phải chạy thủ công / dùng PG17 riêng | T-5, T-6, ADR-001, ADR-003 |
| S-10 | Trước khi bật Cloudflare Tunnel: `cloudflared` trong cluster, lọc IP SePay phía sau tunnel, giới hạn request của Cloudflare gói miễn phí | T-7, ADR-002 |

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
├── deploy/              # cấu hình k3d, Helm values (hạ tầng + service), HTTPRoute, realm Keycloak, seed
├── docs/                # requirements, decomposition, tech-stack, adr/
└── go.work
```

---

## 15. Cần chủ dự án duyệt

1. Toàn bộ lựa chọn T-1 … T-14.
2. **Đề xuất điều chỉnh requirement ở T-9:** hạ FR-PAY-02 (PayOS) xuống [S]; BR-11 phụ thuộc kết quả spike S-1.
3. Thứ tự: chạy spike S-1 … S-6 trước, sau đó mới viết plan triển khai.

---

## Phụ lục A — Bằng chứng cho từng quyết định

**Loại bằng chứng:**
- **[Audit]** quan sát/đo trực tiếp trên hệ thống cũ trong buổi audit (2026-10-07);
- **[Tài liệu]** tài liệu chính thức hoặc nguồn công khai, có link;
- **[Đo]** đo trên máy phát triển (Phụ lục B);
- **[Requirement]** suy ra trực tiếp từ `01-requirements.md` / `02-decomposition.md`;
- **[Đánh giá]** nhận định của người thiết kế, chưa có bằng chứng khách quan.

**Mức bằng chứng:** *Mạnh* = có tài liệu/đo xác nhận đúng tính năng cần; *Trung bình* = có bằng chứng một phần, phần còn lại là đánh giá; *Yếu* = chủ yếu là đánh giá.

### T-1. Go cho lõi, Python cho AI — *Trung bình*

- **[Đo]** Service HTTP tối thiểu (Phụ lục B): Go dùng ~20 MB RAM, khởi động ~0,52 giây; FastAPI dùng ~62 MB, khởi động ~1,1 giây — cùng phương pháp đo, 3 lần chạy.
- **[Đánh giá — nói thẳng]** Chênh lệch RAM tuyệt đối cho 6 service chỉ khoảng 250 MB ở mức hello-world — **nhỏ** so với Keycloak (~1,25 GB). RAM **không phải** lý do quyết định. Lý do chính: chủ dự án chọn Go; kiểu tĩnh và lỗi tường minh hợp code tiền (Python có `pyright` cũng đạt được phần lớn điều này).
- **Sẽ đổi quyết định nếu:** tốc độ làm một mình được ưu tiên hơn việc học Go → Python cho tất cả.

### T-2. REST + OpenAPI thay cho GraphQL Federation — *Trung bình*

- **[Audit]** Gateway Apollo của hệ thống cũ không phục vụ request nào cho đến khi kiểm tra xong từng subgraph: mỗi subgraph không sẵn sàng bị thử lại ~34 giây, **tuần tự** cho 4 subgraph. Lưu ý công bằng: một phần là do cách hiện thực (compose lúc khởi động), không hoàn toàn do Federation.
- **[Requirement]** Web chỉ ở mức tối thiểu (mục 7.1 requirements); Transparency đã là read model gộp dữ liệu (D-3) → không còn nhu cầu ghép schema từ nhiều service.
- **[Tài liệu]** `oapi-codegen` sinh interface server cho `net/http` chuẩn, có chế độ strict server tự xử lý marshal/unmarshal, và sinh client ([oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)).
- **Sẽ đổi nếu:** có nhiều loại client cần truy vấn linh hoạt (ví dụ thêm app mobile).

### T-3. ConnectRPC + `buf` cho gọi nội bộ — *Trung bình*

- **[Tài liệu]** Connect chạy trên HTTP/1.1, HTTP/2, HTTP/3; gọi được bằng cURL với JSON; hỗ trợ đầy đủ giao thức gRPC và gRPC-Web ([Connect docs](https://connectrpc.com/docs/introduction)). `buf` phát hiện thay đổi phá vỡ ([Buf CLI](https://webflow-new.buf.build/product/cli)).
- **[Requirement]** C-6 (contract test cho schema); dùng chung Protobuf với event (T-4).
- **[Đánh giá]** REST nội bộ cũng làm được; chọn Protobuf để có **một** nguồn schema cho cả RPC và event.

### T-4. NATS JetStream thay cho Kafka — *Trung bình*

- **[Audit]** Service `user` và `campaign` cũ **crash ngay khi khởi động** nếu không có Kafka (`KafkaJSConnectionError … Port … NaN`). Stack Kafka nằm riêng ở `infrastructure/docker-compose.yml` với 3 container (Zookeeper, Kafka, Debezium Connect) và README không nhắc tới.
- **[Tài liệu]** JetStream có `AckWait` (hết hạn thì gửi lại), `MaxDeliver` (giới hạn số lần gửi), và phát advisory khi vượt giới hạn — dùng làm hàng lỗi (dead-letter) có thể phát lại ([Synadia: reliable delivery & DLQ](https://www.synadia.com/blog/jetstream-reliable-delivery-dlq-replay), [NATS docs: consumers](https://docs.nats.io/~/revisions/FTWMYYvWt52KJd0gQISk/using-nats/developer/develop_jetstream/consumers)). Đáp ứng C-3/C-4.
- **Chưa có:** số đo RAM của NATS (Docker chưa chạy) → spike S-4.
- **Sẽ đổi nếu:** cần CDC bằng Debezium hoặc lưu trữ/phát lại event ở quy mô rất lớn.

### T-5. Temporal làm lớp điều phối — *Trung bình* (xem [ADR-003](../adr/ADR-003-workflow-temporal.md))

*Phương án River bên dưới được giữ lại làm hồ sơ so sánh; không còn là lựa chọn.*

#### (Lịch sử) River (job queue trên Postgres) làm outbox và lịch

- **[Tài liệu]** River chèn job **trong cùng transaction**: job chắc chắn được ghi nếu transaction commit, bị huỷ nếu rollback, và không ai thấy trước khi commit. Có job định kỳ/cron, tự thử lại, job duy nhất. Giấy phép MPL-2.0; gói mã nguồn mở miễn phí đã gồm job định kỳ (gói Pro trả phí chỉ thêm workflow, batching, giới hạn đồng thời — không cần) ([River — brandur.org](https://brandur.org/river), [itechguides — River](https://www.itechguides.com/products/river/)).
- **[Audit]** Hệ thống cũ đã phải tự viết `OutboxEvent` + processor trong `campaign` → nhu cầu outbox là có thật; River thay phần tự viết đó.
- **[Requirement]** C-2, C-4, BR-01 (lịch tự động), FR-PAY-05, FR-TRN-02 (nhắc hạn), NFR-01 (đối soát hằng ngày).

### T-6. PostgreSQL + `pgx` + `sqlc` — *Mạnh*

- **[Tài liệu]** Postgres hỗ trợ constraint trigger hoãn đến **cuối transaction** (`DEFERRABLE INITIALLY DEFERRED`) → kiểm tra mỗi bút toán cân bằng sau khi đã ghi hết các dòng ([PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)).
- **[Tài liệu]** `sqlc` hỗ trợ `pgx/v5` từ v1.18.0 qua `sql_package: "pgx/v5"` ([sqlc — Using Go and pgx](https://docs.sqlc.dev/en/latest/guides/using-go-and-pgx.html)). *(Khả năng báo lỗi SQL lúc sinh code chưa được trích dẫn — kiểm tra trong spike S-2.)*
- **[Audit]** Hệ thống cũ: `onDelete: Cascade` trên dữ liệu tiền, xoá cứng campaign, `received_amount` cập nhật hai lần không nguyên tử → cần transaction tường minh và quyền chỉ-INSERT ở mức database.

### T-7. Traefik làm gateway — *Trung bình* (xem [ADR-002](../adr/ADR-002-edge-traefik.md))

- **[Tài liệu — để so sánh]** Caddy tự cấp và gia hạn chứng chỉ TLS mặc định (điểm mạnh của Caddy, nhưng không bù được việc thiếu rate limit) ([Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)).
- **[Requirement]** C-7/NFR-04 buộc kiểm tra quyền tại service sở hữu dữ liệu → service phải xác thực token dù gateway có làm hay không → gateway không cần logic.
- **[Tài liệu]** Traefik có sẵn `RateLimit`, `IPAllowList`, `Buffering`, `ForwardAuth` ([Traefik middlewares](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/)); Caddy **không** có rate limit sẵn ([stackharbor](https://stackharbor.com/en/knowledge-base/caddy-rate-limiting/)) — đây là lỗi của bản v0.2 khi ghi Caddy "giới hạn tần suất".
- **[Tài liệu]** SePay công bố danh sách IP gửi webhook và yêu cầu HTTPS ([SePay IP](https://developer.sepay.vn/en/dia-chi-ip)).

### T-8. Keycloak — *Trung bình*

- **[Audit]** Service `auth` cũ phụ thuộc AWS Cognito thật → không chạy được local; luồng Google tự viết đổi mật khẩu người dùng (`libs/aws-cognito/aws-cognito.service.ts:851-853`).
- **[Tài liệu]** `--import-realm` nạp file realm JSON khi khởi động, bỏ qua nếu realm đã có → seed sẵn người dùng cho từng vai trò, phục vụ NFR-05 ([Red Hat build of Keycloak — Importing and Exporting Realms](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/24.0/html/server_guide/importexport-)).
- **[Tài liệu]** Hướng dẫn sizing chính thức: bộ nhớ cơ sở **1250 MB** (gồm cache realm và 10.000 phiên) — con số cho production, môi trường dev có thể thấp hơn nhưng **chưa đo** ([Keycloak sizing](https://www.keycloak.org/high-availability/single-cluster/concepts-memory-and-cpu-sizing)).
- **Bằng chứng mâu thuẫn:** Zitadel được một nguồn nêu ~512 MB nhưng khuyến nghị nhiều hơn ([Zitadel minimum specs](https://help.zitadel.com/what-are-zitadel-minimum-self-hosted-specs), [SSD Nodes](https://www.ssdnodes.com/learn/lang/it/keycloak-vs-authentik-vs-zitadel)) → không đủ căn cứ để nói Zitadel nhẹ hơn trong thực tế.
- **[Đánh giá]** Keycloak phổ biến, dễ giải thích khi phỏng vấn. Đăng nhập Google qua identity brokering là tính năng chuẩn của Keycloak *(chưa trích dẫn trực tiếp)*.
- **Sẽ đổi nếu:** spike S-4 cho thấy Keycloak làm vượt RAM VPS hoặc vượt 10 phút khởi động.

### T-9. SePay VA theo đơn hàng — *Mạnh*

- **[Audit]** Lỗi thanh toán của hệ thống cũ đều đến từ việc khớp theo nội dung/số tiền: coi hai khoản cùng số tiền là trùng, tiền không khớp vào thẳng ví admin, phải xử lý chuyển thiếu/dư (mục 8 requirements).
- **[Tài liệu]** VA theo đơn hàng: mỗi đơn một VA, **ngân hàng báo lỗi ngay nếu chuyển sai số tiền**, VA tự huỷ sau khi thanh toán hoặc hết hạn; API v1 ngừng phát triển ([SePay — VA theo đơn hàng](https://developer.sepay.vn/en/sepay-api/api-va-theo-don-hang)). Sandbox giả lập thanh toán VA cho BIDV, Sacombank, Vietcombank, VietinBank, Shinhan ([SePay Sandbox](https://developer.sepay.vn/en/sepay-api/v2/sandbox)). Webhook xác thực HMAC-SHA256/API key, gửi lại tối đa 7 lần trong 5 giờ ([SePay webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)).
- **[Tài liệu]** PayOS có chữ ký webhook và môi trường test ([payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/)).

### T-10. Tệp, PDF, email — *Yếu*

- Chưa chọn thư viện/dịch vụ cụ thể; quyết định thật nằm ở spike S-5.

### T-11. Model mở tự chạy (Qwen3-VL, Vintern) — *Trung bình*

- **[Tài liệu]** Qwen3-VL-4B: Apache 2.0, OCR 32 ngôn ngữ; Vintern-1B-v3.5: MIT, chuyên tiếng Việt, có số liệu vi-MTVQA/DocVQA/OCRBench trên model card.
- **[Tài liệu]** HF API (kiểm tra 2026-10-10): Qwen3-VL-4B có nhà cung cấp Featherless đang chạy; Vintern-1B-v3.5 và PaddleOCR-VL-1.6 **không có** nhà cung cấp serverless → demo dùng Inference Endpoints (T4 $0,50/giờ, L4 $0,80/giờ, tính theo phút, tự tắt khi không dùng — [HF pricing](https://huggingface.co/docs/inference-endpoints/en/pricing)).
- **[Tài liệu]** TGI của HF ở chế độ bảo trì từ 12/2025, HF khuyến nghị vLLM/SGLang ([HF docs](https://huggingface.co/docs/text-generation-inference/en/index.md)) → dùng vLLM/llama.cpp.
- **[Đo]** Laptop: **RTX 3070 Laptop 8 GB VRAM** (driver 596.21); RAM khả dụng ~4,9 GB khi Docker chưa chạy, committed 20,2 GB > RAM vật lý; 2 khe × 8 GB, máy báo hỗ trợ tối đa 32 GB → chạy model song song với stack app trên laptop không ổn định; đưa model lên ZeroGPU. *(Bản v0.4 ghi sai "không có GPU NVIDIA" — đã sửa.)*
- **[Tài liệu]** ZeroGPU: tài khoản free (email đã xác minh, trên 30 ngày) host tối đa 2 Space; chỉ Gradio SDK; quota GPU theo ngày: free 5 phút, PRO 40 phút; HF Spaces CPU Basic miễn phí phần cứng nhưng tạo Space chạy Gradio/Docker mới cần gói trả phí ([ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu), [Spaces GPUs](https://huggingface.co/docs/hub/spaces-gpus)). Oracle Always Free bị cắt còn 2 OCPU/12 GB từ 15/06/2026 và thu hồi máy nhàn rỗi 7 ngày ([InfoQ](https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)) → loại.
- **[Requirement]** NFR-07 (AI không chặn duyệt), NFR-10.
- **Chưa có:** không tìm thấy benchmark nào so các model này trên hoá đơn tiếng Việt → S-6 là nguồn bằng chứng duy nhất.
- **Rủi ro:** Vintern phụ thuộc một nhóm nhỏ, chưa có bản nào trong năm 2026 → nếu thắng, lưu bản sao trọng số; Qwen3-VL là dự phòng. Vintern cần `trust_remote_code` → kiểm tra khi deploy lên HF Endpoint.

#### (Lịch sử) AI với Anthropic SDK

Phương án v0.4 (API Anthropic, `claude-opus-5-5`) không còn là lựa chọn; giữ lại để so sánh. Tài liệu được soạn với sự hỗ trợ của Claude (Anthropic); lựa chọn cuối cùng là model mở do chủ dự án quyết định.


- **[Tài liệu]** Structured outputs (`client.messages.parse()`) kiểm tra kết quả theo schema; `claude-opus-5-5` là model mặc định hiện tại, giá $4/$20 cho mỗi triệu token vào/ra, effort mặc định `medium`; Batch API giảm 50% chi phí cho tác vụ không gấp (tài liệu Claude API đi kèm công cụ phát triển, bản cache 2026-09-25).
- **[Requirement]** NFR-10: AI chỉ gợi ý, có eval, có trần chi phí.
- **Chưa có:** chất lượng trích xuất hoá đơn tiếng Việt và chi phí thực mỗi ảnh → spike S-6.
- **Minh bạch về thiên lệch:** tài liệu này được soạn với sự hỗ trợ của Claude (sản phẩm của Anthropic), và chưa có phép so sánh với nhà cung cấp khác (spec chatbot cũ dùng Gemini). **Spike S-6 nên chạy cùng bộ eval trên ít nhất một nhà cung cấp khác** trước khi chốt; lớp adapter trong service AI giữ khả năng đổi nhà cung cấp.

### T-12. React + TypeScript — *Yếu*

- **[Đánh giá]** Phổ biến, thể hiện được kỹ năng frontend cho vị trí SE I tổng quát; client có kiểu sinh từ OpenAPI. Go + htmx cũng đáp ứng requirement với ít code hơn.

### T-13. OpenTelemetry + Grafana LGTM — *Yếu*

- **[Requirement]** NFR-08 (trace xuyên service, cảnh báo).
- **[Đánh giá]** OpenTelemetry là chuẩn mở, không khoá vào nhà cung cấp (hệ thống cũ dùng Datadog + Sentry). Chưa đo RAM của container LGTM.

### T-14. Kubernetes từ ngày đầu (k3d, k3s), GitHub Actions — *Trung bình* (xem [ADR-004](../adr/ADR-004-kubernetes-from-day-one.md))

- **[Audit]** Hệ thống cũ: `docker-compose up` theo README thất bại (thiếu `.env.docker`, không có Postgres/Redis/Kafka); bước test trong CI bị comment; không có smoke test → cần một lệnh dựng đủ hạ tầng và job smoke trong CI.
- **[Đo]** Máy phát triển: RAM 15,9 GB (trống 4,7 GB lúc đo), 8 nhân/16 luồng; RAM ước tính đủ stack trong cluster ~3,7–5,7 GB → vừa nhưng sát (ADR-004).
- **[Tài liệu]** Temporal tự host chính thức bằng Helm trên Kubernetes; image Bitnami không còn cập nhật từ 08/2025 → chỉ dùng chart/operator chính chủ.
- **[Requirement]** NFR-05, NFR-09, NFR-14; requirements v1.1 đưa Kubernetes vào phạm vi (mục 7.1).

---

## Phụ lục B — Phép đo Go vs Python (2026-10-09)

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
- Lần đo đầu tiên bị sai (chỉ đo trình khởi chạy của venv, ra 4,1 MB cho Python) và đã được đo lại bằng cách tính cả cây tiến trình.

---

## Phụ lục C — Những gì còn thiếu bằng chứng

| Quyết định | Thiếu gì | Spike |
|---|---|---|
| T-4, T-8, T-13, T-14 | RAM và thời gian khởi động thực của k3s, NATS, Keycloak, Postgres, Temporal, LGTM trong cluster k3d | S-4, S-8 |
| T-5 | Saga giải ngân trên Temporal, chống trùng ở điểm vào, footprint thực tế | S-3, S-4 |
| T-6 | `sqlc` báo lỗi SQL lúc sinh code; constraint trigger cân bằng bút toán | S-2 |
| T-9 | Webhook SePay end-to-end; tiền tố VA cho campaign; thuật toán ký PayOS | S-1 |
| T-10 | Thư viện PDF hỗ trợ tiếng Việt; trình giả lập S3 và giấy phép | S-5 |
| T-11 | Chất lượng hoá đơn tiếng Việt của Qwen3-VL-4B và Vintern-1B-v3.5; khả năng chạy và quota thực tế trên ZeroGPU | S-6 |
| T-7 | `IPAllowList` qua `ExtensionRef`, IP thật trên k3s; lọc IP sau Cloudflare Tunnel | S-7, S-10 |
| T-12 | Không cần spike — chấp nhận là quyết định theo đánh giá, dễ thay sau | — |
