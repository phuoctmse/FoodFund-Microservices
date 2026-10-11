# Panel S-3 — Góc nhìn Temporal (Go SDK): Q4, Q5, Q6, Q7

- **Vai trò:** chuyên gia workflow Temporal (Go SDK)
- **Ngày:** 2026-10-11
- **Phiên bản tham chiếu:** Temporal server 1.32.0 (đã chạy trong S-9), Go SDK mới nhất **v1.49.0** (phát hành 14/09, [releases](https://github.com/temporalio/sdk-go/releases) — trang không ghi năm, suy ra là 2026)
- **Ký hiệu:** *(chưa kiểm chứng)* = chưa tìm thấy trong tài liệu chính thức; spike phải xác nhận.

---

## Tóm tắt khuyến nghị

| # | Khuyến nghị | Đảo ngược được? |
|---|---|---|
| Q4 | Webhook → **`ExecuteWorkflow` thường** (không SignalWithStart, không UpdateWithStart), ID `transfer-{provider}-{txnId}`, `ConflictPolicy=Fail`, `ReusePolicy=AllowDuplicateFailedOnly`, `WorkflowExecutionErrorWhenAlreadyStarted=true`; trùng → **200**, Temporal lỗi → **503**. **Bắt buộc** thêm UNIQUE `(provider, provider_txn_id)` trong DB — dedup của Temporal chỉ có hiệu lực trong thời gian retention. | Dễ |
| Q4b | `IncomingTransfer` → `DonationPayment` bằng **`SignalExternalWorkflow`** (mang `providerTxnId`); `DonationPayment` tự chống trùng theo `providerTxnId` và **rút hết signal trước khi kết thúc**; đích đã đóng → tiền vào `suspense`. | Dễ |
| Q5 | Khoá chống trùng là **khoá nghiệp vụ** (`donation:{txnId}`, `reserve:{requestId}`…), **không** dùng RunID+ActivityID. Kiểm tra khoá **trước** kiểm tra số dư. Lỗi nghiệp vụ → `NewNonRetryableApplicationError`. Tiêm lỗi bằng cờ "commit xong rồi trả lỗi" (lần thử 1) + biến thể `os.Exit` thật. | Dễ |
| Q6 | Thao tác của con người dùng **Update** (có validator, trả kết quả đồng bộ cho API, `UpdateID` chống bấm đúp); máy-tới-workflow dùng **Signal**. Versioning: **patching (`GetVersion`) + replay test + `workflowcheck` từ ngày đầu**; chưa bật Worker Versioning. | Trung bình |
| Q7 | Trong luồng tiền (đã là workflow) activity publish gần như miễn phí. Với thao tác ghi đơn giản, chi phí thật **không phải hiệu năng mà là ghép độ sẵn sàng vào Temporal** và boilerplate. Spike đo 4 chỉ số rồi chọn; dù chọn gì, giữ **interface `Publisher` + envelope event trong `proto/`** để đổi transport (NATS / gọi thẳng qua activity) mà không đụng code nghiệp vụ. | Dễ nếu có interface |
| — | Spike **throwaway-but-harvest**: đồng ý. | — |

---

## 1. Q4 — Chống trùng ở điểm vào

### 1.1 Ngữ nghĩa hiện tại (đã kiểm chứng)

Nguồn: [Workflow Id / Run Id](https://docs.temporal.io/workflow-execution/workflowid-runid), Go SDK `internal/client.go` (qua context7 `/temporalio/sdk-go`).

| Tình huống | Policy quyết định | Giá trị | Mặc định |
|---|---|---|---|
| Đã có execution **đang chạy** cùng ID | `WorkflowIDConflictPolicy` | `Fail` (trả lỗi *already started*), `UseExisting` (trả RunID đang chạy), `TerminateExisting` | **`Fail`** |
| Execution cùng ID **đã đóng** | `WorkflowIDReusePolicy` | `AllowDuplicate`, `AllowDuplicateFailedOnly` (chỉ khi lần trước không *Completed*), `RejectDuplicate`, `TerminateIfRunning` | **`AllowDuplicate`** ← nguy hiểm cho dedup |

Điểm then chốt:

1. **Không bao giờ có hai execution đang chạy cùng ID**, bất kể policy ("regardless of the Workflow Id Reuse Policy").
2. **Reuse policy chỉ nhìn thấy execution đã đóng còn trong retention.** Tài liệu nói rõ: workflow chỉ được chạy một lần thì retention phải đủ dài để phủ phép kiểm tra. Hết retention → ID dùng lại được như mới.
3. **Bẫy của Go SDK:** mặc định `WorkflowExecutionErrorWhenAlreadyStarted=false` → khi server trả `WorkflowExecutionAlreadyStarted`, SDK **nuốt lỗi** và trả `WorkflowRun` của lần chạy hiện tại/cuối cùng. Handler không phân biệt được "mới" và "trùng". Đặt `true` để nhận `*serviceerror.WorkflowExecutionAlreadyStarted` (code SDK trích từ `internal_workflow_client.go`).
4. Mặc định reuse là `AllowDuplicate` → nếu quên đặt policy, webhook gửi lại **sau khi** `IncomingTransfer` đã hoàn thành sẽ **khởi động lần chạy mới** → ghi sổ lần hai nếu DB không chặn.

### 1.2 Chọn API cho từng điểm

**(a) Webhook → `IncomingTransfer`: dùng `client.ExecuteWorkflow` thường.**

| Lựa chọn | Vì sao không / có |
|---|---|
| **Start thường** ✅ | Đúng ngữ nghĩa "mỗi giao dịch ngân hàng = một quy trình"; trả về ngay khi server ghi nhận, không cần worker đang chạy → webhook trả lời nhanh (SePay chờ tối đa 30 s). |
| SignalWithStart ❌ | Không có gì để gửi. Mặc định của nó là `UseExisting` → bản trùng sẽ thành **signal thứ hai** vào workflow đang chạy → phải tự dedup trong code workflow; còn workflow đã đóng thì theo reuse policy lại khởi động lần mới. Thêm việc, không thêm an toàn. |
| UpdateWithStart ❌ | **Không nguyên tử** ("Unlike Signal-with-Start - Update-With-Start is *not* atomic") và kết quả phụ thuộc worker đang chạy ([Sending messages](https://docs.temporal.io/sending-messages)) → webhook bị ghép với tình trạng worker. Không cần kết quả đồng bộ ở đây. |

Cấu hình đề xuất:

```go
opts := client.StartWorkflowOptions{
    ID:        fmt.Sprintf("transfer-%s-%s", provider, providerTxnID),
    TaskQueue: "funds",
    WorkflowIDConflictPolicy: enumspb.WORKFLOW_ID_CONFLICT_POLICY_FAIL,
    WorkflowIDReusePolicy:    enumspb.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
    WorkflowExecutionErrorWhenAlreadyStarted: true,
}
```

Vì sao `AllowDuplicateFailedOnly` thay vì `RejectDuplicate`: nếu một `IncomingTransfer` bị **terminate/fail** (bug, operator dừng tay), lần gửi lại của nhà cung cấp sẽ **xử lý lại từ đầu** — an toàn vì activity ghi sổ idempotent theo khoá nghiệp vụ (Q5). `RejectDuplicate` thì giao dịch đó kẹt vĩnh viễn, phải can thiệp tay. Đổi một dòng nếu chủ dự án thích chặt hơn.

**Thứ tự trong handler** (quan trọng, dễ sai):

```
verify chữ ký → INSERT provider_event ... ON CONFLICT (provider, provider_txn_id) DO NOTHING
             → ExecuteWorkflow (LUÔN gọi, kể cả khi INSERT bị conflict)
             → map lỗi → HTTP
```

Không được "thấy `provider_event` đã có thì trả 200 luôn": lần trước có thể đã lưu event nhưng Temporal sập trước khi start → lần gửi lại là cơ hội duy nhất để khởi động workflow.

**Ánh xạ lỗi → HTTP** (context timeout của handler ~5–10 s, < 30 s của SePay):

| Kết quả `ExecuteWorkflow` | HTTP | Ghi chú |
|---|---|---|
| `nil` | 200 | Mới khởi động |
| `*serviceerror.WorkflowExecutionAlreadyStarted` | **200** | Trùng → đã nhận. Log info + metric `webhook_duplicate_total`. Trả 4xx/5xx sẽ khiến nhà cung cấp gửi lại vô ích |
| `*serviceerror.Unavailable`, `ResourceExhausted`, `context.DeadlineExceeded` | **503** | Nhà cung cấp gửi lại (C-9) |
| `InvalidArgument`, `NamespaceNotFound`, lỗi khác | 500 + cảnh báo | Lỗi cấu hình/bug; vẫn là 5xx để không mất tin |
| Chữ ký sai (trước Temporal) | 401 | Không gọi Temporal |

### 1.3 Chỉ dựa vào workflow ID có đủ cho BR-08 không? **Không.**

Workflow ID là **lớp chống trùng thứ nhất** (rẻ, chặn phần lớn), DB là **lớp bất biến**:

- Dedup chỉ có hiệu lực **trong retention** của namespace. Namespace `foodfund` tạo trong S-9 **chưa đặt retention rõ ràng**; giá trị mặc định của `temporal operator namespace create --retention` không được ghi trên trang CLI ([operator](https://docs.temporal.io/cli/operator)) *(chưa kiểm chứng giá trị mặc định)* → đặt rõ, ví dụ 30 ngày.
- Các đường **ngoài webhook** có thể đưa cùng giao dịch vào lại: `DailyReconciliation` lấy giao dịch từ API ngân hàng, admin nhập tay, chạy lại sau sự cố, reset workflow.
- `AllowDuplicateFailedOnly` (đề xuất ở trên) **dựa vào** DB để an toàn.
- ADR-003 luật 2 và C-3 đã yêu cầu UNIQUE — spike chỉ cần chứng minh nó làm việc.

→ **Khuyến nghị:** UNIQUE `(provider, provider_txn_id)` trên `provider_event` **và** UNIQUE `idempotency_key` trên `journal_entry` (khoá `donation:{provider}:{txnId}`). Hai lớp, một cái là tối ưu, một cái là bảo đảm.

### 1.4 `IncomingTransfer` → `DonationPayment`

`DonationPayment` (`donation-{intentId}`) đã chạy từ khi donor tạo khoản quyên góp; nó **có thể đã đóng** (VA hết hạn). Một VA có thể nhận **nhiều** giao dịch (thiếu + bổ sung, FR-PAY-03).

| Lựa chọn | Đánh giá |
|---|---|
| **`workflow.SignalExternalWorkflow`** từ `IncomingTransfer` ✅ | Tất định, ghi một lần trong lịch sử (replay không gửi lại). Đích đã đóng → future trả lỗi → `IncomingTransfer` xử lý như "tiền đến muộn" → `suspense` + case đối soát (đúng §7.2 "tiền đến sau khi đã chốt"). Không cần worker của đích đang chạy. |
| Activity gọi `client.UpdateWorkflow` (UpdateID = txnId) | Có kết quả đồng bộ (validator từ chối nếu đã hết hạn) nhưng phải nhét client Temporal vào activity, phụ thuộc worker đích, thêm một tầng. Chỉ đáng nếu spike thấy race ở dòng dưới không xử lý được bằng signal. |
| SignalWithStart thẳng từ webhook tới `donation-{intentId}` ❌ | Signal **không có** dedup sẵn ([Handling messages](https://docs.temporal.io/handling-messages): "Signals have no built-in Update ID") và `AllowDuplicate` sẽ **hồi sinh** `DonationPayment` đã đóng. Mất ranh giới dedup theo giao dịch. |

Ràng buộc cho `DonationPayment`:

- Signal `PaymentReceived{providerTxnID, amount}` → giữ `map/set` các txnId đã xử lý (duyệt map phải sắp xếp — C-10).
- **Race VA hết hạn ↔ tiền đến:** sau khi timer hết hạn và trước `return`, phải **rút cạn** signal channel (`ReceiveAsync` vòng lặp). Signal đến khi workflow chưa đóng vẫn được giao; nếu bỏ qua thì tiền thật không được ghi. Đây là ca test bắt buộc.
- Ai ghi sổ? Đề xuất **`DonationPayment` ghi** (nó biết số tiền kỳ vọng → PAID/PARTIAL/OVERPAID), khoá `donation:{provider}:{txnId}`. `IncomingTransfer` chỉ ghi khi không khớp/đến muộn (vào `suspense`). Hai đường cùng khoá → dù ai ghi cũng chỉ một lần.
- Kiểu lỗi chính xác khi `SignalExternalWorkflow` tới workflow đã đóng *(chưa kiểm chứng tên kiểu lỗi trong Go — spike ghi lại)*.

---

## 2. Q5 — Activity idempotent

### 2.1 Khoá chống trùng: nghiệp vụ, không phải RunID + ActivityID

Tài liệu Temporal gợi ý ghép **Workflow Run Id + Activity Id** vì "guaranteed to be consistent across retry attempts but unique among Workflow Executions" ([Activity definition](https://docs.temporal.io/activity-definition)). Với **sổ cái**, cách này **không đủ**:

| Rủi ro | Hậu quả với RunID+ActivityID |
|---|---|
| **Workflow reset** (công cụ sửa sự cố thường dùng) | RunID mới → khoá mới → **ghi sổ lần hai** |
| Continue-As-New | RunID mới |
| `AllowDuplicateFailedOnly` khởi động lại | RunID mới |
| ActivityID trong Go là số thứ tự lịch sử | Đổi thứ tự activity khi versioning → khoá khác |
| Hai workflow khác nhau ghi cùng một sự việc (`IncomingTransfer` và `DonationPayment`) | Không chặn được |

→ **Khoá = định danh nghiệp vụ + bước**, truyền từ workflow vào activity như tham số:

| Activity | Khoá |
|---|---|
| `PostDonation` | `donation:{provider}:{providerTxnId}` |
| `PostSuspense` | `suspense:{provider}:{providerTxnId}` |
| `Reserve` | `reserve:{requestId}` |
| `PostDisbursement` | `disburse:{requestId}` |
| `VoidReservation` | `void:{requestId}` |
| `OpenReconciliationCase` | `recon:disbursement:{requestId}` |
| Publish event | `eventId` tất định, ví dụ `DisbursementCompleted:{requestId}` |

### 2.2 Mẫu ghi một transaction

```sql
-- trong cùng một tx (READ COMMITTED)
INSERT INTO journal_entry (id, idempotency_key, payload_hash, ...)
VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id;
-- 0 dòng → SELECT id, payload_hash FROM journal_entry WHERE idempotency_key = $1
--   hash khác → lỗi KHÔNG retry "IdempotencyKeyMismatch" (bug: cùng khoá, khác nội dung)
--   hash giống → trả id cũ, COMMIT (không ghi posting)
-- 1 dòng → INSERT posting ...; COMMIT (trigger hoãn kiểm cân bằng ở COMMIT — Q1/Q2)
```

- **Hai lần thử chạy đồng thời** (lần 1 "zombie" vẫn chạy sau khi StartToClose hết hạn, lần 2 bắt đầu — Temporal không giết được lần 1): INSERT thứ hai **chờ** khoá của unique index tới khi tx thứ nhất commit → `DO NOTHING` → câu SELECT kế tiếp (snapshot mới trong READ COMMITTED) thấy dòng đã commit. Đúng ngữ nghĩa PostgreSQL; spike nên có một ca chứng minh.
- **`Reserve` — bẫy thứ tự:** phải **tra khoá trước, kiểm tra số dư sau**. Nếu kiểm số dư trước, lần thử lại sau khi đã commit sẽ thấy ngân sách "thiếu" (vì chính khoản giữ lần 1 đã trừ) → trả `InsufficientBudget` → workflow từ chối yêu cầu **trong khi tiền vẫn bị giữ**. Đây là ca test giá trị nhất của Q5 (giao với Q3: khoá hàng ngân sách `SELECT … FOR UPDATE` nằm sau bước tra khoá).
- Activity trả về **cùng kết quả** cho mọi lần thử (id bút toán), để workflow không phân biệt "mới" và "đã có".

### 2.3 Retry policy và lỗi không retry

Ghi sổ cái (Funds, cùng DB):

```go
ao := workflow.ActivityOptions{
    StartToCloseTimeout: 10 * time.Second,          // luôn đặt (tài liệu "strongly recommend")
    RetryPolicy: &temporal.RetryPolicy{
        InitialInterval: time.Second, BackoffCoefficient: 2,
        MaximumInterval: time.Minute,
        MaximumAttempts: 0,                          // không giới hạn: DB sập thì chờ, không bỏ cuộc
    },
}
```

- Lỗi nghiệp vụ do **activity** quyết định: `temporal.NewNonRetryableApplicationError(msg, "InsufficientBudget", nil)` ([temporal API](https://github.com/temporalio/sdk-go/blob/main/_autodocs/api-reference/temporal.md)). Ưu tiên cách này hơn liệt kê `NonRetryableErrorTypes` ở phía workflow — nơi hiểu lỗi là nơi phân loại.
- Danh sách type không retry đề xuất: `InsufficientBudget`, `IdempotencyKeyMismatch`, `UnbalancedEntry` (trigger hoãn từ chối — Q1; thử lại vô ích), `InvalidState`.
- Phân loại lỗi pgx: SQLSTATE lớp `08` (kết nối), `40001`, `40P01`, `57P01` → retry; `23xxx` ngoài khoá idempotency và SQLSTATE riêng của trigger → không retry. Spike ghi lại SQLSTATE thực tế mà trigger trả ở COMMIT (giao với Q2).
- Mặc định `MaximumAttempts=0` nghĩa là không giới hạn ([RetryPolicy](https://github.com/temporalio/sdk-go/blob/main/_autodocs/types.md)).

### 2.4 Tiêm lỗi "commit xong, mất kết quả" một cách tất định

Ba mức, từ rẻ đến thật:

| # | Cách | Chứng minh gì | Môi trường |
|---|---|---|---|
| F1 | Wrapper `faultinject.AfterCommit(ctx, "PostDonation")`: nếu `activity.GetInfo(ctx).Attempt == 1` và cờ bật → **commit rồi trả** `temporal.NewApplicationError("injected: result lost", "InjectedFault")` (retryable) | Lần thử 2 thấy khoá → không ghi thêm; workflow nhận cùng id | `testsuite` + PostgreSQL thật (activity thật, không mock) |
| F2 | Cờ môi trường `FAULT_EXIT_AFTER_COMMIT=PostDonation` → `os.Exit(1)` ngay sau commit ở lần thử 1; khởi động lại worker không có cờ | Đường thật: worker chết, **không báo hoàn thành**, StartToClose (đặt 5 s cho test) hết hạn → lần thử 2 ở worker mới | dev server hoặc kind |
| F3 | Activity ngủ **sau** INSERT, **trước** COMMIT lâu hơn StartToClose → lần 2 chạy song song lần 1 | Zombie attempt + unique index chặn | dev server; tuỳ chọn |

Kiểm: đếm `journal_entry` theo khoá = 1, `SUM(posting)` = 0 theo entry, số lần thử ≥ 2 (lịch sử: `ActivityTaskStarted.attempt`).

Ghi chú: việc `TestWorkflowEnvironment` thực thi retry policy của activity thật (không mock) là hiểu biết của tôi về SDK *(chưa kiểm chứng bằng tài liệu — F1 tự nó xác nhận; nếu không, F1 chuyển sang dev server)*. Cờ tiêm lỗi chỉ đọc từ biến môi trường/build tag test, **không** để trong code production.

---

## 3. Q6 — Saga giải ngân

### 3.1 Signal hay Update cho thao tác của con người? **Update.**

| Tiêu chí | Signal | Update |
|---|---|---|
| Kết quả cho API | Không (fire-and-forget) → API trả 202, UI phải đợi DB | **Đồng bộ**: API trả 200/409 ngay |
| Từ chối thao tác sai (sai trạng thái, cùng admin duyệt hai lần — BR-13) | Phải nhận rồi tự bỏ qua trong code; lỗi ứng dụng trong signal handler **làm fail cả workflow** | **Validator** từ chối; bị từ chối thì "no indication that it was ever requested" — lịch sử sạch; lỗi trong handler **không** làm fail workflow ([Handling messages](https://docs.temporal.io/handling-messages)) |
| Bấm đúp | Tự dedup bằng khoá trong payload | Server dedup theo **UpdateID** (trong một run) |
| Phụ thuộc worker | Không | Có: worker Funds phải chạy để validator chạy → API trả 503 khi worker chết. Chấp nhận được vì API và worker cùng service Funds |

→ **Update** cho `TransferRecorded`, `SecondApproval`, `ReceiptConfirmed`, `ReceiptDisputed`, `AdminResolved`, `Cancel`; `UpdateID` = id lệnh do API sinh (hoặc header `Idempotency-Key`). **Signal** cho máy-tới-workflow (`PaymentReceived`). C-7 vẫn giữ: chỉ Funds API (sau khi kiểm quyền) gọi Update.

Quy tắc trong handler: validator chỉ đọc state; handler **đổi state ngay dòng đầu (trước mọi lời gọi chặn)**, sau đó chạy activity ghi `ApprovalRecord`/bằng chứng vào DB rồi mới trả → khi API trả 200 thì DB (nguồn sự thật của UI) đã phản ánh. Hai Update cùng lúc (hai admin bấm `SecondApproval`) có cùng qua validator không *(chưa kiểm chứng thứ tự validator/handler trong cùng workflow task)* → handler kiểm lại state và trả lỗi; spike có một ca test.

Go: `workflow.SetUpdateHandlerWithOptions(ctx, name, handler, UpdateHandlerOptions{Validator: ...})`; client `UpdateWorkflow(..., WaitForStage: WorkflowUpdateStageCompleted)`; lỗi client timeout là `*client.WorkflowUpdateServiceTimeoutOrCanceledError` (context7 `/temporalio/sdk-go`). Update đã bật mặc định trên server 1.32 *(chưa kiểm chứng trực tiếp — bước 0 của spike gửi thử một Update)*.

### 3.2 Một điểm thiết kế cần chủ dự án quyết

Sơ đồ §7.3 đặt `SecondApproval` **sau** `TransferRecorded` — tức tiền đã rời tài khoản rồi mới duyệt lần hai. Duyệt hai người (BR-13) chỉ có nghĩa khi **chặn trước** hành động. Đề xuất: `Reserve → (vượt ngưỡng: chờ SecondApproval) → MarkReadyToDisburse → chờ TransferRecorded`. Phác thảo dưới theo đề xuất này.

### 3.3 Phác thảo workflow (pseudo-Go)

```go
func DisbursementWorkflow(ctx workflow.Context, in DisbursementInput) (DisbursementResult, error) {
    s := &disbState{Phase: PhaseInit}          // khởi tạo state TRƯỚC khi đăng ký handler
    registerUpdates(ctx, s, in)                 // validator kiểm s.Phase, BR-13: approver != in.ApprovedBy
    funds := withFundsOpts(ctx)                 // task queue "funds", retry vô hạn
    ops   := withRemoteOpts(ctx, "operations")  // không ScheduleToStart (xem §5)
    camp  := withRemoteOpts(ctx, "campaign")

    // Ngưỡng BR-13 + thời hạn: đọc MỘT LẦN, đóng băng vào state (tất định + có giá trị audit)
    var cfg DisbConfig
    exec(funds, a.GetDisbursementConfig, in.CampaignID).Get(ctx, &cfg)

    // 1. Giữ tiền: pending budget → reserved
    if err := exec(funds, a.Reserve, ReserveIn{Key: "reserve:" + in.RequestID, ...}).Get(ctx, nil); err != nil {
        if isAppErr(err, "InsufficientBudget") {
            exec(ops, "operations.RejectRequest", in.RequestID, "insufficient_budget").Get(ctx, nil)
            return failed("insufficient_budget"), nil
        }
        return DisbursementResult{}, err
    }

    // 2. BR-13: chặn TRƯỚC khi chuyển tiền
    if in.Amount > cfg.DualApprovalThreshold {
        s.Phase = PhaseAwaitingSecondApproval
        workflow.Await(ctx, func() bool { return s.SecondApproved || s.Cancelled })
    }
    if !s.Cancelled {
        exec(ops, "operations.MarkReadyToDisburse", in.RequestID).Get(ctx, nil)
        s.Phase = PhaseAwaitingTransfer
        workflow.Await(ctx, func() bool { return s.Transfer != nil || s.Cancelled })
    }
    if s.Cancelled { // chưa có tiền rời tài khoản → bù trừ an toàn
        return compensate(ctx, s, in, "cancelled")  // VoidReservation(reserved→budget) + RejectRequest + publish
    }

    // ===== PIVOT: admin ghi nhận đã chuyển tiền. Từ đây KHÔNG BAO GIỜ tự void. =====
    s.Phase = PhaseAwaitingReceipt
    ok, _ := workflow.AwaitWithTimeout(ctx, cfg.ReceiptTimeout /* 7 ngày */, func() bool { return s.Receipt != nil })
    if !ok || s.Receipt.Disputed {
        exec(funds, a.OpenReconciliationCase, "recon:disbursement:"+in.RequestID).Get(ctx, nil)
        exec(funds, a.Publish, evt("ReconciliationCaseOpened", in.RequestID)).Get(ctx, nil)
        s.Phase = PhaseReconciliation
        workflow.Await(ctx, func() bool { return s.Resolution != nil })   // AdminResolved
        if s.Resolution.Outcome == NotTransferred {
            exec(funds, a.VoidReservation, "void:"+in.RequestID).Get(ctx, nil)
            exec(ops, "operations.MarkDisbursementFailed", in.RequestID).Get(ctx, nil)
            exec(funds, a.Publish, evt("DisbursementFailed", in.RequestID)).Get(ctx, nil)
            return failed("not_transferred"), nil
        }
    }

    // 3. Chỉ đi tới (forward recovery): retry vô hạn, không bù trừ
    exec(funds, a.PostDisbursement, "disburse:"+in.RequestID).Get(ctx, nil) // post pending reserved → disbursed
    exec(ops,  "operations.MarkDisbursed", in.RequestID).Get(ctx, nil)
    exec(camp, "campaign.AdvancePhase", in.PhaseID).Get(ctx, nil)
    exec(funds, a.Publish, evt("DisbursementCompleted", in.RequestID)).Get(ctx, nil)

    workflow.Await(ctx, func() bool { return workflow.AllHandlersFinished(ctx) })
    return completed(), nil
}
```

Nguyên tắc saga thể hiện ở trên:

- **Pivot = `TransferRecorded`.** Trước pivot: lỗi/huỷ → bù trừ `reserved → budget`. Sau pivot: chỉ đi tới; hết hạn hoặc tranh chấp → **case đối soát**, không auto-void (đúng §7.3).
- Lỗi activity sau pivot **không được** dẫn tới bù trừ → activity sau pivot không có timeout không-retry (§5).
- Mọi activity ghi đều có khoá nghiệp vụ (Q5).
- Không có timer "admin chưa chuyển tiền" — YAGNI; có `Cancel` là đủ cho spike.
- `ReceiptConfirmed` đến khi đã ở `PhaseReconciliation`: validator **chấp nhận và ghi lại**, nhưng vẫn cần `AdminResolved` để đóng case *(quyết định nghiệp vụ — chủ dự án xác nhận)*.

### 3.4 Kiểm thử

**(a) `testsuite` có tua thời gian** — chạy trong `go test`, không cần server. Activity mock bằng `env.OnActivity(...)`; activity ở task queue khác đăng ký theo tên chuỗi; gửi Update bằng `env.RegisterDelayedCallback(func(){ env.UpdateWorkflow(name, id, cb, args...) }, delay)`; timer 7 ngày tự tua ([testsuite](https://github.com/temporalio/sdk-go/blob/main/internal/internal_workflow_testsuite_test.go)).

| Ca | Kỳ vọng |
|---|---|
| T1 dưới ngưỡng, đường vui | Reserve → MarkReady → Transfer → Receipt → Post → MarkDisbursed → AdvancePhase → Publish |
| T2 trên ngưỡng | Không gọi MarkReady trước SecondApproval |
| T3 BR-13 cùng admin | Validator từ chối; workflow vẫn chờ |
| T4 thiếu ngân sách | RejectRequest; **không** MarkReady |
| T5 hết 7 ngày → AdminResolved(Transferred) | OpenReconciliationCase, rồi Post |
| T6 hết 7 ngày → AdminResolved(NotTransferred) | Void + MarkDisbursementFailed; **không** Post |
| T7 ReceiptDisputed | Như T5/T6 |
| T8 Update sai pha (Receipt trước Transfer) | Bị từ chối |
| T9 Update trùng UpdateID | Một lần hiệu lực |
| T10 Cancel trước pivot / sau pivot | Trước: Void; sau: bị từ chối |
| **Bất biến** | `VoidReservation` không bao giờ được gọi sau `TransferRecorded` trừ khi `AdminResolved=NotTransferred` |

**(b) Replay test từ lịch sử thật.** Chạy T1, T5, T6 trên dev server (`temporal server start-dev`) với `ReceiptTimeout` ngắn (cấu hình, ví dụ 5 s) → `temporal workflow show -w <id> --output json > testdata/histories/*.json` → test dùng `worker.NewWorkflowReplayer()` + `ReplayWorkflowHistoryFromJSONFile` ([worker API](https://github.com/temporalio/sdk-go/blob/main/_autodocs/api-reference/worker.md)). **Bằng chứng cần thu:** (1) cố ý đổi thứ tự `MarkDisbursed`/`AdvancePhase` → replay test **đỏ**; (2) bọc thay đổi bằng `workflow.GetVersion` → **xanh** với lịch sử cũ.

**(c) Lint tất định:** `workflowcheck` (contrib của sdk-go, bản v0.6.0 ngày 08/10 — [releases](https://github.com/temporalio/sdk-go/releases)) trong CI, hiện thực hoá C-10.

### 3.5 Versioning: patching từ ngày đầu, chưa bật Worker Versioning

Đã kiểm chứng:

- Worker Versioning **GA từ 30/03/2026** ([blog](https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new)); yêu cầu server ≥ **1.29.1**, Go SDK ≥ **1.35.0** ([Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)) → server 1.32 và SDK 1.49 đủ.
- Bản thử nghiệm cũ (trước 2025, theo build ID) **bị gỡ khỏi server từ 03/2026** ([Go versioning](https://docs.temporal.io/develop/go/versioning)) → bỏ qua các bài blog/sample cũ.
- Hướng dẫn chính thức: workflow **Pinned** giữ phiên bản worker cũ sống tới khi xong; workflow kéo dài qua nhiều lần deploy **không** dùng Continue-As-New → **Auto-Upgrade + patching** (vẫn phải patching).
- `GetVersion` **không bị deprecate**; là cơ chế chính cho thay đổi trên workflow đang chạy.

Áp vào FoodFund: `Disbursement` (ngày–tuần), `CampaignLifecycle` (tuần–tháng), `SurplusCase`, `ReportDeadline` đều dài hơn chu kỳ deploy của một người làm → Pinned buộc chạy song song nhiều Deployment worker trên laptop 16 GB → không hợp; Auto-Upgrade vẫn cần patching. Worker Versioning chỉ thêm giá trị cho workflow ngắn (`RecordAndPublish`) — vốn hiếm khi đổi.

→ **Khuyến nghị:** ngày đầu dùng **patching (`GetVersion`) + replay test trong CI + `workflowcheck`**; worker chạy không versioning. Xem lại Worker Versioning khi có pipeline deploy demo ổn định (dùng Temporal Worker Controller trên k8s). Đảo ngược được: tài liệu có đường chuyển workflow chưa versioning sang versioning *(chưa đọc chi tiết quy trình chuyển)*.

---

## 4. Q7 — Phát event không outbox

### 4.1 Chi phí thật của `RecordAndPublish` cho thao tác ghi đơn giản

So với một transaction thường, mỗi thao tác (ví dụ duyệt thành viên) thành: StartWorkflow → workflow task → activity ghi → workflow task → activity publish → workflow task → hoàn thành. Ước lượng ~3 workflow task, 2 activity task, ~15 event lịch sử, vài chục lần ghi vào DB của Temporal *(ước lượng, chưa đo)*.

Theo tôi, hiệu năng **không** phải vấn đề chính (lưu lượng thấp). Vấn đề là:

1. **Ghép độ sẵn sàng:** Temporal sập → **mọi** thao tác ghi có phát event đều 503, không chỉ luồng tiền. Bán kính ảnh hưởng của Temporal mở rộng từ "quy trình tiền" sang "gần như mọi lệnh ghi".
2. **Ngữ nghĩa API:** hoặc API chờ kết quả workflow (độ trễ + phụ thuộc worker), hoặc trả 202 và UI đọc DB chưa cập nhật. Lỗi kiểm tra dữ liệu (validation) phải đi vòng qua kết quả workflow.
3. **Boilerplate & versioning:** mỗi đường ghi = một workflow type, một ID scheme, thêm vào phạm vi replay test.

Ngược lại: trong luồng tiền (đã là workflow), activity publish **gần như miễn phí** — giữ nguyên.

### 4.2 Phương án

| Phương án | Ưu | Nhược | Đảo ngược |
|---|---|---|---|
| A. `RecordAndPublish` mọi nơi (hiện tại) | Một cơ chế duy nhất | Ba vấn đề ở 4.1 | Dễ |
| B. **Outbox tối thiểu** cho thao tác đơn giản (`libs/events`: INSERT outbox trong cùng tx; relay `FOR UPDATE SKIP LOCKED` → NATS với `Nats-Msg-Id = eventId`) | Ghi cục bộ, đồng bộ, không phụ thuộc Temporal | Hai cơ chế; ~100–150 dòng relay *(ước lượng)* | Dễ |
| C. **Bỏ NATS**: activity chiếu thẳng sang consumer (`transparency.ApplyEvent`, `notification.Send` trên task queue của họ) | Bớt một thành phần vận hành và RAM | Producer biết danh sách consumer; §6 có ~15 cặp event→consumer (không chỉ Transparency/Notification: Campaign, Operations, Funds cũng tiêu thụ projection) → thêm consumer = sửa + version workflow của producer | Trung bình |
| D. Bỏ NATS, consumer **kéo** (poll) feed thay đổi của producer (bảng change-log = outbox không có bus) | Không bus, không ghép producer→consumer | Mỗi consumer poll mỗi producer; vẫn phải có bảng outbox | Trung bình |

**Khuyến nghị (giữ đảo ngược được):**

1. Bất kể chọn gì: một interface `Publisher` trong `libs/events` + envelope event (`eventId`, `occurredAt`, `correlationId`, `schemaVersion`) định nghĩa trong `proto/` (C-6). Transport (NATS / activity gọi thẳng) là chi tiết thay được.
2. Luồng tiền: activity publish sau activity ghi (như ADR-003 luật 4).
3. Thao tác đơn giản: **để số đo quyết** giữa A và B (tiêu chí bên dưới). Dự đoán của tôi nghiêng về B vì vấn đề ghép độ sẵn sàng, nhưng đây là dự đoán, không phải bằng chứng.
4. Bỏ NATS (C/D): **không quyết trong spike này** — chỉ đo những gì cần để quyết. Nếu chọn B thì đã có bảng outbox → D trở thành khả thi rẻ; C không nên dùng như cơ chế chung vì ghép producer với nhiều consumer.

### 4.3 Spike cần đo gì (≈ nửa ngày)

| Đo | Cách | Ngưỡng gợi ý để chuyển sang outbox |
|---|---|---|
| Độ trễ p50/p95: tx thường vs `RecordAndPublish` (chờ kết quả) vs `RecordAndPublish` (202) | 200 thao tác tuần tự trên kind | p95 chờ kết quả > ~200 ms *(ngưỡng do chủ dự án chốt)* |
| Số event lịch sử / workflow task mỗi thao tác; dung lượng tăng của DB `temporal` | `temporal workflow show`; `pg_total_relation_size` trước/sau | Tham khảo cho dung lượng VPS demo |
| Hành vi khi Temporal ngừng | Scale frontend về 0, thử lệnh ghi | Nếu chủ dự án không chấp nhận lệnh ghi đơn giản trả 503 → B |
| Boilerplate | Số dòng/file cần thêm cho một đường ghi mới theo A và theo B | So sánh trực tiếp |
| Consumer idempotent | Publish trùng cùng `eventId` → consumer xử lý một lần | Bắt buộc đạt cho mọi phương án |
| RAM của NATS | Lấy từ S-4 (nếu đã có) | Lợi ích nếu bỏ NATS |

---

## 5. Activity xuyên service (Operations `MarkDisbursed`, Campaign `AdvancePhase`)

Bẫy và cách xử lý:

| Bẫy | Hậu quả | Xử lý |
|---|---|---|
| Worker đích không chạy | Activity nằm trong hàng đợi; không có ScheduleToStart/ScheduleToClose thì **chờ vô hạn** — đúng mong muốn (§8: "tự tiếp tục khi service lên lại") nhưng im lặng | **Không** đặt `ScheduleToStartTimeout` cho activity sau pivot: nó **non-retryable by design** ([Detecting activity failures](https://docs.temporal.io/encyclopedia/detecting-activity-failures)) → hết hạn là workflow nhận lỗi sau khi tiền đã chuyển. Thay bằng metric `temporal_activity_schedule_to_start_latency` + cảnh báo (tài liệu khuyên vậy) |
| `StartToCloseTimeout` thiếu | Worker đích chết giữa chừng thì không bao giờ retry ("The Temporal Server doesn't detect failures when a Worker loses communication") | Luôn đặt |
| Gọi theo **tên chuỗi** + task queue | Không có kiểm tra kiểu lúc biên dịch | Tham số/kết quả là message trong `proto/` (C-6); hằng số tên activity sinh từ một chỗ |
| Lệch phiên bản: Funds gọi activity mà Operations chưa deploy | Activity task lỗi "không tìm thấy activity type" và retry *(chưa kiểm chứng chính xác kiểu lỗi và có retry hay không)* | Deploy phía cung cấp activity trước; không đổi chữ ký tại chỗ — chỉ thêm field tuỳ chọn hoặc tạo `MarkDisbursedV2` |
| Activity phía đích không idempotent | Retry làm hỏng trạng thái | `MarkDisbursed` khi đã `DISBURSED` → trả OK; `AdvancePhase` theo trạng thái đích, không theo "bước +1" |
| Bảo mật | Mọi worker trong namespace gọi được mọi activity | Ngoài phạm vi spike (mTLS/namespace để sau) |

**Spike cần:** một worker "operations-stub" và "campaign-stub" (có thể là một process riêng với hai worker trên task queue `operations`, `campaign`) đăng ký `MarkReadyToDisburse`, `RejectRequest`, `MarkDisbursed`, `MarkDisbursementFailed`, `AdvancePhase`, ghi vào một bảng nhỏ để kiểm idempotent. **Một** ca: dừng stub → workflow đứng ở `MarkDisbursed` → bật lại → chạy tiếp, không trùng. **Stub được:** proto/buf (dùng struct Go), logic nghiệp vụ thật của Operations/Campaign, xác thực giữa các service.

---

## 6. Throwaway hay skeleton

**Đồng ý throwaway-but-harvest**, thêm lý do riêng của Temporal:

- Lịch sử workflow **đóng băng code workflow**. Nếu code spike chạy thành skeleton và có lịch sử sống trong môi trường dài hạn, mọi thay đổi sau đó đều phải patch → nợ `GetVersion` ngay từ tuần đầu, cho những quyết định còn đang thử.
- Code spike chứa cờ tiêm lỗi, stub xuyên service, timeout rút ngắn — đúng thứ không được lọt vào production.
- Bố cục repo (`libs/`, `proto/`, buf, S-8) chưa chốt; ép skeleton bây giờ là chốt ngầm.

**Mang về (harvest):** schema SQL + mẫu `ON CONFLICT` + bảng khoá chống trùng; hàm workflow `Disbursement` (copy rồi viết lại sạch); danh sách ca test T1–T10 + bất biến; helper tiêm lỗi (dạng test-only); bảng ánh xạ lỗi Temporal → HTTP; giá trị retry/timeout; số đo Q7. **Không mang:** các file lịch sử replay (gắn với code spike — tạo lại từ code thật).

---

## 7. Không test trong spike này (YAGNI)

- Worker Versioning / Worker Deployment / Worker Controller; Upgrade on Continue-as-New (còn Public Preview).
- Continue-As-New (lịch sử `Disbursement` nhỏ), child workflow (`CampaignLifecycle`), Temporal Schedules (`DailyReconciliation`).
- UpdateWithStart, Nexus, nhiều namespace, mTLS, payload codec/mã hoá.
- Tải/thông lượng, HA/failover của Temporal server.
- Worker Python (AI), search attribute/visibility query, OTel interceptor (C-8).
- Đặc thù SePay/PayOS (S-1 đã xong).
- Chờ retention hết hạn thật — mô phỏng bằng `temporal workflow delete` rồi gửi lại webhook để chứng minh lớp UNIQUE của DB *(lệnh có trong CLI theo hiểu biết của tôi — chưa kiểm chứng trên trang CLI)*.
- JetStream DLQ/consumer nâng cao — chỉ cần một publish + một consumer idempotent.
- Versioning ngoài **một** minh hoạ `GetVersion` + replay đỏ/xanh.

---

## Phụ lục — Danh sách ca test đề xuất cho phần S-3 (gộp)

| Q | Ca | Môi trường |
|---|---|---|
| Q4 | Start trùng khi đang chạy → `AlreadyStarted` → 200 | dev server |
| Q4 | Start trùng sau khi đã hoàn thành (`AllowDuplicateFailedOnly`) → 200 | dev server |
| Q4 | Terminate `IncomingTransfer` rồi gửi lại → chạy lại, sổ cái vẫn 1 bút toán | dev server + PG |
| Q4 | Xoá execution (mô phỏng hết retention) rồi gửi lại → workflow mới, UNIQUE chặn ghi lần hai | dev server + PG |
| Q4 | Temporal ngừng → 503; `provider_event` đã lưu; gửi lại sau khi Temporal lên → workflow chạy | dev server |
| Q4b | Tiền đến đúng lúc VA hết hạn → signal được rút và ghi sổ (hoặc vào suspense theo luật) | testsuite |
| Q4b | Signal tới `DonationPayment` đã đóng → suspense + case | dev server |
| Q5 | F1, F2 (bắt buộc), F3 (tuỳ chọn) | testsuite + PG; dev server |
| Q5 | `Reserve` retry sau commit → không trả `InsufficientBudget` | testsuite + PG |
| Q6 | T1–T10 + bất biến; replay đỏ/xanh với `GetVersion` | testsuite; dev server |
| Q6/§5 | Dừng worker stub `operations` → workflow chờ → bật lại → tiếp tục | dev server |
| Q7 | 6 phép đo ở 4.3 | kind |

Ghi chú môi trường: phần lớn chạy được với `temporal server start-dev` + PostgreSQL của kind (port-forward) → nhanh, ít RAM; chỉ phép đo Q7 cần Temporal trên kind để số đo có ý nghĩa.
