# Spike S-2 + S-3 — Luồng tiền (money-flow): thiết kế

- **Trạng thái:** Đã duyệt thiết kế — 2026-10-11 (chủ dự án duyệt từng quyết định trong phiên brainstorming)
- **Spike gốc:** S-2 (sổ cái: trigger hoãn, quyền chỉ INSERT, `pgx`/`sqlc`) và S-3 (saga giải ngân trên Temporal, chống trùng ở điểm vào, replay) trong [`03-tech-stack.md` §13](../rewrite/03-tech-stack.md)
- **Đầu vào:** [`01-requirements.md`](../rewrite/01-requirements.md) v1.5, [`02-decomposition.md`](../rewrite/02-decomposition.md) v1.1, [ADR-001](../adr/ADR-001-database-postgresql.md), [ADR-003](../adr/ADR-003-workflow-temporal.md)
- **Báo cáo của nhóm chuyên gia** (bằng chứng, URL, chi tiết từng kịch bản): [ledger/PostgreSQL](./s2-s3-panel/01-ledger-postgres.md) · [Temporal](./s2-s3-panel/02-temporal.md) · [kiểm thử đối kháng](./s2-s3-panel/03-adversarial-tests.md)
- **Timebox:** 5 ngày công. Hết giờ thì dừng, ghi lại phần chưa làm. *(Đã thay bằng khoảng 40 ngày công trong [thiết kế bổ sung 2026-10-15](./2026-10-15-s2-s3-money-flow-skills-addendum.md), có thêm giai đoạn E–H chạy trên kind.)*

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

---

## 2. Quyết định đã chốt trong phiên thiết kế

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
| D-9 | **BR-13 chặn trước khi chuyển tiền:** `Reserve → [vượt ngưỡng: SecondApproval] → MarkReadyToDisburse → TransferRecorded → …`; ngưỡng so sánh `>`, chốt vào input workflow lúc start | Sơ đồ §7.3 hiện duyệt lần hai sau khi tiền đã đi |
| D-10 | **Reservation không có hạn ở tầng sổ cái**; thời gian thuộc timer Temporal, hết hạn chỉ mở case | Ngữ nghĩa "pending tự hết hạn" của TigerBeetle mâu thuẫn §7.3 |
| D-11 | **Chống trùng hai lớp:** workflow ID tất định (lớp 1) + khoá nghiệp vụ `UNIQUE` trong DB (bảo đảm). Không dùng RunID/attempt/uuid làm khoá | Temporal chỉ nhớ ID trong retention; mặc định Go SDK cho phép chạy lại sau khi đóng |
| D-12 | **Versioning:** patching `GetVersion` + replay test + `workflowcheck` từ ngày đầu; chưa bật Worker Versioning | Workflow dài ngày vẫn cần patching dù có Worker Versioning |
| D-13 | **Throwaway-but-harvest:** code Go bỏ; giữ migration SQL, bộ kiểm tra sổ cái, danh sách kịch bản (tên test), bảng phân loại lỗi, bảng tài khoản | Bố cục repo (`libs/`, `proto/`, S-8) chưa chốt; code spike chứa cờ tiêm lỗi và stub |

**Đã xác nhận (S-1):** định danh giao dịch của SePay là trường `id` (kiểu `integer`) trong payload webhook — "ID giao dịch trên SePay, không đổi qua mọi lần retry và replay". Dùng làm `providerTxnId` và khoá chống trùng; lưu dạng `text` trong `provider_events.provider_txn_id` để không phụ thuộc kiểu dữ liệu của từng nhà cung cấp; khoá `donation:sepay:{id}`.

---

## 3. Phạm vi

**Trong:**
1. Sổ cái: schema, trigger, role/GRANT, test đồng thời (Q1–Q3).
2. Tiền vào: webhook SePay giả có ký → `IncomingTransfer` → ghi sổ quyên góp hoặc `suspense` (Q4, Q5).
3. Saga `Disbursement` đầy đủ theo D-4…D-9, Operations và Campaign là stub (Q6).
4. Replay test đỏ/xanh với `GetVersion`.
5. Bộ kiểm tra sổ cái chạy sau mỗi kịch bản + "ngân hàng giả".

**Ngoài (ghi quy tắc, làm khi triển khai):**
- `DonationPayment` và ca tiền đến đúng lúc VA hết hạn. Quy tắc: signal tới workflow đã đóng → tiền vào `suspense`; workflow phải rút cạn signal trước khi kết thúc.
- `AllocateBudget` (spike nạp sẵn số dư budget), làm tròn BR-06.
- NATS thật, Keycloak/JWT (actor đi trong payload), proto/buf, CloudNativePG `managed.roles`.

**Môi trường:** PostgreSQL 18 qua testcontainers; `temporal server start-dev --db-filename <file>` (giữ trạng thái qua restart). **Không dùng kind** — S-9 đã chứng minh phần cluster.

---

## 4. Cấu trúc

Nhánh riêng, thư mục `spikes/money-flow/` (Go module riêng):

| Thư mục | Nội dung |
|---|---|
| `migrations/` | (goose) role bootstrap; schema `ledger` (`accounts`, `journal_entries`, `transfers`, view `account_balances`, trigger `check_entry`, `forbid_mutation`); schema `funds` (`provider_events`, `disbursements`, `reconciliation_cases`, `approval_records`); `fake_bank` chỉ cho test |
| `ledger/` | `Post(ctx, Entry)` với khoá chống trùng + `request_hash`; phân loại lỗi |
| `webhook/` | Handler SePay giả: verify HMAC → lưu `provider_events` → khởi động `IncomingTransfer` → ánh xạ HTTP |
| `workflows/` | `IncomingTransfer`, `Disbursement` |
| `activities/` | Funds: `PostDonation`, `PostSuspense`, `Reserve`, `PostDisbursement`, `VoidReservation`, `OpenReconciliationCase`, `RecordApproval`, `Publish` (bộ nhớ); stub `operations.*`, `campaign.*` ghi lời gọi vào bảng |
| `harness/` | Khởi động PG/Temporal, chạy worker như tiến trình con (kill/restart được), điểm tiêm lỗi (build tag `spike`), `AssertLedgerInvariants` |

---

## 5. Sổ cái

### 5.1 Role

| Role | LOGIN | Quyền |
|---|---|---|
| `funds_owner` | Không | Sở hữu schema, bảng, hàm, trigger |
| `funds_migrator` | Có | Member của `funds_owner`; goose chạy `SET ROLE funds_owner` |
| `funds_app` | Có | `USAGE` trên schema; `SELECT, INSERT` trên `ledger.*`; quyền thường trên bảng nghiệp vụ `funds.*`. Không sở hữu gì, không superuser, không member của owner/`pg_write_all_data` |

`ENABLE ALWAYS` cho trigger kiểm tra (vẫn chạy khi `session_replication_role = replica`). `forbid_mutation` (BEFORE UPDATE/DELETE/TRUNCATE) là lưới an toàn cho sai sót của owner.

### 5.2 Schema (phác thảo — DDL đầy đủ ở [báo cáo ledger §1.2](./s2-s3-panel/01-ledger-postgres.md))

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

- **Bộ kiểm tra sổ cái** (`ledger_audit.sql` + `AssertLedgerInvariants`), chạy sau mỗi kịch bản. Viết lại các truy vấn I-1…I-13 của [báo cáo kiểm thử §3](./s2-s3-panel/03-adversarial-tests.md) cho mô hình transfer (D-1) và D-3:
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

Mã kịch bản theo [báo cáo kiểm thử](./s2-s3-panel/03-adversarial-tests.md) và [báo cáo ledger](./s2-s3-panel/01-ledger-postgres.md) §2.4, §3.4, §4.3.

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

---

## 9. Tiêu chí xong

Mỗi câu Q1–Q6 có kết luận **đạt / trượt** kèm bằng chứng (lệnh chạy + output). Trượt thì áp dụng phương án dự phòng:

| Trượt | Phương án dự phòng |
|---|---|
| Q1 / Q3 | Bảng cache số dư + `CHECK (balance >= 0)` qua hàm `SECURITY DEFINER`; xem lại ADR-001 |
| Q2 (`sqlc` không phân tích được migration PG18) | Bật database-backed analysis; nếu vẫn lỗi → viết tay phần query sổ cái bằng `pgx` |
| Q4 / Q5 | Thêm inbox (quét `provider_events` mồ côi) / outbox tối thiểu trong `libs/events` |
| Q6 | Xem lại ADR-003 theo điều kiện đã ghi trong ADR |

---

## 10. Đầu ra

1. `docs/spikes/<ngày hoàn thành>-s2-s3-money-flow.md` — kết quả từng câu hỏi, số đo, lệnh tái hiện.
2. Phần giữ lại (D-13): migration SQL (role, schema `ledger`, trigger), `ledger_audit.sql` + helper, danh sách kịch bản dưới dạng tên test kèm biến thể "phải FAIL", bảng phân loại lỗi (§5.5, §6), bảng tài khoản (§5.3).
3. Cập nhật tài liệu (sau khi có kết quả):

| Tài liệu | Sửa |
|---|---|
| ADR-001, `03-tech-stack.md` T-6 | Bỏ "pending/post/void có hạn" cho giải ngân (D-10); ghi mô hình transfer hai chân (D-1) và khoá trong trigger (D-2) |
| ADR-003 luật 3, `02` §7.1 | "Workflow ID tất định giảm chạy song song; UNIQUE ở DB là bảo đảm" (D-11); reuse/conflict policy |
| `02` §4 | Bảng tài khoản: tiền ra ghi Có `platform_cash`, bỏ tài khoản `disbursed:{c}` (D-3) |
| `02` §5, §7.3 | Thứ tự BR-13 (D-9); Update thay Signal cho thao tác người dùng (D-4); void sau pivot (D-5); hạn tính từ `TransferRecorded` (D-7) |
| `02` §7.1, C-2 | Gọi đúng tên inbox cho `provider_events` + quét mồ côi; signal tới `DonationPayment` đã đóng → `suspense`; SePay là nguồn ghi sổ duy nhất (D-8) |
| `01` BR-03 | Thêm FAILED là trạng thái kết thúc (D-6) |
| `01` BR-06 | Phân bổ số nguyên; phần dư làm tròn vào `surplus:{c}` |
| `01` BR-13 | Ngưỡng `>`, chốt lúc khởi động workflow |
| `01` FR-PAY-11 | Duyệt tay bắt buộc nhập mã giao dịch ngân hàng, dùng cùng khoá `donation:sepay:{txnId}` |
| `02` C-7 | Cơ chế ép: NetworkPolicy tới frontend Temporal, Web UI tắt thao tác ghi, `actorId` trong payload |
| `03-tech-stack.md` T-5 | Sửa câu chữ: `start-dev` chỉ cho test tự động và thử nhanh (khớp ADR-003) |
