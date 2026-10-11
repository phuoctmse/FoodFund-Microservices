# 03 — Kiểm thử đối kháng tính đúng của tiền (spike S-2 + S-3)

> Vai trò: adversarial money-correctness tester. Mục tiêu: phá thiết kế trên giấy, biến mỗi đòn tấn công thành một test pass/fail cho spike.
> Ngày: 2026-10-11. Nguồn đọc: `01-requirements.md` (§4.4–4.6, §5, §6, §8), `02-decomposition.md` (§4, §5, §7.1, §7.3, §8), ADR-001, ADR-003, `03-tech-stack.md` (T-5, T-6, §13), `docs/spikes/2026-10-11-s4-s7a-s9.md`.

---

## 0. Tóm tắt

- **57 kịch bản** trong 7 nhóm. **23 kịch bản P0** (bắt buộc trong spike), **14 kịch bản P1** (làm nếu harness đã có, mỗi cái ≤ 1–2 giờ), **20 kịch bản để tới lúc triển khai**.
- **3 rủi ro lớn nhất:**
  1. **Workflow ID tất định KHÔNG phải exactly-once.** Mặc định của Temporal là Reuse Policy = *Allow Duplicate*: sau khi `IncomingTransfer` đóng, webhook lặp đến muộn sẽ **khởi động workflow mới cùng ID** và ghi sổ lần hai. Sau retention, kể cả *Reject Duplicate* cũng không chặn được. → `UNIQUE` trong DB là tuyến phòng thủ **bắt buộc**, không phải "phòng hờ" (C2, C3).
  2. **Thứ tự duyệt hai người trong §7.3 sai.** `SecondApproval` đến **sau** `TransferRecorded`, tức tiền đã rời tài khoản trước khi admin thứ hai duyệt. BR-13 thành thủ tục hình thức (Gap G1, kịch bản E7).
  3. **Void sau khi tiền đã thật sự rời đi → chi hai lần.** Admin chọn `AdminResolved(notSent)` nhầm thì `reserved → budget` mở lại ngân sách, trong khi tiền đã nằm ở fundraiser. Hiện chỉ có **một** admin quyết định, không đối chiếu tiền ra (FR-PAY-04) (E10, G15).
- **15 gap/mâu thuẫn trong tài liệu** (mục 5). Nặng nhất: G1 (duyệt hai người sau khi chuyển tiền), G2 (ADR-001 "pending có hạn" ngược với §7.3 "không tự hoàn"), G3 (`platform_cash` không bao giờ giảm khi giải ngân, nên đối soát ngân hàng = 0 chênh lệch là bất khả thi), G4 (ADR-003 luật 3 hứa "Temporal tự chống trùng").
- **Throwaway hay skeleton:** throwaway-but-harvest. Thứ phải giữ: migration SQL (bảng, trigger, GRANT), **bộ truy vấn ledger audit**, danh sách kịch bản dưới dạng tên test, và các ca "test the test" (mục 6).

---

## 1. Giả định để viết bất biến

Các expert khác có thể chọn schema khác. Bất biến dưới đây viết theo schema tối thiểu sau; đổi tên cột thì đổi query, **không đổi bất biến**.

```sql
accounts(id, code UNIQUE, kind, normal_side CHAR(1) CHECK (normal_side IN ('D','C')))
journal_entries(id, idempotency_key TEXT UNIQUE NOT NULL, kind, ref_type, ref_id, created_at)
postings(id, entry_id FK, account_id FK, side CHAR(1) CHECK (side IN ('D','C')), amount BIGINT CHECK (amount > 0))
provider_events(provider, provider_txn_id, amount, payload_hash, received_at, UNIQUE(provider, provider_txn_id))
disbursements(request_id, approved_amount, status, ...)        -- bảng nghiệp vụ, được UPDATE
-- CHỈ DÙNG TRONG TEST: "ngân hàng giả", ghi lại tiền thật đã vào/ra
fake_bank(txn_id, direction IN ('in','out'), amount, linked_ref)
```

Ký hiệu: `signed(p) = +amount nếu side='D', −amount nếu side='C'`. `bal(a)` = số dư theo **phía thông thường** của tài khoản a (`Σ amount cùng phía normal_side − Σ amount phía ngược lại`). Quy ước phía: `platform_cash` là tài sản (D); các tài khoản còn lại là quỹ/nợ phải trả (C). Vì vậy `available(budget) = bal(budget:{phase}:{cat})`. Tiền đang giữ (pending) nằm ở `reserved:{request}`, đúng như bảng §4 của decomposition, nên **không** cần cột "pending balance" riêng.

**"Ngân hàng giả" (`fake_bank`)** là mảnh harness quan trọng nhất cho kiểm thử đối kháng. Nó ghi lại tiền **thật** đã đi đâu, độc lập với sổ cái. Thiếu nó thì không test được "void sau khi tiền đã đi" hay "đối soát = 0".

---

## 2. Danh mục kịch bản lỗi

Cột **Phạm vi**: **P0** = bắt buộc trong spike · **P1** = làm nếu còn thời gian (harness đã có) · **Defer** = để tới lúc triển khai.
Cột **Tầng test**: **SQL** = Go test + pgx với PG 18 (testcontainers) · **TS** = `testsuite` của Temporal Go SDK (time-skipping, activity chạy thật với PG) · **DEV** = `temporal server start-dev --db-filename …` + worker là tiến trình thật, kill được.

### Nhóm A — Toàn vẹn sổ cái ở mức DB (Q1, Q2)

**A1. Bút toán lệch do code Go cố tình ghi sai** — Q1 · SQL · **P0**
- *Tái hiện:* trong một tx, INSERT entry, rồi INSERT posting D 100.000 và C 99.999, rồi COMMIT. Chạy bằng code sinh từ sqlc (đúng đường đi của service), không dùng psql.
- *Bất biến:* với mọi `journal_entry e`, `Σ signed(p) = 0` trên `p ∈ postings(e)`.
- *Pass:* `COMMIT` trả lỗi, SQLSTATE đúng mã trigger raise (đề xuất `23514` hoặc mã riêng `FF001`); sau đó `SELECT count(*) FROM journal_entries WHERE id=$e` = 0. *Fail:* COMMIT thành công, hoặc lỗi ở INSERT (chứng tỏ trigger không hoãn).

**A2. Lệch từng bút toán nhưng cân bằng tổng transaction** — Q1 · SQL · **P0**
- *Tái hiện:* một tx tạo entry E1 (D 100 / C 60, lệch +40) và E2 (D 20 / C 60, lệch −40). Tổng tx bằng 0 nhưng từng entry lệch.
- *Bất biến:* như A1, **theo từng entry**, không theo tx.
- *Pass:* COMMIT bị từ chối. *Fail:* trigger chỉ kiểm tra tổng tx.

**A3. Entry không có posting / chỉ một posting / chỉ một phía** — Q1 · SQL · **P0**
- *Tái hiện:* (a) INSERT `journal_entries` không kèm posting nào rồi COMMIT. (b) Một posting D 0. CHECK `amount>0` đã chặn trường hợp này; test để xác nhận.
- *Lý do tấn công:* constraint trigger là `AFTER ROW` ([PG CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html): "Constraint triggers must be AFTER ROW triggers"). Nếu trigger gắn vào `postings` thì entry **không có dòng nào** sẽ không bao giờ kích hoạt trigger → lọt.
- *Bất biến:* mọi entry có ≥ 2 posting, có ít nhất 1 dòng D và 1 dòng C.
- *Pass:* (a) bị từ chối lúc COMMIT. Cần trigger thứ hai trên `journal_entries`, hoặc trigger kiểm tra theo entry_id gắn vào cả hai bảng.

**A4. Ghi thêm posting vào một entry đã commit từ trước** — Q1 (mới) · SQL · **P1**
- *Tái hiện:* tx1 tạo E cân bằng rồi commit. tx2 INSERT thêm hai posting D 50 / C 50 vào E (vẫn cân bằng). Đổi tài khoản trong tx2 là sửa lịch sử dù không cần UPDATE.
- *Bất biến:* posting của một entry chỉ được tạo trong **cùng transaction** với entry (ví dụ cột `created_xid xid8 DEFAULT pg_current_xact_id()` trên cả hai bảng, trigger so sánh).
- *Pass:* tx2 bị từ chối. *Nếu chọn không chặn:* ghi rõ vào ADR là chấp nhận rủi ro.

**A5. UPDATE / DELETE / TRUNCATE bằng user ứng dụng** — Q2 · SQL · **P0**
- *Tái hiện:* đăng nhập bằng `funds_app`, chạy `UPDATE postings SET amount=1`, `DELETE FROM journal_entries`, `TRUNCATE postings`, `DELETE FROM provider_events`.
- *Bất biến:* `has_table_privilege('funds_app', t, p) = false` với `p ∈ {UPDATE, DELETE, TRUNCATE}` và `t ∈ {postings, journal_entries, provider_events, audit_log}`.
- *Pass:* cả 4 lệnh lỗi `42501 insufficient_privilege`; số dòng không đổi. Ghi chú: trigger không bắt được TRUNCATE vì trigger TRUNCATE chỉ có dạng `FOR EACH STATEMENT` ([PG CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)), nên chỉ GRANT mới chặn được.

**A6. Vô hiệu hoá trigger cân bằng** — Q2 · SQL · **P0** (chỉ phần kiểm tra quyền và cấu hình)
- *Tấn công:*
  (a) user ứng dụng là **owner** của bảng → `ALTER TABLE postings DISABLE TRIGGER balance_check`. Theo [PG ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), chỉ trigger ràng buộc **do hệ thống sinh** mới cần superuser; trigger tự tạo bằng `CREATE CONSTRAINT TRIGGER` thì owner tắt được.
  (b) `SET session_replication_role = replica` → trigger "not altered from their default configuration" không chạy ([PG runtime-config-client](https://www.postgresql.org/docs/current/runtime-config-client.html)). Cần superuser hoặc quyền SET trên tham số.
  (c) `SET CONSTRAINTS balance_check IMMEDIATE` chỉ đổi thời điểm kiểm tra, không bỏ qua được. Test để chứng minh điều đó.
- *Bất biến:* owner của bảng sổ cái ≠ `funds_app` (owner là user migration); `funds_app` không phải superuser, không có quyền SET `session_replication_role`; trigger được đặt `ENABLE ALWAYS` (`pg_trigger.tgenabled = 'A'`) để vẫn chạy cả ở chế độ replica.
- *Pass:* (a) và (b) chạy bằng `funds_app` đều bị từ chối; (c) vẫn bị từ chối lúc kiểm tra; query cấu hình trả đúng.

**A7. pgx/sqlc báo lỗi trigger hoãn lúc COMMIT** — Q2 · SQL · **P0**
- *Tái hiện:* A1 đi qua đúng tầng repository dự kiến (`pgx.BeginFunc` hoặc tx thủ công + `Queries.WithTx`).
- *Kiểm tra:* (1) lỗi trả về từ `tx.Commit(ctx)` là `*pgconn.PgError` có `Code`, `ConstraintName`/`Message` đọc được, để activity phân loại **non-retryable**. Ngược lại `40001`/`40P01` là retryable. (2) Không có trạng thái "nửa commit". (3) Kiểu sqlc sinh cho `SUM(amount)`: `sum(bigint)` trả `numeric` ([PG aggregate functions](https://www.postgresql.org/docs/current/functions-aggregate.html)), nên sqlc sẽ sinh `pgtype.Numeric` hoặc kiểu không mong muốn *(chưa kiểm chứng cụ thể với sqlc hiện hành)*. Cách xử lý đề xuất: `COALESCE(SUM(amount),0)::bigint`.
- *Pass:* có bảng phân loại lỗi (mã SQLSTATE → retryable hay không), có test cho từng mã; truy vấn số dư trả `int64`.

**A8. Số tiền âm, bằng 0, quá lớn, tràn số** — mới · SQL · **P1**
- *Tái hiện:* INSERT posting `amount = -1`, `0`, `9223372036854775807`. Hai posting gần `MaxInt64` cùng tài khoản rồi đọc số dư bằng `::bigint`.
- *Bất biến:* `0 < amount ≤ AMOUNT_CAP` (đề xuất cap 10^13 VND, là quy tắc an toàn chứ không phải nghiệp vụ); đọc số dư không bao giờ tràn im lặng.
- *Pass:* các INSERT sai bị CHECK chặn (`23514`). Ép kiểu tràn trả `22003 numeric_value_out_of_range` chứ không quay vòng.

**A9. Posting vào sai tài khoản** (reserved của request khác, budget của campaign khác) — mới · **Defer**. Đây là quy tắc nghiệp vụ trong Go; cần test đơn vị lúc triển khai.

**A10. Sửa trực tiếp bằng superuser/owner (break-glass)** — Q2 · **Defer**. DB không chặn được superuser. Phát hiện bằng hash chain hoặc pgaudit để sau; đối soát ngân hàng (I-12) bắt được lệch tiền, nhưng **không** bắt được việc sửa nhãn hay tham chiếu.

### Nhóm B — Đồng thời trên một ngân sách (Q3)

**B1. N `Reserve` đồng thời trên một budget** — Q3 · SQL (+TS) · **P0**
- *Tái hiện tất định:* budget = 1.000.000. 50 goroutine, mỗi cái Reserve 100.000 cho một request khác nhau. Tất cả chờ ở một `sync.WaitGroup`/barrier rồi cùng chạy. Có **hook test** chèn `pg_sleep(0.05)` giữa bước đọc số dư và bước INSERT để mở rộng cửa sổ race. Lặp 20 lần.
- Trộn thêm (để bắt **B3/B4**): 10 goroutine Void reservation cũ (`reserved → budget`) và 10 goroutine Post (`reserved → disbursed`) cùng lúc, khoá **nhiều tài khoản** để lộ deadlock do thứ tự khoá.
- *Bất biến:* `bal(budget) ≥ 0` tại mọi thời điểm commit; số Reserve thành công = `floor(1.000.000 / 100.000) + (tiền void trả lại)/100.000`; `Σ reserved + bal(budget) + Σ disbursed(từ budget này) = ngân sách ban đầu`.
- *Pass:* 20/20 lần không có số dư âm; lỗi `40001`/`40P01` (nếu có) được phân loại retryable và lần thử lại thành công; không request nào bị giữ tiền hai lần.
- *Test the test (bắt buộc):* biến thể "naive" (đọc số dư không khoá, READ COMMITTED) **phải FAIL**, tức thấy số dư âm ít nhất một lần trong 20 lần. Nếu naive không fail thì test không đủ nhạy, phải tăng sleep hoặc số goroutine.

**B2. Reserve đồng thời với điều chỉnh sổ cái / phân bổ lại ngân sách** — Q3 · **Defer** (FR-LED-03 không thuộc spike).

**B3. Deadlock do thứ tự khoá** — Q3 · SQL · **P1**. Gộp vào B1 phần trộn thao tác. *Pass:* hoặc không có `40P01` (khoá theo thứ tự `account_id` tăng dần), hoặc có và được retry thành công.

**B4. Lỗi serialization dưới SERIALIZABLE nổi lên tới activity** — Q3/Q5 · **P0** nếu chọn SSI; gộp vào B1. *Pass:* activity trả lỗi retryable, Temporal retry, kết quả cuối giống chạy tuần tự.

**B5. Biên chính xác** — Q3 · SQL · **P0** (gộp vào B1; 2 assert). Còn lại = X: Reserve X → OK, sau đó `bal=0`; Reserve X+1 → từ chối, ledger không đổi.

### Nhóm C — Tiền vào: webhook → IncomingTransfer → PostDonation (Q4)

**C1. Webhook lặp khi workflow đang chạy** — Q4 · DEV · **P0**
- *Tái hiện:* gửi cùng payload đã ký 10 lần song song tới handler. Activity `PostDonation` có hook dừng 2 giây để workflow còn đang chạy.
- *Bất biến:* đúng **một bộ posting** cho mỗi `(provider, providerTxnId)`.
- *Pass:* 10/10 response là 200 (handler coi `WorkflowExecutionAlreadyStarted` là thành công — đây là **C8**); `count(journal_entries WHERE idempotency_key = 'donation:sepay:{id}') = 1`; `count(provider_events) = 1`.
- *Fail phụ:* handler trả 5xx khi gặp AlreadyStarted → nhà cung cấp gửi lại mãi.

**C2. Webhook lặp SAU khi workflow đã đóng** — Q4 · DEV · **P0** — **rủi ro số 1**
- *Lý do:* Reuse Policy mặc định là *Allow Duplicate*: workflow mới được phép khởi động với cùng ID sau khi lần chạy trước đã đóng ([Temporal Workflow ID](https://docs.temporal.io/workflow-execution/workflowid-runid)). Nhà cung cấp hoàn toàn có thể gửi lại sau vài phút đến vài giờ.
- *Tái hiện:* gửi webhook, chờ workflow Completed, gửi lại payload y hệt.
- *Bất biến:* như C1.
- *Pass:* đúng một entry. Hai cách chặn đều chấp nhận được, ghi rõ đã dùng cách nào: (i) UNIQUE trong DB chặn và activity trả kết quả cũ, hoặc (ii) đặt `WorkflowIdReusePolicy=RejectDuplicate` (chỉ là lớp phụ).
- *Test the test:* tắt UNIQUE và để policy mặc định → test **phải FAIL** (2 entry). Đây là bằng chứng ADR-003 luật 3 cần sửa câu chữ (G4).

**C3. Lặp sau retention, khi Temporal đã quên workflow ID** — Q4 · DEV · **P0** (gộp với C2)
- *Lý do:* reuse policy chỉ kiểm tra execution đã đóng **còn trong retention** ([Temporal Workflow ID](https://docs.temporal.io/workflow-execution/workflowid-runid)). Retention của namespace `foodfund` chưa được ghi trong kết quả S-9, cần ghi lại.
- *Tái hiện:* `temporal workflow delete` execution cũ (giả lập hết retention), rồi gửi lại, dù policy là RejectDuplicate.
- *Pass:* vẫn đúng một entry, tức **chỉ DB** đứng ra bảo vệ.

**C4. Cùng số tiền, khác `providerTxnId` (BR-08)** — Q4 · DEV hoặc TS · **P0**
- *Tái hiện:* 2 webhook cùng số tiền, cùng nội dung chuyển khoản, cùng VA, cùng giây, `providerTxnId` khác nhau.
- *Bất biến:* mỗi `providerTxnId` khác nhau → một bộ posting riêng; `bal(campaign_received) += 2 × amount`.
- *Pass:* có 2 entry. *Fail:* bất kỳ logic dedup nào dựa trên (số tiền, nội dung, thời gian) — đúng lỗi của hệ thống cũ (`sepay-webhook.service.ts:133-137`).

**C5. Cùng `providerTxnId`, payload khác** (khác số tiền hoặc VA) — Q4 (mới) · DEV · **P0**
- *Lý do:* với workflow ID tất định, lần thứ hai bị coi là "trùng → bỏ qua" và **payload khác biệt bị nuốt im lặng**. Chữ ký có thể vẫn hợp lệ (lỗi phía nhà cung cấp, sửa giao dịch).
- *Bất biến:* `provider_events` lưu `payload_hash`; khi trùng khoá mà hash khác → mở ReconciliationCase hoặc cảnh báo, **không** ghi sổ lần hai và **không** im lặng.
- *Pass:* 1 entry (theo payload đầu) + 1 bản ghi cảnh báo hoặc case; response vẫn 200 để nhà cung cấp không gửi mãi.

**C6. Webhook đến sai thứ tự** (khoản bổ sung của PARTIAL đến trước khoản chính; tiền ra đến trước khi admin ghi nhận TransferRecorded) — Q4 · **Defer**. Phụ thuộc chi tiết S-1/FR-PAY-03, nhưng **I-5 và I-12 vẫn phải đúng** khi tới lúc làm.

**C7. Temporal ngừng khi webhook đến** — Q4 · DEV · **P0**
- *Tái hiện:* dừng dev server → POST webhook → mong đợi 5xx → bật lại server → POST lại cùng payload.
- *Bất biến:* (1) `provider_events` ghi idempotent (`ON CONFLICT DO NOTHING`, rồi vẫn khởi động workflow); (2) đúng một entry sau khi server lên lại; (3) **không có ProviderEvent mồ côi**, tức event đã lưu mà không có workflow hoặc entry quá X phút (I-13).
- *Pass:* lần 1 trả 5xx và **không** có entry; lần 2 trả 200 và có 1 entry. Thêm biến thể "nhà cung cấp **không** gửi lại": query I-13 phải phát hiện được event mồ côi. Ai khởi động lại workflow cho nó thì xem G13.

**C8. Ánh xạ `AlreadyStarted` → 200** — Q4 · **P0**, gộp vào C1.

**C9. Một khoản tiền thật được báo bởi CẢ PayOS lẫn SePay** — mới · **Defer**, gap G6. Hai provider → hai workflow ID khác nhau → ghi sổ hai lần.

**C10. Thanh toán khớp đúng lúc VA hết hạn** (`DonationPayment` đã đóng khi `IncomingTransfer` gửi `PaymentReceived`) — mới · **Defer**, vì `DonationPayment` không nằm trong spike. Khi làm: signal tới workflow đã đóng trả NotFound → `IncomingTransfer` phải chuyển tiền vào `suspense`, không được mất tiền và không được ghi đôi.

**C11. Admin duyệt tay (FR-PAY-11) rồi webhook đến sau** — mới · **Defer**, gap G10.

**C12. `Resolve` hàng chờ đối soát hai lần** — Q4 · **Defer**. Cùng mẫu với E3; bất biến `bal(suspense) ≥ 0` (I-5) vẫn nằm trong audit.

**C13. Webhook giả mạo / sai chữ ký** — **Defer**, đã thuộc S-1.

### Nhóm D — Activity chạy lại (Q5, Q7)

**D1. Worker chết sau khi DB commit, trước khi báo hoàn thành** — Q5 · DEV · **P0**
- *Tái hiện tất định:* fault point `after_commit_before_return` trong `PostDonation`, `Reserve`, `PostDisbursement` gọi `os.Exit(1)` ngay sau `tx.Commit`. Supervisor của test khởi động lại worker. StartToClose đặt ngắn (5 giây) để retry nhanh.
- *Lý do:* server không phát hiện được worker chết, chỉ dựa vào StartToClose timeout để ép retry ([Temporal — detecting activity failures](https://docs.temporal.io/encyclopedia/detecting-activity-failures)).
- *Bất biến:* idempotency key = `workflowID + ":" + tên bước` (**không** chứa attempt, **không** chứa RunID, xem D4); đúng một entry cho mỗi key.
- *Pass:* sau khi restart, workflow hoàn thành; mỗi key có 1 entry; lần chạy lại trả **cùng `entryId`** như lần đầu.
- *Test the test:* sinh idempotency key bằng `uuid.New()` trong activity → test **phải FAIL**.

**D2. Hai attempt chạy CÙNG LÚC** — Q5 · DEV · **P0**
- *Tái hiện:* fault point `sleep_before_commit` = StartToClose + 2 giây. Theo cơ chế trên, attempt 2 được lên lịch trong khi attempt 1 vẫn đang chạy (suy ra từ cùng nguồn: server không biết attempt 1 còn sống). Hai worker cùng lắng nghe task queue.
- *Bất biến:* như D1. Cách "SELECT xem có chưa, chưa có thì INSERT" **không đủ**; phải dựa vào UNIQUE + `ON CONFLICT`.
- *Pass:* đúng 1 entry; attempt nào thua phải đọc lại và trả kết quả của bên thắng, không ném lỗi vĩnh viễn.

**D3. Trùng khoá nhưng payload khác** — Q5 · TS · **P0**
- *Tái hiện:* gọi `PostDisbursement(key K, amount 100)` rồi `PostDisbursement(key K, amount 90)`. Đây là mô phỏng bug code hoặc workflow bị sửa giữa chừng.
- *Bất biến:* với cùng key, activity chỉ trả "thành công idempotent" khi nội dung entry đã có **trùng khớp** (tài khoản, số tiền); khác thì trả lỗi **non-retryable** và cảnh báo.
- *Pass:* lần 2 trả `ApplicationError{NonRetryable:true}`; ledger không đổi.

**D4. Idempotency key lấy theo RunID hoặc attempt** — Q5 · review + TS · **P0** (gộp D1). *Pass:* key không đổi qua retry, qua reset và qua continue-as-new. Xung đột với E17 (cùng `requestId` chạy lại sau FAILED) được xử lý bằng key có thêm "số lần giải ngân" do DB cấp, không phải RunID.

**D5. `eventId` sinh mới mỗi lần retry** — Q7 · TS · **P1**
- *Tái hiện:* activity `Publish` sinh `eventId = uuid.New()`; fault làm attempt 1 đã publish xong nhưng không báo được → attempt 2 publish lại với `eventId` mới.
- *Bất biến:* `eventId` tất định, ví dụ `hash(workflowID, bước)` hoặc sinh trong workflow qua `SideEffect`; consumer dedup theo `eventId`.
- *Pass:* subscriber test nhận 2 message cùng `eventId`, xử lý 1 lần.

**D6. Publish lỗi vĩnh viễn sau khi tiền đã ghi sổ** — Q7 · TS · **P1**. *Pass:* workflow **không** bù trừ hay đảo bút toán chỉ vì NATS lỗi; tiền đã ghi giữ nguyên; workflow ở trạng thái retry hoặc cảnh báo. Đây là NFR-07.

### Nhóm E — Saga giải ngân và tín hiệu (Q6)

Ghi chú chung: tất cả kịch bản E chạy được trong **TS** (time-skipping, `RegisterDelayedCallback` để gửi signal vào thời điểm mong muốn; [Temporal Go testing](https://docs.temporal.io/develop/go/testing-suite)), với activity Funds chạy thật trên PG và activity Operations/Campaign là stub ghi log lời gọi.

**E1. Happy path dưới và trên ngưỡng BR-13** — Q6 · TS · **P0**
- *Bất biến sau khi xong:* `bal(reserved:{req}) = 0`; `disbursed` tăng đúng `approved_amount`; `fake_bank.out` có 1 dòng gắn `req`; stub Operations nhận `MarkDisbursed` đúng 1 lần; I-11.
- *Pass:* 2 ca (dưới và trên ngưỡng) đều đạt; ca trên ngưỡng không post được khi thiếu SecondApproval.

**E2. `ReceiptConfirmed` đến TRƯỚC `TransferRecorded`** — Q6 · TS · **P0**
- *Lý do:* SDK **buffer** signal khi chưa có channel hay handler ([Temporal Go message passing](https://docs.temporal.io/develop/go/message-passing)). Một xác nhận gửi sớm sẽ nằm chờ, rồi được tiêu thụ ngay khi workflow tới bước đó → ghi sổ dựa trên xác nhận cho một khoản **chưa được chuyển**.
- *Bất biến:* workflow chỉ chấp nhận `ReceiptConfirmed` có `occurredAt`/sequence **sau** `TransferRecorded` của cùng `transferRef`; signal sớm bị bỏ (ghi log, gắn cờ). Tốt hơn nữa: dùng **Update có validator**, vì validator từ chối thì sự kiện không vào history và người gọi nhận lỗi ngay (cùng nguồn).
- *Pass:* gửi ReceiptConfirmed tại t=0 rồi TransferRecorded tại t=1h → workflow **vẫn chờ** xác nhận mới; không có `PostDisbursement`.

**E3. Signal lặp hoặc mâu thuẫn** (`TransferRecorded` hai lần, lần hai khác số tiền hay bằng chứng; `ReceiptConfirmed` hai lần) — Q6 · TS · **P0**
- *Bất biến:* mỗi bước chuyển trạng thái xảy ra đúng một lần; signal thứ hai **không** làm đổi số tiền đã ghi nhận; số tiền trong `TransferRecorded` phải = `approved_amount` (xem E19, G11).
- *Pass:* 1 entry post; signal thứ hai bị bỏ, có log hoặc cờ.

**E4. `ReceiptConfirmed` đến SAU khi hết hạn** (đã mở case đối soát, đang chờ `AdminResolved`) — Q6 · TS · **P0**
- *Tái hiện:* timer 7 ngày bắn → case mở → t=7d+1h gửi ReceiptConfirmed.
- *Bất biến:* đúng một kết cục (post **hoặc** void, không bao giờ cả hai); hành vi đã ghi rõ thành văn. Tài liệu chưa định nghĩa ca này (G9). Đề xuất: chấp nhận như bằng chứng, nhưng vẫn cần `AdminResolved` để đóng case.
- *Pass:* có test khẳng định hành vi đã chọn; I-11 không có request vừa post vừa void.

**E5. Signal tới workflow đã đóng** — Q6 · DEV · **P1**. *Pass:* API Funds trả lỗi (409/410) cho người dùng, **không** trả 200 "đã xác nhận"; không có thay đổi sổ cái.

**E6. Signal đến đúng biên hạn chót** — Q6 · TS · **P1**
- *Tái hiện:* signal tại `deadline − 1s` và `deadline + 1s` (RegisterDelayedCallback). Nếu được thì thêm ca "cùng workflow task": timer và signal trong một lần kích hoạt.
- *Bất biến:* đúng một nhánh thắng, quyết định tất định khi replay; quy tắc biên (≤ hay <) được ghi thành văn (G9).
- *Pass:* chạy 2 ca cho kết quả như đặc tả; replay lại history của cả hai ca không có lỗi nondeterminism.

**E7. Cùng một admin làm cả hai lần duyệt (BR-13)** — Q6 · TS · **P0**
- *Tái hiện:* `SecondApproval{adminId = A}` khi người tạo hoặc ghi nhận = A. Thêm ca A và A' là hai tài khoản của cùng một người: không phát hiện được, ghi nhận giới hạn.
- *Bất biến:* `approver2 ≠ approver1`, và cả hai đều có vai trò admin tại thời điểm duyệt.
- *Pass:* duyệt lần hai bị từ chối (Update validator trả lỗi, hoặc signal bị bỏ kèm log); workflow vẫn chờ một admin khác.
- *Lưu ý:* test này **chỉ có ý nghĩa** khi đã sửa thứ tự duyệt theo G1. Nếu giữ thứ tự §7.3 thì test pass mà tiền vẫn đã đi.

**E8. Signal do sai vai trò gửi hoặc giả mạo, đi vòng qua Funds (C-7)** — Q6 · DEV · **P1** (chỉ để ghi nhận)
- *Tái hiện:* `temporal workflow signal --name ReceiptConfirmed --input '{"actorId":"fundraiser-x"}'` từ máy dev; thử thêm nút gửi signal trên Web UI.
- *Thực tế:* server tự host mặc định chấp nhận tất cả. Workflow không có JWT để tự kiểm.
- *Pass (tiêu chí của spike):* ghi lại kết quả, và ghi các biện pháp vào ADR: NetworkPolicy chỉ cho namespace `funds` tới frontend Temporal; Web UI đặt `disableWriteActions`/`TEMPORAL_DISABLE_WRITE_ACTIONS` ([Temporal Web UI config](https://docs.temporal.io/references/web-ui-configuration)); authorizer/claim mapper để sau. Chưa kiểm chứng `disableWriteActions` có chặn riêng thao tác gửi signal không *(unverified)*.

**E9. Các biến thể `AdminResolved`** (sent → post; notSent → void; gửi hai lần; gửi khi không có case mở) và `ReceiptDisputed` (E11 gộp vào đây) — Q6 · TS · **P0**
- *Bất biến:* với mỗi request, `count(post) + count(void) = 1` sau khi kết thúc; `AdminResolved` thứ hai bị bỏ; `AdminResolved` khi chưa có case thì bị từ chối.
- *Pass:* 4 ca đều đạt I-11.

**E10. Void sau khi tiền đã thật sự rời tài khoản** (quy tắc §7.3) — Q6 · TS · **P0** — **rủi ro số 3**
- *Tái hiện:* E1 tới `TransferRecorded`, ghi `fake_bank.out(linked_ref=req)` (giả lập SePay báo tiền ra, FR-PAY-04) → hết hạn → `AdminResolved{notSent}`.
- *Bất biến:* **không được void** reservation nếu đã có tiền ra (`fake_bank.out`, hoặc provider_event tiền ra) gắn với request; I-12 (đối soát) = 0.
- *Pass:* void bị từ chối, case vẫn mở hoặc chuyển "cần điều tra"; `bal(budget)` không tăng.
- *Test the test:* bỏ kiểm tra liên kết tiền ra → I-12 **phải** báo lệch đúng `approved_amount`, chứng tỏ có chi đôi tiềm tàng.

**E11.** Gộp vào E9.

**E12. Ngưỡng BR-13 bị đổi giữa saga** (FR-CFG-01) — mới · **Defer**. Khi làm: ngưỡng là **input của workflow**, chốt lúc start, không đọc lại (vừa để tất định, vừa để đúng nghiệp vụ).

**E13. Signal chưa xử lý bị mất khi workflow kết thúc** (chưa drain channel) — Q6 · **Defer**. Theo thiết kế, signal thừa đằng nào cũng bị bỏ; cần drain trước khi complete ([Temporal Go message passing](https://docs.temporal.io/develop/go/message-passing): "Otherwise, the Signals will be lost").

**E14. Worker chết giữa saga** (đang chờ signal; đang chạy activity) — Q6 · DEV · **P1**. *Pass:* kill worker → gửi signal → bật worker → workflow tiếp tục; I-1…I-13 đạt; không có activity nào chạy thừa ngoài các lần retry hợp lệ.

**E15. Temporal server khởi động lại giữa saga** (timer 7 ngày rút xuống 30 giây) — Q6 · DEV · **P1**. *Bắt buộc* chạy dev server với `--db-filename`, vì mặc định "Workflow Executions are lost when the server process dies" ([Temporal CLI server](https://docs.temporal.io/cli/server)). *Pass:* timer vẫn bắn sau khi server lên lại; case được mở.

**E16. Replay non-determinism sau khi sửa code** — Q6 · TS + replayer · **P0**
- *Tái hiện:* ghi history JSON của E1 và E4 → sửa workflow (chèn một activity trước `Reserve`, hoặc đổi thứ tự hai lệnh await) → chạy `worker.NewWorkflowReplayer` ([Temporal Go testing](https://docs.temporal.io/develop/go/testing-suite)).
- *Pass:* (1) bản sửa thô **phải fail** replay; (2) bản sửa dùng `workflow.GetVersion` **phải pass**; (3) chạy được trong `go test` (đường cho CI, C-6). *Fail:* replay pass với bản sửa thô, nghĩa là test không đủ nhạy.

**E17. Chạy lại Disbursement cho cùng `requestId` sau khi FAILED** — mới · SQL + TS · **P1**
- *Lý do:* `disbursement-{requestId}` cộng với Allow Duplicate cho phép lần chạy thứ hai. Idempotency key `workflowID:Reserve` sẽ (a) trùng với key của lần đầu → Reserve lần hai bị bỏ qua nhầm, hoặc (b) nếu key đổi thì hai reservation có thể cùng sống.
- *Bất biến:* tại mọi thời điểm có **tối đa một** reservation chưa post hay void cho mỗi `request_id` (partial unique index).
- *Pass:* lần chạy hai Reserve thành công đúng một lần sau khi lần một đã void; Reserve song song khi lần một chưa void thì bị từ chối. Quy tắc nghiệp vụ còn thiếu (G5).

**E18. `PostDisbursement` xong nhưng `MarkDisbursed` (Operations) lỗi vĩnh viễn** — **Defer**. Khi làm: sổ cái là nguồn sự thật, không đảo bút toán; workflow retry hoặc cảnh báo; Operations idempotent.

**E19. Số post khác số reserve; số tiền TransferRecorded khác số đã duyệt** — Q6 · TS · **P1**
- *Lý do:* mô hình TigerBeetle **cho phép** post số nhỏ hơn pending ([TigerBeetle transfer](https://docs.tigerbeetle.com/reference/transfer/)). BR-07 lại đòi "bằng chi phí đã duyệt".
- *Bất biến:* `post.amount = reserve.amount = approved_amount`; TransferRecorded có số khác thì không post, mở case.
- *Pass:* như trên.

**E20. Campaign bị huỷ khi còn reservation đang chờ** — **Defer**. `SurplusCase` phải loại `reserved:*` ra khỏi số dư có thể hoàn hay chuyển cho tới khi reservation được giải quyết.

### Nhóm F — Thời gian

**F1. Deadline, múi giờ, tính tất định** — Q6 · TS + lint · **P1**
- *Tấn công:* (a) code workflow dùng `time.Now()` hoặc `time.Local`; (b) deadline tính theo giờ máy worker (UTC trong container) trong khi người dùng hiểu theo `Asia/Ho_Chi_Minh` (UTC+7, không có DST); (c) "7 ngày" tính từ đâu (MarkReadyToDisburse hay TransferRecorded?), tài liệu không nói (G9).
- *Bất biến:* deadline tuyệt đối được tính **một lần** (từ `workflow.Now`) và lưu `timestamptz` trong DB; workflow không gọi `time.Now`.
- *Pass:* chạy công cụ phân tích tĩnh `workflowcheck` của Temporal *(unverified: tên và đường dẫn công cụ trong SDK hiện hành)* hoặc grep CI, không thấy vi phạm; E6 đạt.

**F2. Giờ DB (`now()`) và giờ workflow lệch nhau, posting nằm sát biên ngày của sao kê hoặc báo cáo** — **Defer**.

### Nhóm G — Phân bổ ngân sách

**G-1. Làm tròn khi phân bổ (BR-06)** — mới · **Defer** (AllocateBudget ngoài spike), nhưng ghi thành gap G7. Bất biến cho lúc triển khai: `Σ budget:{phase}:{cat} + surplus = campaign_received` sau AllocateBudget, **chính xác tới từng đồng**; phần dư do làm tròn có quy tắc rõ ràng.

---

## 3. Bộ bất biến toàn cục ("ledger audit")

Harness chạy **sau mỗi kịch bản** (và sau mỗi vòng lặp của B1). Mỗi query phải trả **0 dòng** (hoặc `true`). Đề xuất lưu thành `ledger_audit.sql` cùng một helper Go `AssertLedgerInvariants(t, db)`: đây là tài sản đáng giữ nhất của spike.

```sql
-- I-1  Mỗi entry cân bằng
SELECT entry_id FROM postings
GROUP BY entry_id
HAVING SUM(CASE side WHEN 'D' THEN amount ELSE -amount END) <> 0;

-- I-2  Mỗi entry có ≥2 posting, đủ hai phía (bắt A3)
SELECT e.id FROM journal_entries e
LEFT JOIN postings p ON p.entry_id = e.id
GROUP BY e.id
HAVING COUNT(p.id) < 2
    OR COUNT(*) FILTER (WHERE p.side = 'D') = 0
    OR COUNT(*) FILTER (WHERE p.side = 'C') = 0;

-- I-3  Tổng toàn sổ = 0 (hệ quả của I-1; rẻ, dùng làm tín hiệu nhanh)
SELECT SUM(CASE side WHEN 'D' THEN amount ELSE -amount END) AS net FROM postings
HAVING SUM(CASE side WHEN 'D' THEN amount ELSE -amount END) <> 0;

-- I-4  Không có số tiền không dương (thừa nếu đã có CHECK, nhưng phát hiện CHECK bị gỡ)
SELECT id FROM postings WHERE amount <= 0;

-- I-5  Không tài khoản nào âm theo phía thông thường
--      (budget, reserved, suspense, campaign_received, surplus, refund_payable, disbursed, platform_cash)
WITH bal AS (
  SELECT a.id, a.code, a.kind,
         COALESCE(SUM(CASE WHEN p.side = a.normal_side THEN p.amount ELSE -p.amount END), 0)::bigint AS bal
  FROM accounts a LEFT JOIN postings p ON p.account_id = a.id
  GROUP BY a.id)
SELECT * FROM bal WHERE bal < 0;

-- I-6  reserved:{request} chỉ ở trạng thái 0 hoặc đúng số đã duyệt
SELECT d.request_id, b.bal, d.approved_amount
FROM disbursements d JOIN account_balances b ON b.code = 'reserved:' || d.request_id
WHERE b.bal NOT IN (0, d.approved_amount);

-- I-7  Đúng một bộ posting cho mỗi giao dịch nhà cung cấp
SELECT idempotency_key FROM journal_entries
WHERE kind IN ('donation', 'suspense_in')
GROUP BY idempotency_key HAVING COUNT(*) > 1;           -- thừa nếu UNIQUE còn; phát hiện UNIQUE bị gỡ

-- I-8  Số tiền ghi sổ = số tiền nhà cung cấp báo
SELECT pe.provider, pe.provider_txn_id
FROM provider_events pe
JOIN journal_entries e ON e.idempotency_key = 'donation:' || pe.provider || ':' || pe.provider_txn_id
                       OR e.idempotency_key = 'suspense_in:' || pe.provider || ':' || pe.provider_txn_id
JOIN postings p ON p.entry_id = e.id AND p.side = 'D'
JOIN accounts a ON a.id = p.account_id AND a.code = 'platform_cash'
WHERE p.amount <> pe.amount;

-- I-9  Quyền và cấu hình chống bypass (A5, A6) → mọi cột phải false / đúng
SELECT t,
       has_table_privilege('funds_app', t, 'UPDATE')   AS can_update,
       has_table_privilege('funds_app', t, 'DELETE')   AS can_delete,
       has_table_privilege('funds_app', t, 'TRUNCATE') AS can_truncate,
       (SELECT tableowner FROM pg_tables WHERE tablename = t) = 'funds_app' AS app_is_owner
FROM unnest(ARRAY['postings', 'journal_entries', 'provider_events', 'audit_log']) t;
SELECT rolsuper FROM pg_roles WHERE rolname = 'funds_app';                      -- false
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE 'ledger_%' AND tgenabled <> 'A';  -- 0 dòng

-- I-10 Mỗi request: không bao giờ vừa post vừa void; mỗi loại tối đa 1
SELECT ref_id FROM journal_entries
WHERE kind IN ('disb_post', 'disb_void')
GROUP BY ref_id
HAVING COUNT(DISTINCT kind) > 1 OR COUNT(*) > 1;

-- I-11 Trạng thái nghiệp vụ khớp sổ cái
SELECT d.request_id FROM disbursements d
WHERE (d.status = 'DISBURSED' AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.kind = 'disb_post' AND e.ref_id = d.request_id))
   OR (d.status = 'FAILED'    AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.kind = 'disb_void' AND e.ref_id = d.request_id))
   OR (d.status NOT IN ('DISBURSED') AND EXISTS (SELECT 1 FROM journal_entries e WHERE e.kind = 'disb_post' AND e.ref_id = d.request_id));

-- I-12 Đối soát với "ngân hàng giả" = 0 chênh lệch (NFR-01).
--      Công thức phụ thuộc cách xử lý G3; với quy ước "giải ngân ghi Có platform_cash":
SELECT (SELECT bal FROM account_balances WHERE code = 'platform_cash')
     - (SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END), 0) FROM fake_bank) AS diff
HAVING (SELECT bal FROM account_balances WHERE code = 'platform_cash')
    <> (SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END), 0) FROM fake_bank);
--      Kèm: void mà đã có tiền ra (E10)
SELECT e.ref_id FROM journal_entries e
JOIN fake_bank b ON b.direction = 'out' AND b.linked_ref = e.ref_id
WHERE e.kind = 'disb_void';

-- I-13 Không có ProviderEvent mồ côi (đã lưu nhưng chưa thành bút toán hay case) quá X phút (C7)
SELECT pe.* FROM provider_events pe
WHERE pe.received_at < now() - interval '5 minutes'
  AND NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.idempotency_key LIKE '%:' || pe.provider || ':' || pe.provider_txn_id);
```

(`account_balances` là view tính từ I-5.)

**Phía Temporal** (chạy cùng audit):
- `temporal workflow list --query 'ExecutionStatus="Failed" OR ExecutionStatus="Terminated"'` = rỗng, trừ các ca cố ý.
- Không có `WorkflowTaskFailed` với cause nondeterminism trong history của các workflow test.
- Replay toàn bộ history đã ghi trong run đó bằng replayer → pass.

---

## 4. Phạm vi: spike làm gì, bỏ gì

**P0 (23 kịch bản, ước tính 3,5–4 ngày công gồm cả harness):**
A1, A2, A3, A5, A6, A7 · B1 (gồm B4, B5) · C1 (gồm C8), C2 (gồm C3), C4, C5, C7 · D1, D2, D3, D4 · E1, E2, E3, E4, E7, E9 (gồm E11), E10, E16.
Nếu đếm riêng các mục đã gộp (B4, B5, C3, C8, E11) thì là 28 mã kịch bản.

**P1 (14 kịch bản, +1–1,5 ngày, làm khi harness đã chạy):** A4, A8, B3, D5, D6, E5, E6, E8, E14, E15, E17, E19, F1, cùng phép đo "Q7 có nặng không" (D5/D6 là phần đối kháng của Q7).

**Defer (20):** A9, A10, B2, C6, C9, C10, C11, C12, C13, E12, E13, E18, E20, F2, G-1, và các ca payment-specific (PARTIAL/OVERPAID).

**Nguyên tắc cắt:**
- Không dựng kind cho spike: PG 18 qua testcontainers cùng `temporal server start-dev --db-filename` là đủ. S-9 đã chứng minh phần chạy trên cluster.
- Operations và Campaign là **stub** ghi lời gọi vào bảng; không làm proto/buf.
- Không làm Keycloak/JWT. Actor (adminId, role) đi trong payload; C-7 chỉ **ghi nhận** (E8).
- Không làm NATS thật trừ khi cần đo Q7. D5 dùng subscriber trong bộ nhớ là đủ để chứng minh vấn đề `eventId`.
- **Mỗi test P0 phải có "test the test"**: một biến thể cố tình sai (feature flag `NAIVE_*`) và test **phải FAIL** với biến thể đó. Đây là cách duy nhất chứng minh spike thật sự trả lời Q1/Q3/Q4/Q5, thay vì "chạy xanh vì không gặp race".

**Cơ chế fault injection đề xuất (rẻ, tất định):** biến `faultpoints` toàn cục trong package activity, chỉ bật bằng build tag `spike`/`test`:
- `after_commit_exit` → `os.Exit(1)`
- `before_commit_sleep=Ns`
- `between_read_and_write_sleep=Ns` (cho B1)

Supervisor của test khởi động worker như tiến trình con (`exec.Command`) để kill hoặc restart được.

---

## 5. Gap và mâu thuẫn trong tài liệu (liên quan tính đúng của tiền)

**G1 — Duyệt hai người diễn ra SAU khi tiền đã chuyển.** `02-decomposition.md` §7.3:
> `A->>F: Ghi nhận đã chuyển tiền + bằng chứng` → `F->>T: Signal TransferRecorded` → `opt Vượt ngưỡng BR-13` → `A2->>F: Duyệt lần hai (khác người)`

BR-13: "giải ngân … vượt ngưỡng cấu hình cần một admin tạo và **một admin khác** duyệt". Kiểm soát hai người phải chặn **trước** khi tiền rời tài khoản. Hiện tại, khi A2 nhận được yêu cầu duyệt thì tiền đã đi rồi; A2 từ chối cũng không thu hồi được.
→ Đổi thứ tự: `Reserve → (trên ngưỡng: SecondApproval) → MarkReadyToDisburse → TransferRecorded → ReceiptConfirmed → Post`. Ghi thêm: A2 từ chối thì void reservation (an toàn vì tiền chưa đi). Cũng chưa rõ "admin tạo" là người duyệt yêu cầu ở Operations hay người ghi nhận chuyển tiền; người ghi nhận chuyển tiền có được trùng với A2 không?

**G2 — "Pending có hạn" mâu thuẫn với "không tự hoàn".**
- ADR-001: "sổ cái theo ngữ nghĩa chuyển khoản bất biến và chuyển khoản pending/post/void **có hạn** (giữ tiền giải ngân, VA hết hạn)"
- T-6: "pending/post/void có hạn"
- §7.3: "Hết hạn chờ xác nhận … **không tự hoàn lại phần đã giữ**"

Trong TigerBeetle, pending hết hạn thì số dư pending được **tự động gỡ** và "Expired transfers cannot be manually posted or voided" ([TigerBeetle transfer](https://docs.tigerbeetle.com/reference/transfer/)). Mượn nguyên ngữ nghĩa đó cho reservation giải ngân là vi phạm trực tiếp §7.3: tiền có thể đã đi, nhưng ngân sách lại được mở ra.
→ Ghi rõ: reservation giải ngân **không có expiry ở tầng sổ cái**; hạn chót là timer của workflow, và hết hạn chỉ mở case. Nếu có expiry thì chỉ dành cho VA hoặc intent, nơi chưa có tiền thật.

**G3 — `platform_cash` không bao giờ giảm khi giải ngân, nên I-12/NFR-01 bất khả thi.** §7.3 ghi `PostDisbursement (reserved → disbursed)`; bảng §4 định nghĩa `platform_cash` = "Tiền thật trong tài khoản ngân hàng nhận" và `disbursed:{campaign}` = "Tiền đã chuyển cho fundraiser". Theo chuỗi `platform_cash D / campaign_received C → … → reserved D / disbursed C`, sau khi giải ngân `platform_cash` vẫn giữ nguyên dù ngân hàng đã giảm. Như vậy NFR-01 "báo cáo đối soát = 0 chênh lệch" không thể đạt nếu so `platform_cash` với số dư ngân hàng.
→ Spike phải công bố **bảng tài khoản kèm phía thông thường và quy tắc ghi** cho mọi bước. Hai lựa chọn: (a) `PostDisbursement` ghi D `reserved` / C `platform_cash`, còn `disbursed` thành truy vấn thống kê; hoặc (b) `disbursed` là contra-asset của `platform_cash`, và đối soát so `platform_cash − disbursed − refunded`. Refund và chuyển dư có cùng vấn đề.

**G4 — ADR-003 hứa quá mức về chống trùng.** ADR-003 luật 3: "workflow ID tất định … để **Temporal tự chống trùng**"; §7.1: "trùng ID = bỏ qua". Điều này chỉ đúng khi workflow **còn đang chạy**. Mặc định Allow Duplicate cho phép chạy lại sau khi đóng; quá retention thì mọi policy đều mất tác dụng ([Temporal Workflow ID](https://docs.temporal.io/workflow-execution/workflowid-runid)).
→ Sửa câu chữ: "workflow ID tất định **giảm** chạy song song; **UNIQUE ở DB là bảo đảm exactly-once**". Ghi retention của namespace `foodfund` (S-9 chưa ghi) và đặt `RejectDuplicate` cho `IncomingTransfer` như lớp phụ.

**G5 — `disbursement-{requestId}` và giải ngân lại sau FAILED.** FR-DSB-07 có FAILED; BR-03 chỉ có `PENDING → APPROVED/REJECTED; APPROVED → DISBURSED`, không có FAILED và không nói FAILED có được thử lại không. Nếu được thì cùng workflow ID chạy lần hai: idempotency key theo `workflowID+bước` sẽ trùng (E17).
→ Bổ sung trạng thái và quy tắc: FAILED là kết thúc, phải tạo request mới; **hoặc** có `attemptNo` do DB cấp nằm trong workflow ID và trong key.

**G6 — Một khoản tiền, hai nhà cung cấp.** FR-PAY-02 (PayOS webhook → "cập nhật giao dịch thành công") và FR-PAY-03 (SePay báo tiền vào). Nếu tiền PayOS về đúng tài khoản ngân hàng mà SePay theo dõi thì một khoản tiền sinh **hai** webhook, với hai workflow ID `transfer-payos-…` và `transfer-sepay-…`. Việc PayOS và SePay có cùng theo dõi một tài khoản không thì chưa kiểm chứng *(unverified)*.
→ Chốt **một nguồn sự thật cho tiền vào sổ cái** (đề xuất: SePay, tức biến động thật của ngân hàng). PayOS chỉ cập nhật trạng thái intent, không ghi sổ.

**G7 — BR-06 có sai số và không có quy tắc làm tròn.** "tổng % … = 100% (**sai số 0,01**). Ngân sách mỗi hạng mục = min(tiền đã nhận, mục tiêu) × %." Tổng 99,99% thì 0,01% không thuộc tài khoản nào; tổng 100,01% thì **phân bổ nhiều hơn số đã nhận**, tức tạo ra tiền. Phép × % trên số nguyên VND cũng tạo phần dư làm tròn.
→ Quy tắc: phân bổ bằng số nguyên; phần dư làm tròn và phần thiếu % vào `surplus:{campaign}`; không bao giờ vượt; kèm bất biến ở mục G-1.

**G8 — Ngưỡng BR-13 không rõ biên và thời điểm.** "vượt ngưỡng" là `>` hay `≥`? Ngưỡng đọc lúc nào? FR-CFG-01 cho admin đổi ngưỡng bất kỳ lúc nào. Ngưỡng có áp lên **từng yêu cầu** hay **tổng theo phase**? Chia nhỏ yêu cầu để lách ngưỡng bị hạn chế một phần bởi "mỗi phase chỉ có 1 yêu cầu đang mở cho mỗi loại" (FR-DSB-01), nhưng vẫn làm tuần tự được.
→ Chốt `>`, chốt giá trị vào input workflow lúc start, ghi rõ không có kiểm soát luỹ kế.

**G9 — Hạn chót và tín hiệu muộn chưa được định nghĩa.** §5: "Hạn chờ xác nhận nhận tiền (ví dụ 7 ngày)", nhưng không nói tính từ `MarkReadyToDisburse` hay từ `TransferRecorded`, không nói biên đóng hay mở, và không nói `ReceiptConfirmed` đến sau hạn (khi case đã mở) thì xử lý thế nào. §7.3 chỉ nói "chờ `AdminResolved`".
→ Định nghĩa trong spike: mốc tính là `TransferRecorded`; `ReceiptConfirmed` muộn là bằng chứng gắn vào case, admin vẫn phải đóng.

**G10 — Duyệt tay (FR-PAY-11) không gắn với `providerTxnId`.** "Admin duyệt thủ công một khoản quyên góp (ví dụ khi webhook thất bại)". Nếu bút toán duyệt tay dùng khoá theo intent, rồi webhook thật đến muộn với khoá theo `providerTxnId`, thì ghi sổ hai lần.
→ Duyệt tay bắt buộc nhập mã giao dịch ngân hàng và dùng **cùng idempotency key** `donation:{provider}:{txnId}`.

**G11 — Số tiền chuyển thực tế khác số đã duyệt.** BR-07: "số giải ngân bằng chi phí đã duyệt"; FR-DSB-04 "kèm bằng chứng chuyển khoản". Tài liệu không có quy tắc khi bằng chứng hoặc SePay tiền ra cho số khác (gõ nhầm, phí chuyển khoản), trong khi mô hình TigerBeetle cho phép post số nhỏ hơn pending.
→ Quy tắc: post = reserve = approved, khác thì mở case; cấm post một phần.

**G12 — C-7 giả định "người dùng không gửi tín hiệu trực tiếp" nhưng không có cơ chế ép.** C-7: "tín hiệu gửi tới workflow chỉ được gửi từ service sở hữu sau khi đã kiểm tra quyền". Temporal tự host mặc định không có authz; CLI hoặc Web UI gửi được signal (E8).
→ Thêm vào ADR-003 hoặc ADR-004: NetworkPolicy cho frontend Temporal, UI `disableWriteActions`, payload signal có `actorId` và `role` do Funds ký hoặc ghi (để audit), authorizer để sau.

**G13 — ProviderEvent đã lưu nhưng workflow chưa khởi động: thực chất là một inbox không có ai quét.** §7.1: "Verify HMAC, **lưu ProviderEvent**" rồi mới "Start IncomingTransfer … (Temporal lỗi → 5xx để SePay gửi lại)". Kết hợp với C-2 "Không outbox". Nếu nhà cung cấp ngừng gửi lại thì tiền đã vào ngân hàng mà không có bút toán. Số lần và thời gian retry của SePay chưa kiểm chứng *(unverified — thuộc S-1)*.
→ `DailyReconciliation` (hoặc một schedule ngắn hơn) phải quét ProviderEvent mồ côi (I-13) và khởi động workflow cho chúng. Về bản chất đây là inbox pattern; nên gọi đúng tên trong C-2.

**G14 — Hành vi của DonationPayment và IncomingTransfer khi VA vừa hết hạn** (C10): §7.1 cho `IncomingTransfer` signal `PaymentReceived` tới `DonationPayment`, nhưng không nói gì khi workflow đích đã đóng.
→ Ghi rõ: signal lỗi NotFound thì tiền vào `suspense`.

**G15 — Void chỉ cần một admin, không đối chiếu tiền ra.** §7.3: "chỉ khi admin xác định tiền chưa chuyển mới chạy bút toán đảo `reserved → budget`". Đây là thao tác **mở lại ngân sách để chi tiếp**, rủi ro ngang một lần giải ngân, nhưng lại không thuộc BR-13 và không kiểm tra FR-PAY-04 ("mỗi khoản tiền ra phải gắn với một giải ngân").
→ Void reservation sau `TransferRecorded` phải (a) không có tiền ra nào gắn với request, và (b) qua duyệt hai người nếu vượt ngưỡng.

*(Ngoài lề, không phải tiền: T-5 ghi "local dùng `temporal server start-dev`" trong khi ADR-003 nói dev server chỉ cho test tự động và thử nhanh ngoài cluster. Nên sửa câu chữ T-5.)*

---

## 6. Throwaway hay skeleton — ý kiến

**Throwaway-but-harvest.** Đồng ý với khuyến nghị hiện tại, và có thêm lý do từ góc nhìn đối kháng:

1. **Code spike được viết để bị phá.** Nó chứa fault point, cờ `NAIVE_*`, stub Operations, actor nằm trong payload thay cho JWT. Đó đúng là những lối tắt mà một skeleton sẽ "tạm giữ lại" rồi không bao giờ gỡ. Lỗ hổng C-7 (E8) là ví dụ điển hình: chấp nhận được trong spike, không chấp nhận được trong production.
2. **History workflow của spike không dùng lại được làm bộ replay cho production**, vì code workflow sẽ viết lại theo layout thật. Giữ skeleton không mang lại lợi ích replay nào.
3. **Thứ có giá trị lâu dài không phải code Go** mà là:
   - (a) migration SQL: bảng, CHECK, constraint trigger `ENABLE ALWAYS`, GRANT/owner tách user;
   - (b) `ledger_audit.sql` cùng helper `AssertLedgerInvariants`;
   - (c) danh sách kịch bản P0/P1 thành **tên test** (`TestReserve_ConcurrentNeverNegative`, `TestIncomingTransfer_DuplicateAfterClose_PostsOnce`, …), kèm mô tả "naive phải fail";
   - (d) bảng phân loại SQLSTATE → retryable;
   - (e) bảng tài khoản với phía thông thường và quy tắc ghi (lời giải G3);
   - (f) tài liệu kết quả, sửa câu chữ ADR-001/ADR-003 theo G2/G4.

   Mấy thứ này không phụ thuộc layout `libs/`, `proto/` hay S-8.
4. **Rủi ro của throwaway** là viết lại rồi quên các ca đối kháng. Giảm rủi ro bằng cách đặt (b) và (c) vào thư mục sẽ được copy nguyên vào service Funds, và coi "toàn bộ P0 xanh, naive đỏ" là **Definition of Done** của module sổ cái khi triển khai.
5. **Ngoại lệ:** nếu spike xong mà layout repo (S-8) đã chốt, thì migration SQL và helper audit có thể đi thẳng vào `services/funds/` ngay. Phần còn lại vẫn bỏ.

---

### Nguồn đã kiểm chứng (2026-10-11)
- Temporal Workflow ID reuse/conflict policy, retention: https://docs.temporal.io/workflow-execution/workflowid-runid
- Temporal Go message passing (buffer signal, Update validator, drain signal): https://docs.temporal.io/develop/go/message-passing
- Temporal Go testing (replayer, `RegisterDelayedCallback`): https://docs.temporal.io/develop/go/testing-suite
- Temporal activity timeouts and retries: https://docs.temporal.io/encyclopedia/detecting-activity-failures
- `temporal server start-dev` không lưu trạng thái mặc định, cờ `--db-filename`: https://docs.temporal.io/cli/server
- Temporal Web UI `disableWriteActions`: https://docs.temporal.io/references/web-ui-configuration (chưa kiểm chứng việc chặn riêng thao tác signal)
- PostgreSQL constraint trigger (AFTER ROW, deferred, TRUNCATE chỉ ở mức statement): https://www.postgresql.org/docs/current/sql-createtrigger.html
- PostgreSQL ALTER TABLE (owner, DISABLE TRIGGER, ENABLE ALWAYS): https://www.postgresql.org/docs/current/sql-altertable.html
- PostgreSQL `session_replication_role`: https://www.postgresql.org/docs/current/runtime-config-client.html
- PostgreSQL `sum(bigint) → numeric`: https://www.postgresql.org/docs/current/functions-aggregate.html
- TigerBeetle pending timeout / post một phần: https://docs.tigerbeetle.com/reference/transfer/
- *(unverified)*: kiểu sqlc sinh cho `SUM(bigint)`; chính sách retry của SePay; PayOS và SePay có cùng theo dõi một tài khoản không; tên và đường dẫn hiện hành của `workflowcheck`; retention của namespace `foodfund`.
