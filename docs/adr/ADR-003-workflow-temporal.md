# ADR-003 — Lớp điều phối quy trình: Temporal

- **Trạng thái:** Đã chấp nhận — 2026-10-10
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (BR-01, BR-03, BR-12, FR-PAY-05, FR-TRN-02, NFR-01, NFR-07), `docs/rewrite/02-decomposition.md` (mục 5, 6), `docs/rewrite/03-tech-stack.md` (T-4, T-5), [ADR-001](./ADR-001-database-postgresql.md)
- **Loại quyết định:** gần một chiều — cách viết workflow ngấm vào code nghiệp vụ; đổi engine sau này tốn công viết lại các workflow.
- **Thay thế:** River làm outbox/job/lịch trong `03-tech-stack.md` v0.3 (hồ sơ kiến trúc A).

## Bối cảnh

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

## Quyết định

Dùng **Temporal** (tự host) làm lớp điều phối:

- **Server:** Temporal server + Web UI; lưu trạng thái trong **PostgreSQL 18** (database riêng trên cùng instance — ADR-001). PostgreSQL 12+ hỗ trợ cả lưu trữ lẫn advanced visibility, **không cần Elasticsearch** ([Temporal visibility](https://docs.temporal.io/self-hosted-guide/visibility)).
- **Worker:** service Go dùng Temporal Go SDK; service AI dùng Temporal Python SDK (phân tích chứng từ là một activity chạy trên worker Python).
- **Local và CI (kind) / demo (kubeadm một node) — theo [ADR-004](./ADR-004-kubernetes-from-day-one.md):** Helm chart chính chủ, **tắt các dependency đóng gói sẵn**, trỏ vào PostgreSQL của CloudNativePG. `temporal server start-dev` (Web UI `localhost:8233`) chỉ dùng cho test tự động và thử nhanh ngoài cluster; dev server **không dành cho production** ([Temporal CLI server](https://docs.temporal.io/cli/server)).
- **Rủi ro PostgreSQL 18:** công cụ quản lý schema có thể chỉ hỗ trợ plugin `postgres12` → kiểm chứng ở spike S-9 (xem ADR-001).
- **Giấy phép:** MIT ([temporalio/temporal](https://github.com/temporalio/temporal)).

## Thay đổi so với thiết kế trước

| Trước (hồ sơ A) | Sau |
|---|---|
| River: outbox + job + lịch | **Bỏ.** Retry, hẹn giờ, lịch định kỳ do Temporal đảm nhận |
| Saga giải ngân tự lưu trạng thái trong Funds | Workflow Temporal đọc như code tuần tự |
| Luồng xuyên service dựa hoàn toàn vào event (choreography) | **Điều phối có chủ (orchestration)** cho các quy trình tiền; workflow gọi activity của service khác qua task queue riêng |
| NATS JetStream cho mọi giao tiếp bất đồng bộ | **Chỉ còn phát event tới read model** (Transparency, Notification). Spike S-3 đánh giá bỏ hẳn NATS |

## Danh mục workflow dự kiến

| Workflow | Service sở hữu | Activity ở service khác |
|---|---|---|
| `DonationPaymentWorkflow` (theo dõi VA, hết hạn) | Funds | — |
| `FundingCloseWorkflow` | Campaign | Funds: chốt tổng tiền, phân bổ ngân sách / mở tiền dư |
| `DisbursementWorkflow` (saga) | Funds | Operations: cập nhật trạng thái yêu cầu; Campaign: chuyển phase |
| `SurplusCaseWorkflow` | Funds | Notification: gửi thông báo |
| `ReportDeadlineWorkflow` | Transparency | Funds: đối chiếu số liệu sổ cái |
| `ExpenseProofAnalysisWorkflow` | Operations | AI (Python): trích xuất và gắn cờ |
| `DailyReconciliation` (Temporal Schedule) | Funds | — |

## Luật thiết kế bắt buộc

1. **Workflow phải tất định:** không dùng `time.Now`, goroutine, số ngẫu nhiên, duyệt map không sắp xếp trong code workflow; mọi I/O (DB, HTTP, gọi service) nằm trong **activity** ([Temporal Go versioning](https://docs.temporal.io/develop/go/workflows/versioning)).
2. **Activity idempotent:** activity có thể chạy lại → mọi thao tác ghi dùng khoá chống trùng (ví dụ ràng buộc UNIQUE theo mã giao dịch ngân hàng / ID workflow + bước).
3. **Điểm vào không cần outbox:** webhook đã verify chữ ký → khởi động/gửi tín hiệu tới workflow với **workflow ID tất định** (ví dụ theo mã giao dịch của nhà cung cấp) để Temporal tự chống trùng → activity ghi sổ cái. *(Kiểm chứng trong spike S-3.)*
4. **Phát event cho read model** là một activity chạy **sau** activity ghi DB → giao ít nhất một lần → consumer idempotent (C-3).
5. **Thay đổi workflow đang chạy** dùng cơ chế versioning của Temporal (Worker Versioning hoặc patching); CI chạy **replay test** trên lịch sử workflow đã ghi lại.
6. Temporal server ngừng → workflow **tạm dừng rồi chạy tiếp** khi server lên lại, không mất trạng thái; API đọc và nhận webhook vẫn hoạt động (webhook trả lỗi tạm thời để nhà cung cấp gửi lại).

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| River + NATS + saga tự viết (hồ sơ A) | Phải tự viết trạng thái saga, hẹn giờ nhiều ngày, chờ tín hiệu — đúng chỗ hệ thống cũ hỏng |
| DBOS (thư viện trên Postgres, MIT) | Gọn nhất về hạ tầng nhưng bản Go **chưa 1.0** (0.19, 07/2026) → chưa đặt lên luồng tiền ([DBOS Go](https://github.com/dbos-inc/dbos-transact-golang)) |
| Restate (một binary, có Go SDK) | Giấy phép **BSL 1.1** (được dùng production cho service của mình; sang Apache 2.0 sau 4 năm) ([LICENSE](https://raw.githubusercontent.com/restatedev/restate/main/LICENSE)); độ trưởng thành thấp hơn Temporal |
| Hatchet (MIT, chỉ cần Postgres) | Mạnh về task queue; mô hình saga dài ngày, chờ tín hiệu kém trực quan hơn Temporal |

## Hệ quả

- **Tích cực:** hẹn giờ nhiều ngày, chờ tín hiệu, retry, bù trừ được viết như code tuần tự; Web UI xem từng bước của mọi quy trình tiền (hỗ trợ điều tra và minh bạch); bỏ được River và phần lớn vai trò của NATS; một công cụ điều phối dùng chung cho cả Go và Python.
- **Tiêu cực:**
  - **Đường cong học:** luật tất định và versioning — sai là workflow lỗi khi replay.
  - **Thêm một thành phần phải vận hành:** một phép đo bên thứ ba ghi nhận Temporal ~668 MB + UI ~9 MB (cộng Postgres ~239 MB) khi không dùng Elasticsearch ([Railway](https://railway.com/deploy/temporal-or-durable-workflows-no-elastic)) — **chưa đo trên cấu hình của dự án** (spike S-4).
  - Triển khai bằng Helm trên Kubernetes — đúng cách self-host được hỗ trợ chính thức ([Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment)); kéo theo chi phí học Kubernetes (ADR-004).
  - `02-decomposition.md` mục 5–6 phải cập nhật từ choreography sang orchestration cho các luồng tiền.

## Điều kiện để xem lại quyết định

- Spike S-3/S-4/S-9 cho thấy Temporal làm vượt RAM (laptop hoặc VPS demo), vượt mục tiêu chạy local ≤ 10 phút, hoặc không chạy ổn trên PostgreSQL 18 → chuyển sang DBOS (khi có bản Go 1.0) hoặc Restate.
- Sau 2 tuần làm việc với Temporal, luật tất định/versioning làm chậm tiến độ rõ rệt so với kế hoạch.
