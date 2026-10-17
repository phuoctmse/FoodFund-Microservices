# Spike S-2 + S-3 — Luồng tiền (money-flow): thiết kế

- **Trạng thái:** đã duyệt. D-1…D-13 duyệt 2026-10-11; D-14…D-24 (thực hành kỹ năng, giai đoạn E–H) duyệt 2026-10-15. Chủ dự án duyệt từng quyết định trong phiên brainstorming.
- **Spike gốc:** S-2 (sổ cái: trigger hoãn, quyền chỉ INSERT, `pgx`/`sqlc`) và S-3 (saga giải ngân trên Temporal, chống trùng ở điểm vào, replay) trong [tech-stack — Spike kỹ thuật](../../03-tech-stack.md#spike-kỹ-thuật).
- **Đầu vào:** [`01-requirements.md`](../../01-requirements.md) v1.5, [`02-decomposition.md`](../../02-decomposition.md) v1.1, [ADR-001](../../03-tech-stack.md#adr-001-postgresql-18), [ADR-003](../../03-tech-stack.md#adr-003-temporal).
- **Tư liệu nghiên cứu** (bằng chứng, URL, chi tiết từng kịch bản): [`research.md`](./research.md).
- **Kế hoạch theo task:** [`plan.md`](./plan.md).
- **Người thực hiện:** chủ dự án tự làm toàn bộ, kể cả code; Claude làm mentor (D-14, D-15).
- **Thời lượng:** khoảng 40 ngày công (D-24). Bản đầu 2026-10-11 chỉ có 5 ngày công cho giai đoạn A–D.

---

## 1. Spike phải trả lời gì

| # | Câu hỏi | Quyết định bị ảnh hưởng nếu trượt |
|---|---|---|
| Q1 | Entry sai hình dạng (thiếu chân, rỗng, thêm chân vào entry cũ) có bị DB từ chối lúc COMMIT, kể cả khi code Go cố tình ghi sai? | ADR-001 |
| Q2 | User ứng dụng chỉ có SELECT/INSERT: UPDATE/DELETE/TRUNCATE/tắt trigger có bị chặn? `pgx`/`sqlc` có làm việc được với ràng buộc này và nhận đúng lỗi lúc COMMIT? | T-6 |
| Q3 | Hai `Reserve` đồng thời trên một ngân sách có làm âm số dư? Khoá trong trigger có đủ? | Thiết kế sổ cái, BR-07 |
| Q4 | Webhook gửi lặp (khi workflow đang chạy, đã đóng, đã hết retention) → đúng một bút toán? | ADR-003 luật 3, C-2 |
| Q5 | Activity chạy lại sau khi DB đã commit (worker chết, hai lần thử song song) → không ghi đôi? | C-3 |
| Q6 | Saga giải ngân (hẹn giờ, Update của người dùng, case đối soát, bù trừ) chạy đúng và replay test được? | ADR-003 |
| Q7 *(P1)* | "Activity ghi DB → activity phát event" có quá nặng cho thao tác đơn giản? | T-4, C-2 |

Ngoài việc trả lời Q1–Q7, chủ dự án dùng chính hệ thống này để thực hành các kỹ năng sau:

| Kỹ năng | Thực hành ở |
|---|---|
| Cloud, hệ phân tán, kiến trúc hạ tầng | Giai đoạn A–C (Temporal, chống trùng, retry, saga) · E (deploy lên k8s) · H (đo trên hệ thống phân tán thật) |
| Độ trễ, khả năng mở rộng, nút thắt hiệu năng | Giai đoạn H |
| Kiểm thử tự động bằng Python | Giai đoạn F (pytest), G (script tấn công) |
| Kiểm thử API và database ở backend | A–C (Go, PG thật) · F (Python, từ bên ngoài vào) |
| Pen test | Giai đoạn G |
| Phân tích, chia nhỏ hệ thống phức tạp | Thói quen ở mọi task (§8.4) · threat model (G) · phân tích nút thắt (H) |
| Dùng AI agent hỗ trợ kiểm thử | Thói quen ở mọi task (§8.4) |
| Server OS, k8s | Giai đoạn E, H · sau này: spike S-7 phần 2 (VPS kubeadm) |
| Playwright | **Để sau**, khi có giao diện React (spike chưa có UI) |
| Java, Selenium | **Bỏ**: không có chỗ dùng tự nhiên trong FoodFund (Go + Python) |

---

## 2. Quyết định

| # | Quyết định | Lý do ngắn |
|---|---|---|
| D-1 | **Bút toán dạng transfer hai chân** (`debit_account`, `credit_account`, `amount > 0`), nhóm theo `journal_entry` | Cân bằng do cấu trúc; sao kê đọc thẳng "từ → đến"; cùng hình dạng TigerBeetle |
| D-2 | **Chặn âm và khoá nằm trong trigger hoãn `SECURITY DEFINER`** (khoá `accounts … FOR UPDATE` theo thứ tự id, tính lại số dư, âm → `RAISE`); ghi sổ ở READ COMMITTED, trigger từ chối REPEATABLE READ | DB tự bảo vệ khi Go sai; app không cần quyền UPDATE; số dư vẫn tính từ bút toán (FR-LED-02) |
| D-3 | **Mọi tiền thật rời ngân hàng ghi Có `platform_cash`** (giải ngân, hoàn tiền); "đã giải ngân" là truy vấn theo `kind`/`ref` | `balance(platform_cash)` = số dư ngân hàng → đối soát NFR-01 là một phép so |
| D-4 | **Update** cho thao tác của con người tới workflow (validator, kết quả đồng bộ, `UpdateID` = header `Idempotency-Key`); **Signal** chỉ cho máy → workflow | Chặn thao tác sai/sớm mà không bẩn lịch sử; chống bấm đúp |
| D-5 | **Void sau `TransferRecorded`** chỉ khi không có tiền ra nào gắn với request **và** có duyệt hai người nếu vượt ngưỡng BR-13 | Void mở lại ngân sách → rủi ro ngang một lần giải ngân |
| D-6 | **Disbursement FAILED là kết thúc**; chi lại phải tạo request mới | Khoá chống trùng `reservation:{req}:*` giữ đơn giản; audit rõ |
| D-7 | **Hạn chờ xác nhận tính từ `TransferRecorded`**; xác nhận đến sau khi case đã mở = bằng chứng gắn case, admin vẫn phải `AdminResolved` | Không bao giờ vừa ghi sổ vừa void |
| D-8 | **SePay là nguồn duy nhất ghi sổ tiền vào**; webhook PayOS chỉ cập nhật trạng thái khoản quyên góp | PayOS và SePay theo dõi cùng một tài khoản → một khoản tiền sinh hai webhook |
| D-9 | **BR-13 chặn trước khi chuyển tiền:** `Reserve → [vượt ngưỡng: SecondApproval] → MarkReadyToDisburse → TransferRecorded → …`; ngưỡng so sánh `>`, chốt vào input workflow lúc start | Sơ đồ `02` §7.3 hiện duyệt lần hai sau khi tiền đã đi |
| D-10 | **Reservation không có hạn ở tầng sổ cái**; thời gian thuộc timer Temporal, hết hạn chỉ mở case | Ngữ nghĩa "pending tự hết hạn" của TigerBeetle mâu thuẫn `02` §7.3 |
| D-11 | **Chống trùng hai lớp:** workflow ID tất định (lớp 1) + khoá nghiệp vụ `UNIQUE` trong DB (bảo đảm). Không dùng RunID/attempt/uuid làm khoá | Temporal chỉ nhớ ID trong retention; mặc định Go SDK cho phép chạy lại sau khi đóng |
| D-12 | **Versioning:** patching `GetVersion` + replay test + `workflowcheck` từ ngày đầu; chưa bật Worker Versioning | Workflow dài ngày vẫn cần patching dù có Worker Versioning |
| D-13 | **Throwaway-but-harvest:** code Go bỏ; giữ những phần ở §12 | Bố cục repo (`libs/`, `proto/`, S-8) chưa chốt; code spike chứa cờ tiêm lỗi và stub |
| D-14 | **Tự mò hoàn toàn.** Plan không chứa code: không harness, không test mẫu, không chữ ký hàm Go. Plan chỉ ghi mục tiêu, những gì đã chốt, tên test và điều kiện đạt, tài liệu nên đọc, bẫy cần tránh (chỉ nêu bẫy, không nêu cách giải). API Go do chủ dự án tự thiết kế, ghi vào `spikes/money-flow/NOTES.md` | Mục tiêu học và làm chủ code |
| D-15 | **Mentor:** không viết code trừ khi được yêu cầu rõ; gợi ý theo bậc "gợi ý 1/2/3"; review cuối mỗi task theo ba mức *phải sửa / nên sửa / để ý* | Giữ quyền làm chủ cho người học |
| D-16 | **Hai thói quen ở mọi task:** phân tích trước khi code, và dùng AI agent hỗ trợ kiểm thử (§8.4) | Kỹ năng thói quen cần lặp lại, không học một lần là xong |
| D-17 | **Ba kỹ năng cần hệ thống hoàn chỉnh thành giai đoạn riêng sau C:** F (test API), G (pen test), H (hiệu năng). Giai đoạn E (deploy) đứng trước làm nền | Giữ cổng quyết định Q1–Q6 đúng hạn; có mục tiêu thật để kiểm thử và tấn công |
| D-18 | **Giai đoạn A–D không dùng kind; E–H chạy trên cluster kind `foodfund`** | A–D chỉ cần PG và dev server, S-9 đã chứng minh phần cluster. Phép đo Q7 và hiệu năng chỉ có ý nghĩa trên Temporal thật ([research §2.5](./research.md#25-q7--phát-event-không-outbox)) |
| D-19 | **Thêm Funds API mỏng** có đặc tả OpenAPI 3.0; header `Idempotency-Key` dùng làm `UpdateID` (D-4) | Muốn test API thì phải có API; khớp T-2 |
| D-20 | **Bộ test API:** Python, pytest + httpx + psycopg 3 + schemathesis, quản lý bằng `uv` | Python trong danh sách kỹ năng; schemathesis sinh test từ OpenAPI |
| D-21 | **Pen test chỉ trong phạm vi cluster kind trên laptop.** Theo OWASP API Security Top 10 (2023) và OWASP WSTG; chấm mức độ bằng CVSS 4.0 | Hệ thống của chính chủ dự án; không đụng dịch vụ bên ngoài |
| D-22 | **Hiệu năng:** k6 ở chế độ cố định số request mỗi giây (`constant-arrival-rate`), SLO viết bằng `thresholds`; metrics và trace gửi lên Grafana Cloud bản miễn phí qua Alloy (dự phòng: Prometheus local) | Chế độ "chờ phản hồi" làm số đo độ trễ thấp hơn thực tế (*coordinated omission*); khớp T-13; tiết kiệm RAM |
| D-23 | **Đáp án ẩn:** mentor giữ riêng danh sách lỗ hổng và nút thắt dự đoán, không ghi vào plan; chỉ đem ra so sau khi chủ dự án nộp báo cáo G và H | "Tự mò" chỉ có nghĩa khi không có đáp án sẵn |
| D-24 | **Thời lượng khoảng 40 ngày công** (§10), giữ đủ phạm vi | Chủ dự án chấp nhận |

**Đã xác nhận (S-1):** định danh giao dịch của SePay là trường `id` (kiểu `integer`) trong payload webhook — "ID giao dịch trên SePay, không đổi qua mọi lần retry và replay". Dùng làm `providerTxnId` và khoá chống trùng; lưu dạng `text` trong `provider_events.provider_txn_id` để không phụ thuộc kiểu dữ liệu của từng nhà cung cấp; khoá `donation:sepay:{id}`.

---

## 3. Phạm vi

**Trong:**
1. Sổ cái: schema, trigger, role/GRANT, test đồng thời (Q1–Q3).
2. Tiền vào: webhook SePay giả có ký → `IncomingTransfer` → ghi sổ quyên góp hoặc `suspense` (Q4, Q5).
3. Saga `Disbursement` đầy đủ theo D-4…D-9, Operations và Campaign là stub (Q6).
4. Replay test đỏ/xanh với `GetVersion`.
5. Bộ kiểm tra sổ cái chạy sau mỗi kịch bản + "ngân hàng giả".
6. Giai đoạn E–H (§9): Funds API, deploy lên kind, bộ test API Python, pen test, hiệu năng.

**Ngoài (ghi quy tắc, làm khi triển khai):**
- `DonationPayment` và ca tiền đến đúng lúc VA hết hạn. Quy tắc: signal tới workflow đã đóng → tiền vào `suspense`; workflow phải rút cạn signal trước khi kết thúc.
- `AllocateBudget` (spike nạp sẵn số dư budget), làm tròn BR-06.
- NATS thật, Keycloak/JWT (actor đi trong payload; pen test ghi nhận hậu quả của việc thiếu xác thực nhưng không sửa bằng Keycloak), proto/buf.
- Java, Selenium · Playwright (để tới khi có UI) · S-7 phần 2 (VPS) · HPA và cluster nhiều node · tải lớn mang tính benchmark tuyệt đối.

**Môi trường (D-18):**
- Giai đoạn A–D: PostgreSQL 18 qua testcontainers; `temporal server start-dev --db-filename <file>` (giữ trạng thái qua restart).
- Giai đoạn E–H: cluster kind `foodfund` (CloudNativePG, Temporal, Traefik có từ S-9; cấu hình ở [`s4-config/`](../s4-config/)).

---

## 4. Cấu trúc

Nhánh `spike/money-flow`, thư mục `spikes/money-flow/` (Go module riêng):

| Thư mục | Nội dung |
|---|---|
| `migrations/` | (goose) role bootstrap; schema `ledger` (`accounts`, `journal_entries`, `transfers`, view `account_balances`, trigger `check_entry`, `forbid_mutation`); schema `funds` (`provider_events`, `disbursements`, `reconciliation_cases`, `approval_records`); `fake_bank` chỉ cho test |
| `ledger/` | `Post(ctx, Entry)` với khoá chống trùng + `request_hash`; phân loại lỗi |
| `webhook/` | Handler SePay giả: verify HMAC → lưu `provider_events` → khởi động `IncomingTransfer` → ánh xạ HTTP |
| `workflows/` | `IncomingTransfer`, `Disbursement` |
| `activities/` | Funds: `PostDonation`, `PostSuspense`, `Reserve`, `PostDisbursement`, `VoidReservation`, `OpenReconciliationCase`, `RecordApproval`, `Publish` (bộ nhớ); stub `operations.*`, `campaign.*` ghi lời gọi vào bảng |
| `harness/` | Khởi động PG/Temporal, chạy worker như tiến trình con (kill/restart được), điểm tiêm lỗi (build tag `spike`), `AssertLedgerInvariants` |

Thêm khi tới task cần: `faults/`, `cmd/`, `scenarios/`, `api/`, `deploy/`, `apitests/`, `perf/`, `journal/`.

---

## 5. Sổ cái

### 5.1 Role

| Role | LOGIN | Quyền |
|---|---|---|
| `funds_owner` | Không | Sở hữu schema, bảng, hàm, trigger |
| `funds_migrator` | Có | Member của `funds_owner`; goose chạy `SET ROLE funds_owner` |
| `funds_app` | Có | `USAGE` trên schema; `SELECT, INSERT` trên `ledger.*`; quyền thường trên bảng nghiệp vụ `funds.*`. Không sở hữu gì, không superuser, không member của owner/`pg_write_all_data` |
| `funds_qa` *(từ giai đoạn E)* | Có | Chỉ `SELECT`, dùng cho bộ test Python |

`ENABLE ALWAYS` cho trigger kiểm tra (vẫn chạy khi `session_replication_role = replica`). `forbid_mutation` (BEFORE UPDATE/DELETE/TRUNCATE) là lưới an toàn cho sai sót của owner.

### 5.2 Schema (phác thảo — DDL đầy đủ ở [research §1.2](./research.md#12-phác-thảo-ddl))

- `accounts(id uuidv7, code UNIQUE, normal_side 'D'|'C', allow_negative bool DEFAULT false)`
- `journal_entries(id, idempotency_key UNIQUE, request_hash, kind, transfer_count, ref_type, ref_id, actor, created_at)`
- `transfers(id, entry_id, debit_account_id, credit_account_id, amount bigint CHECK > 0, CHECK debit <> credit)` — không CASCADE
- Số dư = `SUM` có index (không bảng cache).
- Trigger hoãn `check_entry()` trên cả `journal_entries` và `transfers`: (1) từ chối REPEATABLE READ; (2) số chân thực tế = `transfer_count`; (3) khoá các tài khoản cấm âm mà entry chạm tới theo thứ tự id, tính lại số dư, âm → lỗi.
- Lỗi trigger: `ERRCODE = check_violation (23514)`, `CONSTRAINT` ∈ {`ledger_entry_complete`, `ledger_account_nonnegative`, `ledger_isolation`}.

### 5.3 Bút toán

| Thao tác | Nợ | Có | Khoá chống trùng |
|---|---|---|---|
| Tiền quyên góp vào (SePay) | `platform_cash` | `campaign_received:{c}` | `donation:sepay:{txnId}` |
| Tiền vào không khớp | `platform_cash` | `suspense` | `suspense:sepay:{txnId}` |
| Nạp ngân sách (seed, thay `AllocateBudget`) | `campaign_received:{c}` | `budget:{phase}:{cat}` | `seed:{phase}:{cat}` |
| Giữ tiền | `budget:{phase}:{cat}` | `reserved:{req}` | `reservation:{req}:reserve` |
| Giải ngân | `reserved:{req}` | `platform_cash` | `reservation:{req}:resolve` |
| Huỷ giữ tiền | `reserved:{req}` | `budget:{phase}:{cat}` | `reservation:{req}:resolve` |

Dữ liệu test luôn đi đúng chiều tiền: ghi quyên góp trước (để `platform_cash`, `campaign_received` có số dư) rồi mới nạp ngân sách.

Giải ngân và huỷ dùng chung khoá → `UNIQUE` bảo đảm chỉ một trong hai. Mọi tài khoản trong spike cấm âm. Số tiền giải ngân = số giữ = số đã duyệt; không giải ngân một phần.

### 5.4 Ghi idempotent

`INSERT journal_entries … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` → không có dòng → đọc entry cũ: `request_hash` giống → trả `id` cũ; khác → `ErrIdempotencyConflict` (non-retryable). Khi trùng khoá không có INSERT nào → trigger không chạy → `Reserve` chạy lại sau khi đã commit trả kết quả cũ, không báo "thiếu ngân sách".

### 5.5 Phân loại lỗi

| Lỗi | Xử lý |
|---|---|
| `23514` + `ledger_account_nonnegative` | Kết quả nghiệp vụ `InsufficientFunds` (non-retryable) |
| `23514` khác, `23505` ngoài khoá idempotency, `ErrIdempotencyConflict`, `pgx.ErrTxCommitRollback` | Bug → non-retryable + log |
| `40001`, `40P01`, lỗi kết nối (`08xxx`, `57P01`) | Retryable |

---

## 6. Tiền vào: webhook → `IncomingTransfer`

- Handler: verify HMAC (sai → 401, không gọi Temporal) → `INSERT provider_events … ON CONFLICT (provider, provider_txn_id) DO NOTHING` (lưu `payload_hash`) → **luôn** gọi `ExecuteWorkflow`, kể cả khi event đã có.
- `StartWorkflowOptions`: ID `transfer-sepay-{txnId}`, task queue `funds`, `WorkflowIDConflictPolicy = FAIL`, `WorkflowIDReusePolicy = ALLOW_DUPLICATE_FAILED_ONLY`, `WorkflowExecutionErrorWhenAlreadyStarted = true`. Namespace đặt retention tường minh.
- Ánh xạ HTTP (timeout handler 5–10 s):

| Kết quả | HTTP |
|---|---|
| Khởi động mới | 200 |
| `WorkflowExecutionAlreadyStarted` | 200 (+ metric trùng) |
| Temporal `Unavailable` / `ResourceExhausted` / hết timeout | 503 |
| Lỗi khác | 500 + cảnh báo |

- Cùng `txnId` nhưng `payload_hash` khác → không ghi sổ lần hai, ghi cảnh báo/case, vẫn trả 200.
- `IncomingTransfer`: khớp mã đơn → `PostDonation`; không khớp → `PostSuspense` + `OpenReconciliationCase`.

---

## 7. Saga `Disbursement`

ID `disbursement-{requestId}`, `WorkflowIDReusePolicy = REJECT_DUPLICATE` (D-6). Input gồm ngưỡng BR-13 và hạn chờ xác nhận (chốt lúc start; test dùng hạn ngắn).

```
Reserve ──(InsufficientFunds)──► operations.RejectRequest → kết thúc
   │
   ├─ amount > ngưỡng → chờ Update SecondApproval (approver ≠ người duyệt request) ──(Cancel)──► Void
   │
operations.MarkReadyToDisburse → chờ Update TransferRecorded (số tiền = số đã duyệt) ──(Cancel)──► Void
   │
   ═══════ PIVOT: từ đây không bao giờ tự Void ═══════
   │
chờ Update ReceiptConfirmed / ReceiptDisputed, hạn tính từ TransferRecorded
   ├─ Confirmed → PostDisbursement → operations.MarkDisbursed → campaign.AdvancePhase → Publish DisbursementCompleted
   └─ hết hạn / Disputed → OpenReconciliationCase → chờ Update AdminResolved
          ├─ Transferred → PostDisbursement → … (như trên)
          └─ NotTransferred (không có tiền ra gắn request + duyệt hai người nếu > ngưỡng)
                 → VoidReservation → operations.MarkDisbursementFailed → Publish DisbursementFailed → FAILED
```

- Update: `SecondApproval`, `TransferRecorded`, `ReceiptConfirmed`, `ReceiptDisputed`, `AdminResolved`, `Cancel`. Validator chỉ đọc state, từ chối sai bước / sai người / trùng; handler đổi state trước mọi lời gọi chặn, ghi `approval_records` qua activity rồi mới trả.
- `ReceiptConfirmed` đến khi case đã mở: chấp nhận, ghi làm bằng chứng; vẫn cần `AdminResolved`.
- Activity Funds: `StartToCloseTimeout` 10 s, retry backoff 1 s × 2, tối đa 1 phút, không giới hạn số lần. Activity ở task queue khác (`operations`, `campaign`): luôn đặt `StartToCloseTimeout`, **không** đặt `ScheduleToStartTimeout` sau pivot. Stub phía đích idempotent.
- Trước khi kết thúc: chờ `AllHandlersFinished`.

---

## 8. Kiểm thử

### 8.1 Hạ tầng test

- **Bộ kiểm tra sổ cái** (`ledger_audit.sql` + `AssertLedgerInvariants`), chạy sau mỗi kịch bản. Viết lại các truy vấn I-1…I-13 ở [research §3.3](./research.md#33-bộ-bất-biến-ledger-audit) cho mô hình transfer (D-1) và D-3:
  1. Mỗi entry có đúng `transfer_count` chân.
  2. Không tài khoản nào âm.
  3. Mỗi `(provider, txnId)` có đúng một bút toán; số tiền ghi = số nhà cung cấp báo.
  4. Không request nào vừa giải ngân vừa huỷ; trạng thái `disbursements` khớp sổ cái.
  5. `balance(platform_cash)` = số dư `fake_bank`; không có huỷ giữ tiền khi đã có tiền ra gắn request.
  6. Không có `provider_events` mồ côi quá 5 phút.
  7. Quyền/cấu hình: `funds_app` không có UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN trên `ledger.*`, không sở hữu đối tượng, không superuser; trigger `tgenabled = 'A'`.
  - Phía Temporal: không workflow Failed/Terminated ngoài ca cố ý; không lỗi nondeterminism; replay toàn bộ history của lần chạy → pass.
- **Test the test:** mỗi kịch bản P0 có biến thể sai (cờ `NAIVE_*` hoặc schema biến thể chỉ cho test) **bắt buộc FAIL**. Công tắc bỏ khoá không bao giờ nằm trong SQL được giữ lại.
- **Điểm tiêm lỗi** (build tag `spike`): `after_commit_exit` (`os.Exit(1)` sau commit), `before_commit_sleep`, `between_read_and_write_sleep`, `after_commit_return_error` (lần thử 1).

### 8.2 Kịch bản P0 (bắt buộc)

Mã kịch bản theo [research §3.2](./research.md#32-danh-mục-kịch-bản).

| Nhóm | Kịch bản | Đạt khi |
|---|---|---|
| **Sổ cái (Q1)** | L1 entry khai 2 chân, ghi 1 · L2 entry rỗng · L3 thêm chân vào entry đã commit · L4 ghi các chân bằng nhiều câu lệnh trong một tx · L5 `amount ≤ 0`, debit = credit · L6 `SET CONSTRAINTS ALL IMMEDIATE` giữa entry | L1–L3 lỗi lúc COMMIT đúng `ConstraintName`, không còn dòng nào; L4 thành công; L5 lỗi ngay câu lệnh; L6 ghi lại hành vi |
| **Quyền (Q2)** — A5, A6, A7 | `funds_app` thử UPDATE/DELETE/TRUNCATE, `ON CONFLICT DO UPDATE`, `SELECT … FOR UPDATE`, `DISABLE TRIGGER`, `SET session_replication_role`; lỗi COMMIT về Go; `sqlc generate` trên migration PG18; pool `MaxConns=1` dùng tiếp sau COMMIT lỗi | Tất cả bị chặn `42501`; `errors.As` ra `*pgconn.PgError` với `Code`/`ConstraintName` đúng; ghi lại `sqlc` có cần database-backed analysis |
| **Đồng thời (Q3)** — B1 (gồm B4, B5) | 50 goroutine `Reserve` 100.000 trên budget 1.000.000, pool 50 kết nối, lặp 50 vòng, `-race`; biên X / X+1; một Reserve trong REPEATABLE READ | Đúng 10 thành công / 40 `InsufficientFunds` / 0 lỗi khác mỗi vòng; số dư cuối 0; RR bị từ chối. **Biến thể bỏ khoá + `pg_sleep` phải FAIL** |
| **Tiền vào (Q4)** — C1 (gồm C8), C2 (gồm C3), C4, C5, C7 | Trùng khi workflow đang chạy (10 song song); trùng sau khi đã đóng; trùng sau khi xoá execution (giả lập hết retention); cùng số tiền khác `txnId`; cùng `txnId` khác payload; Temporal ngừng lúc webhook đến rồi gửi lại | Đúng một bút toán mỗi `txnId`, mọi bản trùng trả 200; hai `txnId` khác → hai bút toán; khác payload → cảnh báo, không ghi thêm; Temporal ngừng → 503, không bút toán, gửi lại → 200 + một bút toán. **Bỏ UNIQUE + reuse policy mặc định phải FAIL** |
| **Chạy lại (Q5)** — D1, D2, D3, D4 | Worker chết sau commit (`PostDonation`, `Reserve`, `PostDisbursement`); hai lần thử chạy song song; cùng khoá khác số tiền; `Reserve` chạy lại sau commit | Một entry mỗi khoá, lần sau trả cùng `entryId`; khác số tiền → non-retryable; `Reserve` chạy lại không trả `InsufficientFunds`. **Khoá sinh bằng `uuid.New()` phải FAIL** |
| **Saga (Q6)** — E1, E2, E3, E4, E7, E9, E10, E16 | Đường thuận dưới/trên ngưỡng; xác nhận trước khi chuyển; Update trùng/mâu thuẫn; xác nhận muộn khi case đã mở; cùng admin duyệt hai lần; 4 nhánh `AdminResolved`/`Disputed`; NotTransferred khi đã có tiền ra; sửa thứ tự activity → replay | Trên ngưỡng không `MarkReady` trước SecondApproval; Update sai bước/sai người bị validator từ chối; mỗi request đúng một kết cục (giải ngân **hoặc** huỷ); huỷ khi đã có tiền ra bị từ chối, đối soát vẫn 0; sửa thô → replay **đỏ**, bọc `GetVersion` → **xanh** |

### 8.3 Kịch bản P1 (nếu còn thời gian)

A8 số tiền biên/tràn · B3 deadlock theo thứ tự khoá · D5 `eventId` tất định · D6 publish lỗi sau khi đã ghi sổ không bù trừ · E5 Update tới workflow đã đóng · E6 Update đúng biên hạn chót · E8 gửi signal vòng qua Funds bằng CLI/Web UI (ghi nhận) · E14 worker chết giữa saga · E15 Temporal khởi động lại giữa saga · E17 khởi động lại `disbursement-{req}` sau FAILED bị từ chối · E19 số tiền `TransferRecorded` khác số duyệt → case · F1 `workflowcheck` · **Q7:** đo độ trễ p50/p95 (tx thường vs ghi-rồi-phát), số event history mỗi thao tác, hành vi khi Temporal ngừng, số dòng boilerplate.

### 8.4 Thói quen ở mọi task (D-16)

**Phân tích trước khi code** (khoảng 20–30 phút), ghi vào `spikes/money-flow/journal/task-NN.md`:
1. Thành phần nào tham gia, dữ liệu đi qua đâu.
2. Cái gì có thể hỏng, và hậu quả với tiền.
3. Danh sách ca test của mình.

**AI hỗ trợ kiểm thử:**
1. Đưa cùng bối cảnh cho một AI agent **khác mentor** (agy/Gemini, hoặc một phiên Claude mới). Nhờ nó liệt kê ca test, và sau khi viết xong thì nhờ nó review test.
2. Ghi vào nhật ký: AI tìm ra gì mà mình bỏ sót · AI sai hoặc bịa ở đâu · mình đã kiểm chứng bằng cách nào.
3. **Luật:** không thứ gì từ AI vào repo nếu chưa được chạy và kiểm chứng.
4. Cuối spike: tổng kết "AI trong kiểm thử: chỗ nào có ích, chỗ nào không", kèm ví dụ cụ thể lấy từ nhật ký.

---

## 9. Giai đoạn E–H

### 9.1 Funds API

Một tiến trình HTTP chung với webhook (cùng image, cùng Deployment). Actor vẫn đi trong body (Keycloak/JWT ngoài phạm vi, §3).

| Endpoint | Việc làm |
|---|---|
| `POST /disbursements` | Khởi động saga `disbursement-{requestId}` (thay cho Operations thật); ngưỡng BR-13 và hạn chờ xác nhận lấy từ cấu hình |
| `POST /disbursements/{id}/{action}` | `action` ∈ {`second-approval`, `transfer-recorded`, `receipt-confirmed`, `receipt-disputed`, `admin-resolved`, `cancel`} → `UpdateWorkflow` với `UpdateID` = `Idempotency-Key`, chờ tới stage Completed |
| `GET /disbursements/{id}` | Trạng thái từ `funds.disbursements` |
| `GET /accounts/{code}/balance` | Số dư từ view sổ cái |
| `POST /webhooks/sepay` | Webhook đã có từ Task 9 |

Ánh xạ HTTP cho `POST /disbursements/{id}/{action}`:

| Kết quả | HTTP |
|---|---|
| Update hoàn thành | 200 |
| Thiếu `Idempotency-Key`, body sai | 400 |
| Không có workflow | 404 |
| Validator từ chối, hoặc workflow đã đóng | 409 |
| Handler trả lỗi nghiệp vụ (ví dụ `NotTransferred` khi đã có tiền ra) | 422 |
| Temporal ngừng, worker ngừng, hết thời gian chờ | 503 |

Đặc tả `spikes/money-flow/api/openapi.yaml` (OpenAPI 3.0.x) do chủ dự án viết **trước** khi code API.

### 9.2 Deploy lên kind

Manifest viết tay (được dùng kustomize, không dùng Helm) ở `spikes/money-flow/deploy/`:
- **Database:** cluster CloudNativePG riêng cho `funds` (PostgreSQL 18.6). Role `funds_owner`, `funds_migrator`, `funds_app`, `funds_qa` khai báo qua `spec.managed.roles`. **Không** dùng user `app` mặc định của CNPG, vì user đó là owner ([research §1.5](./research.md#15-q2--role-quyền-lỗi-commit-và-sqlc)).
- **Migration:** `Job` chạy goose bằng `funds_migrator`.
- **Ứng dụng:** `Deployment` cho webhook + API; `Deployment` riêng cho worker. Image build bằng Docker, nạp vào cluster bằng `kind load docker-image`.
- **Temporal:** dùng Temporal của cluster (S-9); namespace `moneyflow` với retention đặt rõ.
- **Mạng:** `HTTPRoute` qua Traefik cho `/webhooks/sepay` và `/disbursements`, `/accounts`; NetworkPolicy.
- **Cấu hình:** Secret cho DSN và khoá HMAC; probe; requests/limits.

**Đạt khi:** dựng từ đầu bằng một lệnh và mọi pod Ready; đi hết một saga bằng `curl` qua Traefik; `ledger_audit.sql` sạch trên DB của cluster; ghi lại thời gian dựng và RAM tăng thêm.

### 9.3 Bộ test API bằng Python

Dự án Python riêng ở `spikes/money-flow/apitests/`, chạy bằng một lệnh `uv run pytest` vào hệ thống trên kind.

| Nhóm | Nội dung |
|---|---|
| Hợp đồng | Response khớp `openapi.yaml`; schemathesis chạy trên toàn bộ đặc tả |
| Chức năng | Đi hết saga qua API (dưới/trên ngưỡng, hết hạn, đối soát, huỷ); webhook tiền vào khớp/không khớp |
| Chống trùng | Gửi lại cùng `Idempotency-Key`; webhook lặp |
| Âm | Thiếu header, body sai kiểu, sai bước (409), sai người duyệt |
| Database | Sau mỗi lần gọi API, đọc trạng thái bằng `funds_qa`; chạy `ledger_audit.sql` sau mỗi test |
| Đồng thời | Bấm đúp cùng lúc; nhiều webhook song song |

**Đạt khi:**
- Toàn bộ bộ test xanh trên cluster.
- Mỗi test tự tạo dữ liệu riêng (không phụ thuộc thứ tự chạy).
- schemathesis không tìm ra lỗi 5xx nào chưa được ghi lại.
- Có ít nhất một test "phải FAIL" khi tắt một cơ chế bảo vệ (theo tinh thần §8.1).

### 9.4 Pen test

**Luật phạm vi (D-21):** chỉ tấn công cluster kind trên laptop. Không quét hay gửi gì tới địa chỉ bên ngoài, kể cả dịch vụ thật của SePay.

**Quy trình:**
1. **Threat model:** sơ đồ luồng dữ liệu, ranh giới tin cậy (internet → Traefik → webhook/API → Temporal → DB), bảng STRIDE.
2. **Do thám:** những gì lộ ra ngoài cluster; những gì gọi được từ bên trong một pod.
3. **Tấn công** năm bề mặt: webhook · Funds API · database · Temporal · Kubernetes.
4. **Báo cáo** `docs/spikes/money-flow/pentest.md`: mỗi lỗ hổng có cách tái hiện, vector CVSS 4.0, hậu quả với tiền, cách sửa.

**Công cụ:** OWASP ZAP (quét theo OpenAPI) · script tấn công Python trong `apitests/attacks/` · kubescape · `psql` · CLI `temporal`.

**Sau báo cáo:** lỗ hổng mức Cao trở lên phải sửa, kèm test hồi quy trong `apitests/`. Mức thấp hơn ghi thành rủi ro đã biết, kèm hướng xử lý khi dựng Funds thật. Mentor so báo cáo với đáp án ẩn (D-23) và ghi tỉ lệ tìm được vào báo cáo.

### 9.5 Hiệu năng

**Chuẩn bị:**
- Instrument webhook, API và worker bằng OpenTelemetry (gồm interceptor OTel của Temporal Go SDK).
- Alloy gửi dữ liệu lên Grafana Cloud bản miễn phí.
- Bật `pg_stat_statements`, dùng metrics của Temporal.
- Tắt tạm Keycloak (`replicas: 0`) để lấy lại RAM.

**Quy trình:**
1. **Đặt SLO trước khi đo**, viết vào `thresholds` của k6. Mentor review.
2. **Đo mốc ban đầu**, rồi tăng tải từng bậc tới khi vượt SLO.
3. **Tìm nút thắt bằng bằng chứng** (trace, truy vấn chậm, độ trễ hàng đợi Temporal, CPU bị giới hạn). Mỗi lần một giả thuyết, đổi một thứ, đo lại.
4. **Cải thiện khả năng mở rộng:** ít nhất một thay đổi, có số đo trước và sau.
5. **Đo Q7** theo [research §2.5](./research.md#25-q7--phát-event-không-outbox).
6. **Thí nghiệm coordinated omission:** cùng một mức tải, chạy kiểu "chờ phản hồi" và kiểu `constant-arrival-rate`, so hai số p95.

**Báo cáo** `docs/spikes/money-flow/performance.md`: SLO, các bậc tải, nút thắt kèm bằng chứng, thay đổi và số đo trước/sau, kết quả Q7. Ghi rõ hạn chế: máy tạo tải chạy chung laptop với cluster, nên số đo chỉ mang tính tương đối.

---

## 10. Lịch và cổng quyết định

Tổng ~40 ngày công (≈ 8 tuần): 0–D ~23, mỗi giai đoạn E–H 4, I 1. Lịch theo task ở [plan](./plan.md#lịch).

- **Cổng D (sau giai đoạn C):** kết luận Q1–Q6, để mở khoá các quyết định kiến trúc đang chờ.
- **Cổng sau mỗi giai đoạn E–H:** ghi kết quả, cùng mentor quyết đi tiếp hay cắt.
- 8 tuần là khoảng 30% quỹ 5–6 tháng của dự án. Phần bù lại: sản phẩm của E–H dùng lại được cho Funds thật (§12).

---

## 11. Tiêu chí xong

Mỗi câu Q1–Q6 có kết luận **đạt / trượt** kèm bằng chứng (lệnh chạy + output). Trượt thì áp dụng phương án dự phòng:

| Trượt | Phương án dự phòng |
|---|---|
| Q1 / Q3 | Bảng cache số dư + `CHECK (balance >= 0)` qua hàm `SECURITY DEFINER`; xem lại ADR-001 |
| Q2 (`sqlc` không phân tích được migration PG18) | Bật database-backed analysis; nếu vẫn lỗi → viết tay phần query sổ cái bằng `pgx` |
| Q4 / Q5 | Thêm inbox (quét `provider_events` mồ côi) / outbox tối thiểu trong `libs/events` |
| Q6 | Xem lại ADR-003 theo điều kiện đã ghi trong ADR |

---

## 12. Đầu ra

1. **Kết quả** ở `docs/spikes/money-flow/`: `results.md` (từng câu hỏi, số đo, lệnh tái hiện), `pentest.md`, `performance.md`.
2. **Phần giữ lại (D-13):**
   - Migration SQL (role, schema `ledger`, trigger), `ledger_audit.sql` + helper.
   - Danh sách kịch bản dưới dạng tên test kèm biến thể "phải FAIL".
   - Bảng phân loại lỗi (§5.5, §6), bảng tài khoản (§5.3).
   - `api/openapi.yaml` làm bản nháp cho Funds API thật.
   - Manifest deploy, đặc biệt CNPG `managed.roles` và tách role.
   - Cấu trúc bộ `apitests/` (fixture, kiểm DB, audit sau mỗi test).
   - Script k6, SLO và quy trình đo.
   - Checklist pen test và các test hồi quy bảo mật.
   - Mục tổng kết AI trong kiểm thử.
3. **Cập nhật tài liệu** (sau khi có kết quả):

| Tài liệu | Sửa |
|---|---|
| ADR-001, T-6 (`03-tech-stack.md`) | Bỏ "pending/post/void có hạn" cho giải ngân (D-10); ghi mô hình transfer hai chân (D-1) và khoá trong trigger (D-2) |
| ADR-003 luật 3, `02` §7.1 | "Workflow ID tất định giảm chạy song song; UNIQUE ở DB là bảo đảm" (D-11); reuse/conflict policy |
| `02` §4 | Bảng tài khoản: tiền ra ghi Có `platform_cash`, bỏ tài khoản `disbursed:{c}` (D-3) |
| `02` §5, §7.3 | Thứ tự BR-13 (D-9); Update thay Signal cho thao tác người dùng (D-4); void sau pivot (D-5); hạn tính từ `TransferRecorded` (D-7) |
| `02` §7.1, C-2 | Gọi đúng tên inbox cho `provider_events` + quét mồ côi; signal tới `DonationPayment` đã đóng → `suspense`; SePay là nguồn ghi sổ duy nhất (D-8) |
| `01` BR-03 | Thêm FAILED là trạng thái kết thúc (D-6) |
| `01` BR-06 | Phân bổ số nguyên; phần dư làm tròn vào `surplus:{c}` |
| `01` BR-13 | Ngưỡng `>`, chốt lúc khởi động workflow |
| `01` FR-PAY-11 | Duyệt tay bắt buộc nhập mã giao dịch ngân hàng, dùng cùng khoá `donation:sepay:{txnId}` |
| `02` C-7 | Cơ chế ép: NetworkPolicy tới frontend Temporal, Web UI tắt thao tác ghi, `actorId` trong payload |
