# FoodFund (bản viết lại) — Lựa chọn công nghệ

> **Trạng thái:** **v1.0 — 2026-10-11 — toàn bộ T-1 … T-14 đã chốt.** Quyết định lớn có ADR riêng: [ADR-001](../adr/ADR-001-database-postgresql.md) PostgreSQL 18, [ADR-002](../adr/ADR-002-edge-traefik.md) Traefik qua Gateway API, [ADR-003](../adr/ADR-003-workflow-temporal.md) Temporal, [ADR-004](../adr/ADR-004-kubernetes-from-day-one.md) Kubernetes từ ngày đầu. Các điểm *(chưa kiểm chứng)* được xác nhận trong spike S-1 … S-10 (mục 13) trước khi viết plan triển khai.
> **Đầu vào:** [`01-requirements.md`](./01-requirements.md) v1.5, [`02-decomposition.md`](./02-decomposition.md) v1.1.
> **Đã chốt trước:** Go cho 5 service lõi (Identity & Org, Campaign, Funds, Operations, Transparency) và Notification worker; Python cho service AI.
> **Quy ước:** mỗi quyết định ghi *Chọn / Đã cân nhắc / Lý do / Hệ quả*. Thông tin ghi *(chưa kiểm chứng)* phải được xác nhận trong các spike ở mục 13 trước khi viết plan triển khai.

---

## 0. Tóm tắt

| # | Hạng mục | Chọn | Mức bằng chứng (Phụ lục A) |
|---|---|---|---|
| T-1 | Ngôn ngữ | Go (bản ổn định mới nhất) cho service lõi; Python ≥ 3.12 cho AI (Temporal worker, không FastAPI) | Trung bình — đo trên máy (Phụ lục B) + chủ dự án chọn |
| T-2 | API phía client | REST + **OpenAPI 3.0.x** viết spec trước, sinh code (`oapi-codegen`, client TypeScript); lệnh khởi động quy trình dài trả `202 Accepted` | Trung bình — audit + tài liệu |
| T-3 | Gọi đồng bộ nội bộ (chỉ đọc) | ConnectRPC + Protobuf (`buf`), chỉ cho 1–2 truy vấn đọc; phần lớn giao tiếp là activity Temporal | Trung bình — tài liệu |
| T-4 | Event bus | NATS JetStream (Apache 2.0, ở lại CNCF) **chỉ để phát tin** tới read model và Notification; stream lưu đĩa, luôn có giới hạn; cài khi có consumer đầu tiên | Trung bình — audit + tài liệu; RAM chưa đo |
| T-5 | Điều phối quy trình | **Đã chốt (ADR-003):** Temporal (tự host, lưu trên PostgreSQL 18); worker Go + Python | Trung bình — tài liệu; footprint và độ phức tạp chưa đo (S-3, S-4) |
| T-6 | Cơ sở dữ liệu | **Đã chốt (ADR-001):** PostgreSQL 18 chạy bằng operator CloudNativePG; mỗi service một database; `pgx` + `sqlc`; `goose`; backup PITR | Mạnh — dữ liệu D1–D5 trong ADR-001 |
| T-7 | Gateway | **Đã chốt (ADR-002):** Traefik ≥ 3.7.10 làm controller Gateway API (`HTTPRoute` chuẩn; `RateLimit`, `IPAllowList` qua `ExtensionRef`); cert-manager cho demo; Envoy Gateway dự phòng; Cloudflare Tunnel sau | Trung bình — chấm theo E-1…E-10, K-1…K-6; còn spike S-7 |
| T-8 | Danh tính | Keycloak (Apache 2.0; OIDC, đăng nhập Google qua identity brokering) | Trung bình — tài liệu; RAM chưa đo |
| T-9 | Thanh toán | SePay VA theo đơn hàng + PayOS, **cả hai [M]**, sau interface `PaymentProvider`; dev/CI/demo dùng sandbox + `paysim` | Mạnh — audit + tài liệu nhà cung cấp |
| T-10 | Tệp, PDF, email | Lưu trữ API S3: **SeaweedFS** (local) / **Cloudflare R2** (demo); PDF: Maroto v2 hoặc Typst (chọn ở S-5); email SMTP: Mailpit (local) / **Brevo** (demo) | Trung bình — tài liệu; PDF tiếng Việt chưa đo |
| T-11 | AI | **Đã chốt:** tự chạy model mở — S-6 so Qwen3-VL-4B và Vintern-1B-v3.5; Temporal worker Python; adapter 5 chế độ; E2E/demo trên HF Spaces ZeroGPU (miễn phí), dự phòng Modal | Trung bình — tài liệu HF; chất lượng tiếng Việt chưa đo (S-6) |
| T-12 | Frontend | React + TypeScript **có SSR** (Next.js standalone hoặc React Router v7 — chọn sau prototype) + **BFF** giữ token OIDC phía server; client sinh từ OpenAPI | Yếu — chủ yếu đánh giá |
| T-13 | Quan sát | OpenTelemetry (Go, Python); log JSON; local: `otel-lgtm` (tắt mặc định); demo: **Grafana Cloud gói miễn phí** | Trung bình — tài liệu nhà cung cấp |
| T-14 | Chạy local, CI, deploy | **Đã chốt (ADR-004, sửa 2026-10-11):** kind v0.33.0 với node image cố định v1.35.8 (local, CI) + kubeadm một node (demo); Calico; `make up`; chart/operator chính chủ, không Bitnami | Trung bình — đo máy phát triển; còn spike S-4, S-8 |

---

## T-1. Ngôn ngữ

- **Chọn:** Go cho Identity & Org, Campaign, Funds, Operations, Transparency, Notification worker; Python ≥ 3.12 cho AI.
- **Đã cân nhắc:** Python cho tất cả; TypeScript lõi + Python AI.
- **Lý do:** kiểu tĩnh và xử lý lỗi tường minh phù hợp code tiền (NFR-01); mỗi service là một binary nhỏ, ít RAM. Python dùng cho AI vì hệ sinh thái model.
- **Hệ quả:** hai bộ công cụ (Go: `golangci-lint`, `go test`; Python: `uv`, `ruff`, `pyright`, `pytest`). Service AI chỉ là Temporal worker → **không dùng FastAPI** (bớt một framework). Hợp đồng giữa hai ngôn ngữ chỉ qua Protobuf (activity, event), không chia sẻ code.

## T-2. API phía client

- **Chọn:** REST + JSON, **OpenAPI-first** — viết spec trước bằng **OpenAPI 3.0.x**, sinh server stub Go (`oapi-codegen`, chế độ strict server) và client TypeScript cho web.
- **Đã cân nhắc:** GraphQL Federation (hệ thống cũ); Connect cho cả phía ngoài (một hệ schema, nhưng ít người quen, mất lợi thế Swagger khi demo); `huma` (viết code trước, tự sinh spec 3.1).
- **Lý do:** web tối thiểu không cần truy vấn linh hoạt; Transparency đã gộp dữ liệu; reviewer thử API ngay bằng Swagger; trang công khai (sao kê) tận dụng cache HTTP; webhook ngân hàng vốn là REST. `oapi-codegen` mới hỗ trợ OpenAPI 3.1 ở mức ban đầu (v2.8, cần Go 1.25) → dùng 3.0.x để công cụ hai phía đều ổn định.
- **Quy ước do có Temporal:** lệnh khởi động quy trình dài (tạo khoản quyên góp, yêu cầu giải ngân…) trả **`202 Accepted` + ID**; client đọc trạng thái từ database của service, không chờ workflow chạy xong.
- **Hệ quả:** mỗi service công bố `openapi.yaml`; CI kiểm tra code sinh ra khớp spec.

## T-3. Gọi đồng bộ nội bộ

- **Chọn:** ConnectRPC (`connect-go`) + Protobuf; schema quản lý bằng `buf` (lint + `buf breaking`).
- **Phạm vi:** chỉ 1–2 truy vấn đọc (ví dụ Operations hỏi Funds ngân sách còn lại để báo lỗi sớm). Phần lớn giao tiếp giữa service đã là **activity Temporal** (`02-decomposition.md` mục 3).
- **Đã cân nhắc:** REST nội bộ; gRPC thuần.
- **Lý do:** dùng chung một nguồn schema Protobuf với activity và event; Connect chạy trên HTTP thường, gọi được bằng `curl`.
- **Hệ quả:** thư mục `proto/` chung; `buf breaking` chạy trong CI.

## T-4. Event bus

- **Chọn:** NATS JetStream, **chỉ để phát tin** tới read model (Transparency), Notification và projection; luồng tiền đi qua Temporal (ADR-003).
- **Giấy phép:** rủi ro chuyển sang BSL năm 2025 đã được giải quyết — ngày 01/05/2025 NATS **ở lại CNCF dưới Apache 2.0**, thương hiệu chuyển cho Linux Foundation.
- **Đã cân nhắc:** Kafka (hệ thống cũ, quá nặng); bỏ hẳn NATS, workflow gọi trực tiếp activity của từng bên nhận (bên phát phải biết danh sách bên nhận → ghép nối chặt với ~5 bên nhận × ~15 loại event).
- **Cách dùng:** mỗi bounded context một stream; **lưu trên đĩa và luôn đặt giới hạn** (`max_age`, `max_bytes`) — stream lưu RAM không giới hạn sẽ phình vô hạn; consumer bền cho mỗi bên nhận; payload Protobuf có `schemaVersion`; giới hạn số lần gửi → stream lỗi + cảnh báo.
- **Hệ quả:** cài NATS **khi có consumer đầu tiên** (không cài sẵn từ ngày đầu); thư viện nhỏ `libs/events` (publish, subscribe, inbox) cho Go; client NATS cho Python nếu cần.

## T-5. Điều phối quy trình (thay cho outbox, job, lịch tự động)

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

- **Chọn:** Keycloak (Apache 2.0) — OIDC; đăng nhập Google qua identity brokering; realm và người dùng mẫu cho từng vai trò import tự động khi khởi động (`--import-realm`).
- **Đã cân nhắc:**

  | Phương án | Lý do không chọn |
  |---|---|
  | Zitadel | **Chuyển sang AGPL 3.0 từ v3** → tăng rủi ro giấy phép; lợi thế nhiều tenant (B2B) không cần |
  | Ory (Kratos, Hydra…) | Bộ linh kiện tự lắp — quá nhiều việc cho một người |
  | Authentik | Không có lợi thế rõ cho FoodFund |
  | Cognito, Auth0 (dịch vụ) | Không chạy được local (NFR-05); hệ thống cũ gặp đúng vấn đề này |

- **Hệ quả:** vai trò và tổ chức **không** lưu trong Keycloak — Identity & Org là nguồn sự thật (FR-ID-02); token chỉ mang `sub`, service tra vai trò hiện tại từ projection → không có chuyện vai trò đã đổi mà token cũ vẫn mang vai trò cũ. Rủi ro còn lại: RAM (sizing chính thức 1.250 MB cho production) → đo ở S-4.

## T-9. Thanh toán

- **Chọn:** **SePay VA theo đơn hàng** và **PayOS**, **cả hai giữ mức [M]**, sau interface `PaymentProvider` trong module `payment` của Funds; mỗi provider có trình giả lập `tools/paysim` gửi webhook đã ký.
- **Phát hiện làm đổi đề xuất cũ:** VA theo đơn hàng của SePay ở môi trường thật **chỉ dành cho tài khoản doanh nghiệp BIDV**, giá liên hệ ([SePay](https://sepay.vn/en/tai-khoan-ao-theo-don-hang.html)) → **rút lại đề xuất hạ PayOS xuống [S]**. Ưu tiên cuối cùng giữa hai kênh quyết định sau spike S-1 (kèm kiểm tra điều kiện mở tài khoản PayOS — *chưa kiểm chứng*).
- **Lý do giữ VA:** khớp giao dịch theo số tài khoản ảo thay vì nội dung chuyển khoản → loại phần lớn ca "không khớp", "chuyển thiếu/dư" của hệ thống cũ; sandbox giả lập được thanh toán VA ([SePay Sandbox](https://developer.sepay.vn/en/sepay-api/v2/sandbox)); webhook xác thực HMAC-SHA256/API key ([SePay webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)).
- **Hệ quả:**
  - Dev, CI và demo chạy **sandbox + `paysim`**; README ghi rõ demo dùng sandbox.
  - BR-11 (định danh nhận tiền riêng mỗi campaign): mô hình dữ liệu gắn mọi VA/link với campaign; mức đáp ứng ở môi trường thật phụ thuộc S-1.
  - FR-PAY-03 (thiếu/dư) và FR-PAY-10 (hàng chờ đối soát) giữ cho PayOS và tiền vào ngoài VA.

## T-10. Tệp, PDF, email

- **Lưu trữ tệp (FR-UPL-01):** code **chỉ dùng API S3** + URL ký sẵn → đổi nơi lưu là đổi cấu hình.

  | Môi trường | Chọn | Lý do |
  |---|---|---|
  | Local (kind) | **SeaweedFS** (Apache 2.0, Go, chạy được một node) | MinIO bản cộng đồng **đã ngừng** (không còn image từ 10/2025, rồi archive) → không dùng |
  | Demo | **Cloudflare R2** | Gói miễn phí ~10 GB, không tính phí băng thông ra *(một nguồn mâu thuẫn — kiểm tra trang giá)*; không tốn RAM VPS |

  Đã cân nhắc: Garage (AGPL 3.0, một nguồn nói cần ≥ 3 node), RustFS (mới, ít lịch sử vận hành).
- **PDF báo cáo (FR-TRN-02):** sinh trong Transparency; chọn giữa **Maroto v2** (thuần Go, font UTF-8, dựa trên gofpdf) và **Typst** (dàn trang tốt nhất, thêm một binary và ngôn ngữ template) sau **spike S-5 kiểm tra đủ 134 chữ cái tiếng Việt có dấu**, gồm chữ mang hai dấu. Gotenberg (Chromium) loại vì quá nặng. CSV bằng thư viện chuẩn; báo cáo lưu kèm mã băm.
- **Email (FR-NTF-01):** Notification gửi qua **SMTP chuẩn**; local **Mailpit**; demo **Brevo** (300 email/ngày miễn phí; hệ thống cũ cũng dùng Brevo). Resend chỉ 100/ngày; SendGrid đã bỏ gói miễn phí từ 05/2025.

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

## T-12. Frontend

- **Chọn:** React + TypeScript **có SSR** — Next.js (chạy standalone) hoặc React Router v7, chọn sau một prototype nhỏ *(tình trạng 2026 của hai framework chưa kiểm chứng)*; client API sinh từ OpenAPI.
- **Lý do cần SSR:** trang campaign được **chia sẻ lên Facebook/Zalo** để kêu gọi quyên góp (FR-CMP-08) → thẻ Open Graph (ảnh, tiêu đề, mô tả) phải render phía server; SPA thuần làm việc này kém. Màn admin, bếp vẫn chạy như SPA.
- **Đăng nhập — mô hình BFF:** token OIDC (Keycloak) giữ ở server của frontend, trình duyệt chỉ giữ cookie phiên `HttpOnly` → không lưu token trong trình duyệt.
- **Đã cân nhắc:** SPA thuần (React + Vite — chia sẻ link kém); Go render trang công khai + SPA cho admin (hai cách làm UI phải duy trì).
- **Hệ quả:** thêm một pod Node trong cluster; màn nộp chứng từ ưu tiên điện thoại (FR-DSB-09); thư viện UI chọn khi bắt đầu frontend.

## T-13. Quan sát

- **Chọn:** OpenTelemetry SDK (Go, Python) cho trace và metric; log JSON (`log/slog`) kèm `correlationId` (C-8).

  | Môi trường | Backend | Ghi chú |
  |---|---|---|
  | Local | `otel-lgtm` (Grafana + Loki + Tempo + Prometheus), **tắt mặc định** | Grafana ghi rõ image này chỉ dành cho dev/demo/test; bật khi cần để tiết kiệm RAM |
  | Demo | **Grafana Cloud gói miễn phí** — 10.000 series metric, 50 GB log, 50 GB trace, lưu 14 ngày *(nguồn bên thứ ba — kiểm tra trang giá)* | Không tốn RAM VPS |

- Temporal UI đã cho xem từng bước của mọi quy trình tiền — không cần công cụ riêng cho phần đó.
- **Cảnh báo bắt buộc (NFR-08):** webhook xác thực thất bại, hàng chờ đối soát quá hạn, event vào stream lỗi, báo cáo sắp trễ hạn, workflow lỗi.

## T-14. Chạy local, CI, deploy

- **Chọn (đã chốt — [ADR-004](../adr/ADR-004-kubernetes-from-day-one.md)):** Kubernetes từ ngày đầu — **kind** (node image cố định `kindest/node:v1.35.8`) ở local và CI, **kubeadm một node** cho demo; cùng CNI (Calico), cùng Helm values cho mọi môi trường. Một công cụ dùng cho cả FoodFund và luyện thi CKA/CKAD (kind dựng node bằng kubeadm).
- **Local (NFR-05):** `make up` tạo cluster kind từ file cấu hình trong repo (mở cổng 80/443 bằng `extraPortMappings`), cài hạ tầng (CloudNativePG, Temporal, Keycloak, Traefik, SeaweedFS, Mailpit; NATS khi có consumer đầu tiên; `otel-lgtm` tuỳ chọn), deploy các service, seed dữ liệu mẫu và người dùng mỗi vai trò; `tools/paysim` giả lập thanh toán. Service đang phát triển chạy bằng `go run` nối vào cluster (cách cụ thể chọn ở S-8). Mục tiêu đo được: từ clone sạch đến gọi được API qua Traefik ≤ 10 phút.
- **CI (GitHub Actions)** — mỗi PR:
  - Go: `golangci-lint`, `go test` (unit + integration với testcontainers-go cho Postgres/NATS), ngưỡng coverage theo NFR-06.
  - Python: `ruff`, `pyright`, `pytest`, chấm điểm eval trên phản hồi đã ghi lại.
  - Hợp đồng: `buf lint`, `buf breaking`, kiểm tra code sinh từ OpenAPI.
  - Bảo mật: quét secret (gitleaks), quét lỗ hổng phụ thuộc.
  - **Smoke:** dựng cluster kind bằng `make up`, chạy luồng quyên góp → giải ngân bằng `paysim`.
  - Nhánh mặc định được bảo vệ: CI phải xanh mới merge.
- **Deploy demo:** **kubeadm một node** trên VPS (containerd, Calico, local-path-provisioner, gỡ taint control-plane để chạy workload); Traefik `hostNetwork`; image build trong CI, đẩy lên GitHub Container Registry; deploy bằng `helm upgrade` từ workflow thủ công (không GitOps ở giai đoạn 1); cert-manager cấp chứng chỉ; Cloudflare Tunnel phía trước khi bật.

---

## 12. Ước tính chi phí demo (NFR-09: ≤ ~25 USD/tháng)

| Khoản | Ước tính | Ghi chú |
|---|---|---|
| VPS 4 vCPU / 8 GB RAM | ~7–15 USD | Giá Hetzner đang thay đổi trong năm 2026 và gói rẻ có lúc hết hàng ([findstack](https://findstack.com/resources/hetzner-price-increase-2026), [bitdoze](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans)) *(chưa kiểm chứng)* |
| Tên miền | ~1 USD | |
| Model AI (HF ZeroGPU) | 0 USD | 2 Space miễn phí; dự phòng Modal trong mức credit miễn phí |
| Cloudflare R2, Brevo, Grafana Cloud | 0 USD | Gói miễn phí *(kiểm tra trang giá trước khi deploy)* |
| **Tổng** | **~8–16 USD** | |

**RAM dự kiến trên VPS:** kubeadm control plane + Calico ~0,8–1,2 GB *(chưa đo)* · Postgres ~0,5–1 GB · Keycloak ~1,25 GB · NATS < 100 MB · Temporal + UI ~0,7 GB *(số đo bên thứ ba, chưa đo)* · 6 tiến trình Go ~30–80 MB mỗi cái · AI worker (Python, không chạy model) ~150 MB · frontend Node ~150–300 MB · Traefik < 100 MB *(chưa đo)* → **~4–5 GB**, vừa VPS 8 GB (model ở ZeroGPU; lưu trữ, email, quan sát dùng dịch vụ ngoài) *(đo lại trong spike S-4)*.

---

## 13. Spike kỹ thuật trước khi viết plan triển khai

Mỗi spike là thử nghiệm nhỏ (≤ 1–2 ngày), kết quả ghi lại thành ADR ngắn trong `docs/adr/`.

| Mã | Câu hỏi cần trả lời | Ảnh hưởng |
|---|---|---|
| S-1 | SePay sandbox: tạo VA theo đơn hàng, giả lập thanh toán, nhận webhook đã ký end-to-end? Có tiền tố VA riêng cho mỗi campaign không? Thuật toán ký webhook PayOS? | T-9, BR-11 |
| S-2 | Kiểm tra cân bằng bút toán bằng constraint trigger hoãn + quyền chỉ INSERT hoạt động đúng với `pgx`/`sqlc`? | T-6, FR-LED |
| S-3 | Saga giải ngân trên Temporal + Postgres: giữ tiền → chờ tín hiệu có hạn → ghi sổ hoặc hoàn lại; webhook khởi động workflow với ID tất định (chống trùng); replay test; có bỏ được NATS không | T-4, T-5, ADR-003 |
| S-4 | Đo thời gian `make up` (kind + Calico) từ máy sạch và RAM thực tế (đặc biệt Keycloak, Temporal, control plane); test NetworkPolicy default-deny trên Calico và kindnet | NFR-05, NFR-09 |
| S-5 | PDF: Maroto v2 vs Typst với đủ 134 chữ cái tiếng Việt có dấu (gồm chữ hai dấu), kiểm tra bằng trích xuất văn bản; SeaweedFS chạy một node trong kind; xác nhận gói miễn phí R2, Brevo, Grafana Cloud | T-10, T-13 |
| S-6 | (a) Eval AI-01: Qwen3-VL-4B vs Vintern-1B-v3.5 trên MC-OCR + ảnh tự tạo đủ 3 loại (phiếu POS, viết tay, chuyển khoản), báo cáo theo từng loại, chạy **local** trên RTX 3070 (đo cả CPU). (b) Deploy 2 Space ZeroGPU (Gradio): Vintern với `trust_remote_code` có chạy không; thời gian mỗi lần gọi; quota có trừ vào tài khoản của token gọi không; thời gian chờ khi Space ngủ/xếp hàng. (c) Nếu (b) trượt: deploy lên Modal | T-11, ADR-004 |
| S-7 | Traefik: `IPAllowList` gắn qua `ExtensionRef` hoạt động (làm trên kind); Traefik `hostNetwork`/`hostPort` nhận đúng IP thật từ bên ngoài (làm trên VPS kubeadm) — trượt → Envoy Gateway | T-7, ADR-002 |
| S-8 | Vòng lặp code nhanh với cluster local: `go run` + port-forward hay công cụ đồng bộ code vào pod (kiểm tra tình trạng bảo trì của Tilt) | T-14, ADR-004 |
| S-9 | Temporal trên PostgreSQL 18: công cụ quản lý schema có hỗ trợ không, hay phải chạy thủ công / dùng PG17 riêng | T-5, T-6, ADR-001, ADR-003 |
| S-10 | Trước khi bật Cloudflare Tunnel: `cloudflared` trong cluster, lọc IP SePay phía sau tunnel, giới hạn request của Cloudflare gói miễn phí | T-7, ADR-002 |

**Trạng thái 2026-10-11** ([kết quả](../spikes/2026-10-11-s4-s7a-s9.md)): **S-4** đạt một phần — hạ tầng ~2,15 GB RAM thực, dựng ~7,6 phút lần đầu; chưa đo service ứng dụng và lần chạy thứ hai; phát hiện WSL giữ cache. **S-7** phần 1 đạt (trên kind); phần 2 cần VPS. **S-9** đạt — Temporal 1.32 tự tạo schema trên PostgreSQL 18.6. Chưa làm: S-1, S-2, S-3, S-5, S-6, S-8, S-10.

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
├── web/                 # React + TypeScript có SSR + BFF (Next.js hoặc React Router v7)
├── tools/paysim/        # Giả lập webhook SePay/PayOS đã ký
├── deploy/              # cấu hình cluster kind, Helm values (hạ tầng + service), HTTPRoute, realm Keycloak, seed
├── docs/                # requirements, decomposition, tech-stack, adr/
└── go.work
```

---

## 15. Trạng thái duyệt

- **2026-10-11:** chủ dự án duyệt toàn bộ T-1 … T-14 theo bảng tóm tắt (mục 0).
- Điều chỉnh requirement đi kèm: **giữ FR-PAY-02 (PayOS) ở [M]** (rút lại đề xuất hạ xuống [S]); thêm **FR-CMP-08** (chia sẻ campaign lên mạng xã hội có ảnh xem trước).
- Bước tiếp theo: chạy spike S-1 … S-10 (ưu tiên S-3, S-4, S-7, S-9 vì có thể làm đổi quyết định), rồi viết plan triển khai.

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

### T-10. Tệp, PDF, email — *Trung bình*

- **[Tài liệu]** MinIO bản cộng đồng ngừng phát hành image từ 10/2025, vào chế độ bảo trì rồi archive ([pinggy](https://pinggy.io/amp/blog/minio_archived_self_hosted_s3_alternatives/), [glukhov](https://glukhov.org/data-infrastructure/object-storage/minio-dead/)).
- **[Tài liệu]** Cloudflare R2: miễn phí ~10 GB, không phí băng thông ra theo phần lớn nguồn ([filebase](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/)).
- **[Tài liệu]** Tiếng Việt có 134 chữ cái mang dấu, có chữ mang hai dấu → phải test thư viện PDF; Maroto hỗ trợ font UTF-8 tuỳ chỉnh, Typst nhận thư mục font qua `--font-path`.
- **[Tài liệu]** Email: Brevo 300/ngày; Resend 100/ngày; SendGrid bỏ gói miễn phí 05/2025 ([freetier](https://freetier.co/articles/free-email-sending-tiers-2026)).

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

### T-12. React + TypeScript có SSR + BFF — *Yếu*

- **[Requirement]** FR-CMP-08 (chia sẻ campaign lên mạng xã hội cần thẻ Open Graph render phía server).
- **[Đánh giá]** Phổ biến, thể hiện kỹ năng frontend cho vị trí SE I tổng quát; BFF tránh lưu token trong trình duyệt. Chưa kiểm chứng tình trạng 2026 của Next.js và React Router v7 → prototype trước khi chọn.

### T-13. OpenTelemetry + Grafana LGTM / Grafana Cloud — *Trung bình*

- **[Requirement]** NFR-08 (trace xuyên service, cảnh báo).
- **[Tài liệu]** Image `otel-lgtm` chỉ dành cho dev/demo/test ([Grafana docs](https://grafana.com/docs/opentelemetry/docker-lgtm/)); Grafana Cloud gói miễn phí 10.000 series, 50 GB log, 50 GB trace, lưu 14 ngày ([last9](https://last9.io/blog/grafana-cloud-pricing/), [costbench](https://costbench.com/software/observability/grafana-cloud/free-plan/)).
- **[Đánh giá]** OpenTelemetry là chuẩn mở, không khoá nhà cung cấp (hệ thống cũ dùng Datadog + Sentry trả phí).

### T-14. Kubernetes từ ngày đầu (kind, kubeadm), GitHub Actions — *Trung bình* (xem [ADR-004](../adr/ADR-004-kubernetes-from-day-one.md))

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
| T-4, T-8, T-13, T-14 | RAM và thời gian khởi động thực của control plane kind, Calico, NATS, Keycloak, Postgres, Temporal, LGTM | S-4, S-8 |
| T-5 | Saga giải ngân trên Temporal, chống trùng ở điểm vào, footprint thực tế | S-3, S-4 |
| T-6 | `sqlc` báo lỗi SQL lúc sinh code; constraint trigger cân bằng bút toán | S-2 |
| T-9 | Webhook SePay end-to-end; tiền tố VA cho campaign; thuật toán ký PayOS | S-1 |
| T-10 | Thư viện PDF hỗ trợ tiếng Việt; trình giả lập S3 và giấy phép | S-5 |
| T-11 | Chất lượng hoá đơn tiếng Việt của Qwen3-VL-4B và Vintern-1B-v3.5; khả năng chạy và quota thực tế trên ZeroGPU | S-6 |
| T-7 | `IPAllowList` qua `ExtensionRef`, IP thật với Traefik `hostNetwork` trên VPS kubeadm; lọc IP sau Cloudflare Tunnel | S-7, S-10 |
| T-12 | Không cần spike — chấp nhận là quyết định theo đánh giá, dễ thay sau | — |
