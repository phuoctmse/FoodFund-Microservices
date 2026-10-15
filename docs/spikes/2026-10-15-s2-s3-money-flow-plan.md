# Spike S-2 + S-3 (luồng tiền) — Kế hoạch triển khai

> **Người thực hiện:** chủ dự án tự làm toàn bộ, kể cả code. Claude là mentor: không viết code trừ khi được yêu cầu rõ cho một phần cụ thể. Plan này **cố ý không chứa code** (D-14). Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Trả lời Q1–Q6 của [thiết kế spike](./2026-10-11-s2-s3-money-flow-design.md), rồi dùng chính hệ thống đó để thực hành test API, pen test và hiệu năng theo [thiết kế bổ sung](./2026-10-15-s2-s3-money-flow-skills-addendum.md).

**Kiến trúc:** Go module `spikes/money-flow/`. Giai đoạn A–D chạy với PostgreSQL 18 qua testcontainers và `temporal server start-dev`. Giai đoạn E–H deploy lên cluster kind `foodfund` (CloudNativePG, Temporal, Traefik đã có từ S-9) và kiểm thử từ bên ngoài bằng Python, k6, ZAP.

**Công cụ (phiên bản đã kiểm 2026-10-15):**

| Nhóm | Công cụ |
|---|---|
| Go | Go 1.26.2 · pgx v5.11.0 · sqlc v1.31.1 · goose v3.28.0 · testcontainers-go v0.44.0 · Temporal Go SDK v1.49.0 · `workflowcheck` v0.6.0 · testify v1.12.1 |
| Temporal | CLI 1.9.1 (dev server 1.32.0) · trên kind: chart 1.7.0 → server 1.32.0 |
| Hạ tầng | Docker 29.4.1 · kind v0.33.0 (node v1.35.8) · kubectl 1.34 · CNPG 1.30.1 · PostgreSQL 18.6 · Traefik 3.7.14 |
| Python | Python 3.14.3 · uv 0.13.0 · pytest 9.1.1 · httpx 0.28.1 · psycopg 3.3.6 · schemathesis 4.31.1 |
| Hiệu năng | k6 v2.3.0 · OpenTelemetry Go v1.47.0 · Temporal `contrib/opentelemetry` v0.8.1 · Grafana Alloy v1.20.1 |
| Bảo mật | OWASP ZAP 2.17.0 · kubescape v4.0.16 |

Chưa cài trên máy: **k6, kubescape, ZAP** (cài ở task cần dùng), và **gcc 64-bit** (cài ở Task 0).

## Ràng buộc chung

Đây là những điều **đã chốt trong thiết kế, không được đổi**. Mọi task đều phải tuân theo.

- Code nằm trong `spikes/money-flow/`, nhánh `spike/money-flow` tách từ `docs/rewrite-requirements`.
- Thư mục cấp một theo thiết kế §4: `migrations/`, `ledger/`, `webhook/`, `workflows/`, `activities/`, `harness/`. Thêm `faults/`, `cmd/`, `scenarios/`, `api/`, `deploy/`, `apitests/`, `perf/`, `journal/` khi tới task cần. Bên trong mỗi thư mục, bạn tự tổ chức.
- Tiền là `bigint`/`int64` VND. Không dùng float.
- Role: `funds_owner` (NOLOGIN, sở hữu mọi thứ), `funds_migrator` (LOGIN, member của owner), `funds_app` (LOGIN; chỉ `SELECT, INSERT` trên `ledger.*`). Từ giai đoạn E có thêm `funds_qa` (chỉ `SELECT`).
- Bảng, cột và trigger theo thiết kế §5.2; phác thảo DDL ở [báo cáo ledger §1.2](./s2-s3-panel/01-ledger-postgres.md#12-phác-thảo-ddl-mô-hình-t--a).
- Lỗi trigger: `ERRCODE = check_violation (23514)`, `CONSTRAINT` ∈ {`ledger_entry_complete`, `ledger_account_nonnegative`, `ledger_isolation`}.
- Bảng tài khoản và khoá chống trùng theo thiết kế §5.3. `platform_cash` có phía thông thường `D`, các tài khoản khác `C`. Mọi tài khoản cấm âm (trừ tài khoản test riêng của Task 2).
- Khoá chống trùng lấy từ nghiệp vụ. **Không** dùng RunID, attempt hay uuid.
- Phân loại lỗi theo thiết kế §5.5. Ánh xạ HTTP của webhook theo §6, của Funds API theo thiết kế bổ sung §4.1.
- Workflow: `transfer-sepay-{txnId}` với các policy ở thiết kế §6; `disbursement-{requestId}` với `REJECT_DUPLICATE`; luật saga theo §7 và D-4…D-10.
- Công tắc "naive" (bỏ khoá, bỏ trigger, đổi khoá) chỉ nằm trong `testdata/` hoặc `faults/` (build tag `spike`). **Không bao giờ** nằm trong `migrations/`.
- Giai đoạn A–D không dùng kind; giai đoạn E–H dùng kind (D-18).
- Pen test chỉ nhắm vào cluster kind trên laptop (D-21).

---

## Cách làm việc

### Mỗi task có gì

| Phần | Nội dung |
|---|---|
| **Học trước** | Tài liệu nên đọc trước khi bắt tay |
| **Mục tiêu** | Task phải chứng minh điều gì |
| **Đã chốt** | Phần của thiết kế mà task này chạm tới |
| **Bạn tự thiết kế** | Những gì bạn quyết; ghi vào `NOTES.md` |
| **Test** | Tên test và điều kiện đạt. Code test bạn tự viết |
| **Bẫy** | Chỉ nêu bẫy, không nêu cách giải |
| **Xong khi** | Điều kiện để gọi checkpoint |

### Ba file bạn tự duy trì

- **`spikes/money-flow/NOTES.md`:** API Go bạn thiết kế (tên package, hàm, kiểu dữ liệu), và mọi quyết định nhỏ kèm lý do. Task sau dựa vào đây, nên phải cập nhật trước mỗi checkpoint.
- **`spikes/money-flow/journal/task-NN.md`:** nhật ký từng task (xem "Hai thói quen" bên dưới).
- **`docs/spikes/<ngày>-s2-s3-money-flow.md`:** bản nháp kết quả. Mỗi khi có bằng chứng (lệnh + output) thì ghi vào ngay, không để dồn tới cuối.

### Hai thói quen ở mọi task (D-16)

Mỗi task đều bắt đầu bằng hai bước dưới, ghi vào `journal/task-NN.md`:

1. **Phân tích (20–30 phút):** thành phần nào tham gia, dữ liệu đi qua đâu; cái gì có thể hỏng, và hậu quả với tiền; danh sách ca test của bạn. Danh sách này có thể khác tên test trong plan: thêm thì tốt, bớt thì ghi lý do.
2. **AI hỗ trợ kiểm thử:** đưa cùng bối cảnh cho một AI agent **khác mentor** (agy/Gemini, hoặc một phiên Claude mới). Nhờ nó liệt kê ca test; khi viết xong, nhờ nó review test. Ghi ba mục: AI tìm ra gì bạn bỏ sót · AI sai hoặc bịa ở đâu · bạn kiểm chứng bằng cách nào. Không thứ gì từ AI vào repo nếu chưa được chạy và kiểm chứng.

### Mentor

- **Khi bí:**
  - "gợi ý 1": hướng nghĩ, nên đọc gì.
  - "gợi ý 2": cấu trúc lời giải, API cần dùng.
  - "gợi ý 3": một đoạn code nhỏ cho đúng chỗ đang bí.
- **"review task N":** mình đọc diff, `NOTES.md` và nhật ký, chạy test, rồi nhận xét theo ba mức *phải sửa / nên sửa / để ý*. Chưa qua "phải sửa" thì chưa sang task sau.
- Ở giai đoạn G và H, mình có **đáp án ẩn** (D-23) và chỉ đem ra so sau khi bạn nộp báo cáo.

### Nhịp làm mỗi test

Viết test → chạy, thấy FAIL **đúng lý do** → viết code → chạy, thấy PASS → commit. Nếu test PASS ngay từ đầu thì dừng lại: hoặc test sai, hoặc code đã có sẵn.

### Test "phải FAIL"

Mỗi kịch bản P0 có một biến thể cố ý sai, và biến thể đó **bắt buộc FAIL** (thiết kế §8.1). Nếu biến thể sai mà vẫn xanh, test chưa đủ nhạy. Lưu output của lần FAIL vào bản nháp kết quả.

---

## Lịch

| Giai đoạn | Task | Trả lời / thực hành | Ngày công |
|---|---|---|---|
| 0 — Môi trường | 0 | — | 1 |
| A — Sổ cái | 1–6 | Q1, Q2, Q3 | 8,5 |
| B — Tiền vào | 7–10 | Q4, Q5 | 6,5 |
| C — Saga | 11–14 | Q6 | 6,5 |
| D — Cổng | 15 | Kết luận Q1–Q6 | 0,5 |
| E — Deploy | 16–17 | API, k8s | 4 |
| F — Test API | 18–19 | Python, API/DB testing | 4 |
| G — Pen test | 20–22 | Bảo mật | 4 |
| H — Hiệu năng | 23–26 | Độ trễ, mở rộng, Q7 | 4 |
| I — Kết thúc | 27 | Báo cáo, AI trong kiểm thử | 1 |
| **Tổng** | | | **≈ 40** |

Sau mỗi giai đoạn có một **cổng**: ghi kết quả, rồi cùng mentor quyết đi tiếp hay cắt.

---

# Giai đoạn 0 — Môi trường

### Task 0: Chuẩn bị máy và học Go cơ bản (1 ngày)

**Học trước:**
- [A Tour of Go](https://go.dev/tour/): Basics, Methods and interfaces, Concurrency.
- [How to Write Go Code](https://go.dev/doc/code).
- [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors): `errors.Is`, `errors.As`, `%w`.
- [Add a test](https://go.dev/doc/tutorial/add-a-test).

**Mục tiêu:** Có module Go mới, chạy được `go test -race ./...`, Docker hoạt động.

**Tình trạng máy đã biết** (kiểm 2026-10-15):
- gcc đang cài là MinGW.org 6.3.0, bản 32-bit → `go test -race` báo lỗi `64-bit mode not compiled in`. Cần một gcc 64-bit đứng trước trong PATH. Kiểm bằng `gcc -dumpmachine`.
- Docker Desktop đang tắt.

- [ ] Tạo nhánh `spike/money-flow` từ `docs/rewrite-requirements`.
- [ ] Cài gcc 64-bit; bật Docker Desktop; `docker pull postgres:18.6`.
- [ ] `go mod init` trong `spikes/money-flow/`; thêm các thư viện ở bảng công cụ, đúng phiên bản.
- [ ] Viết một test bất kỳ, cho nó FAIL có chủ đích rồi PASS; chạy với `-race`.
- [ ] Tạo `.gitignore`, `NOTES.md`, `journal/`.
- [ ] Commit.

**Xong khi:** `go test -race ./...` chạy được. **Checkpoint:** "review task 0". Mình sẽ hỏi 3 câu về `errors.Is`/`errors.As`.

---

# Giai đoạn A — Sổ cái (Q1, Q2, Q3)

### Task 1: Harness PostgreSQL và tách role (1,5 ngày)

**Học trước:** [Privileges](https://www.postgresql.org/docs/18/ddl-priv.html) · [báo cáo ledger §3.1](./s2-s3-panel/01-ledger-postgres.md#31-thiết-kế-role-và-quyền) · [testcontainers-go Postgres](https://golang.testcontainers.org/modules/postgres/) · [goose annotations](https://pressly.github.io/goose/documentation/annotations/) và goose `Provider` API · `TestMain` trong [package testing](https://pkg.go.dev/testing#hdr-Main).

**Mục tiêu:** Mỗi package test có một PG 18 riêng, đã có đủ ba role và hai schema (`ledger`, `funds`), với DSN cho từng role.

**Đã chốt:**
- `migrations/bootstrap/roles.sql` chạy bằng superuser, **không** qua goose, và **không** chứa mật khẩu (file này được giữ lại cho production).
- Migration goose chạy bằng `funds_migrator`, với tư cách `funds_owner`.
- `REVOKE CONNECT, TEMPORARY ON DATABASE … FROM PUBLIC`.
- Default privileges: schema `ledger` cho app `SELECT, INSERT`; schema `funds` cho app `SELECT, INSERT, UPDATE`.

**Bạn tự thiết kế:** API của harness (cách khởi động container, lấy DSN theo role, mở pool, dọn dẹp); cách để migrator tự chạy dưới quyền owner; cách để bảng `goose_db_version` tạo được (nó cần một schema mà migrator ghi được).

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestBootstrap_MigratorActsAsOwner` | `current_user` của phiên migrator là `funds_owner` |
| `TestBootstrap_SchemasOwnedByOwner` | owner của `ledger` và `funds` đều là `funds_owner` |
| `TestBootstrap_AppIsPlainRole` | `funds_app` không superuser, không CREATEROLE/CREATEDB, không là member của `funds_owner` |
| `TestBootstrap_AppCannotCreateInLedger` | `CREATE TABLE ledger.x` bằng app → `42501` |

**Bẫy:**
- Go cache kết quả test (cần cờ để buộc chạy lại).
- File SQL có BOM.
- Đường dẫn file tương đối thay đổi theo package đang chạy test.
- Gửi nhiều câu lệnh SQL trong một lần `Exec` chỉ chạy được khi không có tham số.

**Xong khi:** 4 test PASS; bạn giải thích được vì sao owner luôn tự cấp lại được quyền đã bị thu hồi. **Checkpoint:** "review task 1". Mình review `roles.sql` và migration như code production.

---

### Task 2: Schema sổ cái và trigger hoãn (Q1) (1,5 ngày)

**Học trước:** [báo cáo ledger §1.2, §2](./s2-s3-panel/01-ledger-postgres.md#2-q1--ép-tính-đúng-của-bút-toán-bằng-trigger-hoãn) · [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html) (phần constraint trigger) · [SET CONSTRAINTS](https://www.postgresql.org/docs/18/sql-set-constraints.html) · [`pgx.Tx`](https://pkg.go.dev/github.com/jackc/pgx/v5#Tx).

**Mục tiêu:** DB tự từ chối entry sai hình dạng lúc COMMIT, kể cả khi code cố ý ghi sai.

**Đã chốt:**
- Ba bảng, view `account_balances` (cột `balance` phải là `bigint`), hàm `check_entry` (`SECURITY DEFINER`, `search_path` cố định, `REVOKE EXECUTE FROM PUBLIC`).
- Constraint trigger `DEFERRABLE INITIALLY DEFERRED` trên **cả** `journal_entries` và `transfers`, đều `ENABLE ALWAYS`.
- `forbid_mutation` chặn UPDATE/DELETE/TRUNCATE trên cả ba bảng.
- Trigger từ chối REPEATABLE READ; khoá các tài khoản cấm âm theo thứ tự id (cho Q3).
- Có phần `-- +goose Down`.

**Test** (ghi sai bằng SQL thô, không qua code ghi sổ; dùng tài khoản `allow_negative = true` để tách Q1 khỏi Q3):

| Tên | Đạt khi |
|---|---|
| `TestEntry_DeclaredTwoWroteOne_RejectedAtCommit` (L1) | câu INSERT chân lẻ vẫn OK; COMMIT lỗi `23514`/`ledger_entry_complete`; không còn dòng nào |
| `TestEntry_NoLegs_RejectedAtCommit` (L2) | như trên |
| `TestEntry_AddLegToCommittedEntry_Rejected` (L3) | tx sau thêm chân vào entry đã commit → COMMIT lỗi |
| `TestEntry_LegsInSeparateStatements_Commits` (L4) | hai chân bằng hai câu lệnh trong một tx → thành công |
| `TestTransfer_InvalidAmountOrSameAccount_RejectedImmediately` (L5) | `amount` = 0, -1, debit = credit → lỗi **ngay ở câu lệnh** |
| `TestEntry_SetConstraintsImmediateMidEntry_Behaviour` (L6) | ghi lại hành vi quan sát được |

**Phải FAIL:** biến thể `testdata/naive/notrigger.sql` (drop hai constraint trigger) → L1, L2, L3 FAIL; L4, L5 vẫn PASS. Bạn tự thiết kế cách harness bật biến thể này (ví dụ bằng biến môi trường).

**Bẫy:**
- goose cắt thân hàm plpgsql ở dấu `;` đầu tiên.
- Constraint trigger không dùng được `CREATE OR REPLACE`.
- Mệnh đề `WHEN` của constraint trigger không được hoãn.
- `sum(bigint)` trả về `numeric`.
- Các test dùng chung một DB mà sổ cái không xoá được → dữ liệu test phải có tên duy nhất.

**Xong khi:** 6 test PASS, naive FAIL; bạn giải thích được vì sao cần trigger trên cả hai bảng. **Checkpoint:** "review task 2".

---

### Task 3: Quyền chỉ INSERT (Q2, phần 1) (1 ngày)

**Học trước:** [báo cáo ledger §3.1–3.2](./s2-s3-panel/01-ledger-postgres.md#3-q2--quyền-chỉ-insert-pgx-v5-và-sqlc) · [table-driven tests](https://go.dev/wiki/TableDrivenTests), [`t.Run`](https://pkg.go.dev/testing#T.Run) · [`pgconn.PgError`](https://pkg.go.dev/github.com/jackc/pgx/v5/pgconn#PgError).

**Mục tiêu:** `funds_app` không sửa, xoá hay vô hiệu hoá được sổ cái; lỗi COMMIT về Go đúng kiểu; kết nối vẫn dùng tiếp được sau COMMIT lỗi.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestPrivileges_AppCannotMutateOrBypassLedger` | bằng app, mọi lệnh sau đều trả `42501`: UPDATE/DELETE/TRUNCATE trên 3 bảng · `ON CONFLICT DO UPDATE` · `SELECT … FOR UPDATE` trên `accounts` · `ALTER TABLE … DISABLE TRIGGER` · `SET session_replication_role = replica` |
| `TestPrivileges_OwnerBlockedByForbidMutation` | owner UPDATE/TRUNCATE `transfers` → bị `forbid_mutation` chặn |
| `TestPrivileges_Catalog` | một câu SELECT trả **các dòng vi phạm** = rỗng: `has_table_privilege` false cho UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN; trigger `tgenabled = 'A'` |
| `TestCommit_AfterSwallowedError_ErrTxCommitRollback` | `errors.Is(err, pgx.ErrTxCommitRollback)` |
| `TestPool_SingleConnUsableAfterFailedCommit` | pool `MaxConns=1`: sau COMMIT lỗi, tx kế tiếp chạy được |

**Bẫy:** một lệnh UPDATE không khớp dòng nào mà trả "UPDATE 0" thay vì lỗi quyền. Nếu ca nào PASS ngoài ý muốn thì sửa migration, không sửa test.

**Xong khi:** mọi test PASS; ghi vào bản nháp: "SELECT FOR UPDATE cần quyền UPDATE → khoá phải nằm trong trigger". **Checkpoint:** "review task 3".

---

### Task 4: Bảng Funds, ngân hàng giả và bộ kiểm tra sổ cái (1,5 ngày)

**Học trước:** [thiết kế §8.1](./2026-10-11-s2-s3-money-flow-design.md#81-hạ-tầng-test) · [báo cáo kiểm thử §3](./s2-s3-panel/03-adversarial-tests.md#3-bộ-bất-biến-toàn-cục-ledger-audit). Báo cáo viết cho mô hình postings, nên bạn phải tự chuyển sang mô hình transfers.

**Mục tiêu:** Có một bộ kiểm tra bất biến chạy sau **mỗi** kịch bản, và một "ngân hàng giả" để đối soát.

**Đã chốt:**
- `migrations/00003_funds.sql`: `provider_events` (khoá `(provider, provider_txn_id)`, có `payload_hash`), `disbursements` (status ∈ PENDING, REJECTED, CANCELLED, DISBURSED, FAILED), `reconciliation_cases` (`case_key` UNIQUE), `approval_records` (khoá là update ID).
- `testdata/testonly.sql`: `fake_bank` (`direction` ∈ in/out, `linked_ref`), `stub_calls` (`call_key` UNIQUE), `published_events` (`event_id` UNIQUE).
- `harness/ledger_audit.sql` (**giữ lại**): mỗi truy vấn trả **các dòng vi phạm**, gồm I1–I7 theo thiết kế §8.1:

| Mã | Kiểm |
|---|---|
| I1 | mỗi entry có đúng `transfer_count` chân |
| I2 | không tài khoản cấm âm nào âm |
| I3 | mỗi `(provider, txnId)` có đúng một entry; số tiền ghi = số nhà cung cấp báo |
| I4 | không request nào vừa post vừa void; `status` khớp sổ cái |
| I5 | `balance(platform_cash)` = Σin − Σout của `fake_bank`; không void nào khi đã có tiền ra gắn request |
| I6 | không `provider_events` mồ côi quá 5 phút |
| I7 | quyền và trigger vẫn đúng như Task 3 |

**Bạn tự thiết kế:** định dạng file audit và cách tách truy vấn; helper chạy audit sau mỗi test; helper nạp tiền vào hệ thống **kèm** dòng `fake_bank` tương ứng.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestAudit_PassesOnHealthyLedger` | không báo lỗi |
| `TestAudit_DetectsBankMismatch` | ghi tiền vào `platform_cash` mà không ghi `fake_bank` → audit báo I5 |
| Gắn audit vào mọi test đã có của Task 2 | vẫn xanh |

**Bẫy:**
- Muốn quan sát audit báo lỗi thì không được để test đó tự FAIL.
- Test cố ý làm lệch I5 sẽ làm hỏng audit của mọi test khác dùng chung DB.
- Từ giờ, test nào cần tiền trong hệ thống mà không đi qua đường có `fake_bank` sẽ làm I5 đỏ.

**Xong khi:** audit sạch trên mọi test; tự kiểm chứng được là audit bắt được lệch. **Checkpoint:** "review task 4". `ledger_audit.sql` là tài sản giữ lại quan trọng nhất.

---

### Task 5: Hàm ghi sổ với sqlc, chống trùng và phân loại lỗi (Q2 phần 2, nền cho Q5) (2 ngày)

**Học trước:** [sqlc + pgx](https://docs.sqlc.dev/en/latest/guides/using-go-and-pgx.html) · [sqlc transactions](https://docs.sqlc.dev/en/latest/howto/transactions.html) · [sqlc config](https://docs.sqlc.dev/en/latest/reference/config.html) · [thiết kế §5.4, §5.5](./2026-10-11-s2-s3-money-flow-design.md#54-ghi-idempotent) · [báo cáo ledger §1.4, §3.2, §3.3](./s2-s3-panel/01-ledger-postgres.md#14-idempotency).

**Mục tiêu:** Một hàm ghi sổ duy nhất: idempotent theo khoá nghiệp vụ, trả lỗi có kiểu, chỉ dùng quyền INSERT.

**Đã chốt:**
- `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. Trùng khoá thì so `request_hash`: giống → trả id cũ; khác → lỗi xung đột (non-retryable).
- Một tx READ COMMITTED cho mỗi entry.
- Bảng phân loại §5.5.

**Bạn tự thiết kế** (ghi `NOTES.md`):
- Kiểu dữ liệu của entry và chân; chữ ký hàm ghi sổ, đọc số dư, tạo tài khoản.
- Các lỗi sentinel; hàm phân loại lỗi.
- Nội dung của `request_hash`: những trường nào được đưa vào, và vì sao `actor` thì không.
- Cách chèn nhiều chân trong một câu lệnh.
- Xử lý lỗi "không thuộc loại nào" trong §5.5. Thiết kế chưa nói; bạn chọn và ghi lý do.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestPost_ValidEntry_MovesBalances` | số dư hai phía đúng |
| `TestPost_SameKeySameContent_ReturnsSameID` | cùng id, 1 entry |
| `TestPost_SameKeyDifferentContent_Conflict` (D3) | lỗi xung đột; sổ cái không đổi |
| `TestPost_Overdraw_InsufficientFunds` | nhận ra được bằng `errors.Is` **và** vẫn `errors.As` ra `*pgconn.PgError` |
| `TestPost_RetryAfterCommit_NotInsufficient` | còn đúng X, giữ X → OK; gọi lại đúng entry đó → cùng id, **không** báo thiếu tiền |
| `TestPost_SameKeyConcurrent_OneEntry` | 20 goroutine cùng khoá → 1 entry, cả 20 nhận cùng id |
| `TestPost_UnknownAccount` | lỗi có kiểu riêng |
| `TestClassify` | unit test thuần (không DB), đủ mọi dòng của §5.5 |

**Câu hỏi Q2 phải ghi lại:** `sqlc generate` có phân tích được migration PG18 (`uuidv7()`, constraint trigger, plpgsql) không? Nếu không, phương án dự phòng ở thiết kế §9.

**Bẫy:**
- Bỏ qua lỗi trả về từ `Commit` = mất tiền im lặng.
- Kiểm số dư trong Go trước khi ghi (vừa thừa, vừa sai thứ tự).
- Kiểu `pgtype.UUID` do sqlc sinh ra.
- Gọi `t.Fatal` hay `require` bên trong goroutine.

**Xong khi:** mọi test PASS; kết quả `sqlc generate` đã ghi vào bản nháp. **Checkpoint:** "review task 5".

---

### Task 6: Đồng thời, không chi vượt ngân sách (Q3) (1 ngày)

**Học trước:** [goroutine](https://go.dev/tour/concurrency/1), [`sync.WaitGroup`](https://pkg.go.dev/sync#WaitGroup) · [báo cáo ledger §4](./s2-s3-panel/01-ledger-postgres.md#4-q3--hai-lần-reserve-đồng-thời-có-chi-vượt-ngân-sách-được-không) · [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).

**Mục tiêu:** Chứng minh khoá trong trigger chặn được chi vượt khi có nhiều thao tác giữ tiền chạy đồng thời.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestReserveNoOverspend` (B1) | 50 goroutine, mỗi cái giữ 100.000 trên ngân sách 1.000.000; pool 50 kết nối; tất cả xuất phát cùng lúc; lặp 50 vòng; chạy với `-race` → mỗi vòng đúng 10 thành công / 40 thiếu tiền / 0 lỗi khác; số dư cuối 0 |
| `TestReserve_ExactBoundary` (B5) | còn X: giữ X → OK; giữ X+1 → thiếu tiền, sổ không đổi |
| `TestReserve_RepeatableReadRejected` (NC-2) | lỗi `ledger_isolation` |

**Phải FAIL:** `testdata/naive/nolock.sql` (hàm trigger bỏ `FOR UPDATE`, thêm `pg_sleep` sau bước tính số dư) → B1 FAIL ở ít nhất một vòng.

**Bẫy:**
- Pool mặc định nhỏ nên tự xếp hàng → test "xanh giả".
- `max_connections` mặc định của container.
- Ghi chung một biến từ nhiều goroutine.
- Thời gian chạy dài (báo mentor trước khi giảm số vòng).

**Xong khi:** PASS với `-race`; naive FAIL. **Checkpoint:** "review task 6".

### 🚦 Cổng A

- [ ] Bản nháp kết quả có kết luận đạt/trượt cho Q1, Q2, Q3, kèm lệnh, output, và output của các lần naive FAIL.
- [ ] Cùng mentor quyết: đi tiếp, hay áp phương án dự phòng.

---

# Giai đoạn B — Tiền vào (Q4, Q5)

### Task 7: Học Temporal bằng một workflow nhỏ (1,5 ngày)

**Học trước:**
- [Go core application](https://docs.temporal.io/develop/go/core-application).
- [Deterministic constraints](https://docs.temporal.io/workflow-definition#deterministic-constraints).
- [Go message passing](https://docs.temporal.io/develop/go/message-passing): Signal, Update, validator.
- [Go testing suite](https://docs.temporal.io/develop/go/testing-suite).
- `temporal server start-dev --help`.

**Mục tiêu:**
- Viết một workflow đồ chơi: nhận Update `add` có validator (từ chối số ≤ 0), cộng dồn, kết thúc khi đạt ngưỡng.
- Test nó bằng thời gian ảo **và** trên dev server thật.
- Xác nhận Update chạy được trên server 1.32 (mục chưa kiểm chứng trong báo cáo Temporal).

**Bạn tự thiết kế:** harness dev server (khởi động như tiến trình con, chờ sẵn sàng, dừng, khởi động lại trên **cùng** file DB, đặt retention cho namespace); helper tạo client Temporal cho test.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestCounter_ValidatorRejectsNonPositive` | testsuite: Update -1 bị từ chối (callback reject), Update 5 được nhận; workflow kết thúc với 5 |
| `TestCounter_OnDevServer` | dev server thật: `UpdateWorkflow` chờ tới stage Completed trả 5; workflow kết thúc |

- [ ] Thí nghiệm, không commit: thêm `time.Now()` vào workflow, chạy `workflowcheck`, đọc nó báo gì.

**Bẫy:**
- Cổng 7233 đang bị chiếm.
- Validator có tác dụng phụ.
- Chữ ký API của testsuite khác với ví dụ trên mạng (kiểm bằng `go doc`).

**Xong khi:** 2 test PASS; bạn trả lời được: vì sao workflow không được gọi `time.Now()`; Update khác Signal ở đâu; validator khác handler ở đâu. **Checkpoint:** "review task 7", kèm 3 câu hỏi kiểm tra hiểu bài.

---

### Task 8: Activity tiền vào và workflow `IncomingTransfer` (1,5 ngày)

**Học trước:** [thiết kế §6](./2026-10-11-s2-s3-money-flow-design.md#6-tiền-vào-webhook--incomingtransfer) · [báo cáo Temporal §2](./s2-s3-panel/02-temporal.md#2-q5--activity-idempotent) · [failure detection](https://docs.temporal.io/develop/go/failure-detection) · `temporal.NewNonRetryableApplicationError`.

**Mục tiêu:** Tiền vào khớp mã chiến dịch → ghi quyên góp; không khớp → `suspense` kèm case đối soát. Lỗi sổ cái được đổi thành lỗi Temporal đúng loại.

**Đã chốt:**
- Khoá `donation:sepay:{txnId}` và `suspense:sepay:{txnId}`; case `suspense:sepay:{txnId}`.
- Quy tắc khớp của spike (thay `DonationPayment`): khớp ⇔ có tài khoản `campaign_received:{code}`.
- Activity Funds: StartToClose mặc định 10 s, retry 1 s × 2, tối đa 1 phút, không giới hạn số lần (thiết kế §7).
- StartToClose phải chỉnh được qua input workflow, để test sau rút ngắn.

**Bạn tự thiết kế:** struct activity và cách nó giữ pool; input/output của workflow; ánh xạ phân loại lỗi → `ApplicationError` (type string do bạn đặt, ghi `NOTES.md`).

**Test** (activity thật trên PG):

| Tên | Đạt khi |
|---|---|
| `TestPostDonation_Twice_SameEntryID` | cùng id |
| `TestPostDonation_SameKeyDifferentAmount_NonRetryable` (D3) | `ApplicationError` non-retryable, đúng type |
| `TestIncomingTransfer_Matched_PostsDonation` | 1 entry donation; audit sạch |
| `TestIncomingTransfer_Unmatched_SuspenseAndCase` | entry suspense + 1 case |

**Bẫy:**
- Struct không tuần tự hoá được sang JSON.
- Gọi activity bằng method value mà quên đăng ký đúng struct.
- I5 đỏ vì quên ghi `fake_bank`.

**Xong khi:** PASS, audit sạch. **Checkpoint:** "review task 8".

---

### Task 9: Webhook SePay giả và chống trùng hai lớp (Q4) (2 ngày)

**Học trước:** [thiết kế §6](./2026-10-11-s2-s3-money-flow-design.md#6-tiền-vào-webhook--incomingtransfer) · [báo cáo Temporal §1](./s2-s3-panel/02-temporal.md#1-q4--chống-trùng-ở-điểm-vào) · [Workflow ID reuse/conflict policy](https://docs.temporal.io/workflow-execution/workflowid-runid) · [`net/http`](https://pkg.go.dev/net/http), [`httptest`](https://pkg.go.dev/net/http/httptest), [`crypto/hmac`](https://pkg.go.dev/crypto/hmac) · [Go build constraints](https://pkg.go.dev/cmd/go#hdr-Build_constraints).

**Mục tiêu:** Webhook lặp (khi workflow đang chạy, đã đóng, hay đã bị xoá) → đúng một bút toán. Temporal ngừng → 503, gửi lại sau → thành công.

**Đã chốt:**
- **Thứ tự trong handler:** verify HMAC (sai → 401, không gọi Temporal) → lưu `provider_events` với `ON CONFLICT DO NOTHING` → **luôn** gọi `ExecuteWorkflow`.
- Start options và ánh xạ HTTP theo thiết kế §6.
- Cùng `txnId` nhưng `payload_hash` khác → case cảnh báo, không ghi sổ thêm, vẫn trả 200.
- Định danh giao dịch là trường `id` của payload SePay (S-1).
- Chữ ký của spike: HMAC-SHA256 của body thô, trong một header do bạn đặt tên.
- **Điểm tiêm lỗi** (chỉ có khi build tag `spike`): ngủ trước commit, thoát tiến trình sau commit, chỉ ở attempt 1.
- **Cờ naive:** reuse policy mặc định + khoá có RunID; khoá ngẫu nhiên mỗi attempt.

**Bạn tự thiết kế:** cấu trúc package `faults` (bản `spike` và bản no-op); cách điểm tiêm lỗi biết tên activity và attempt; struct handler; input workflow lấy từ đâu khi event đã tồn tại.

**Test** (`scenarios/`, build tag `spike`, dev server thật):

| Tên | Đạt khi |
|---|---|
| `TestInbound_DuplicateWhileRunning_PostsOnce` (C1, C8) | 10 POST song song khi activity đang ngủ → cả 10 trả 200; 1 event; 1 entry |
| `TestInbound_DuplicateAfterClose_PostsOnce` (C2) | gửi lại sau khi Completed → 200; 1 entry |
| `TestInbound_DuplicateAfterRetention_PostsOnce` (C3) | xoá execution, chờ tới khi thật sự mất, gửi lại → workflow mới chạy nhưng vẫn 1 entry |
| `TestInbound_SameAmountDifferentTxn_PostsTwice` (C4) | 2 entry |
| `TestInbound_SameTxnDifferentPayload_AlertsNoRepost` (C5) | 1 entry theo payload đầu + 1 case |
| `TestInbound_TemporalDown_503ThenRecovers` (C7) | 503, event đã lưu, 0 entry → bật lại → 200, 1 entry |
| `TestInbound_BadSignature_401` | 401, không có event |

**Phải FAIL:** cờ naive về dedup → C2 thấy 2 entry. Đây là bằng chứng cho D-11.

**Bẫy:**
- Trả 200 sớm khi event đã có.
- Xoá execution là bất đồng bộ.
- Lỗi "already started" bị SDK nuốt mất.
- Biến môi trường đặt trong test và chạy test song song.
- Handler chờ tới hết timeout khi Temporal ngừng.

**Xong khi:** 7 test PASS, naive FAIL. **Checkpoint:** "review task 9".

---

### Task 10: Worker chết sau commit và hai lần thử song song (Q5) (1,5 ngày)

**Học trước:** [Detecting activity failures](https://docs.temporal.io/encyclopedia/detecting-activity-failures) · [báo cáo Temporal §2.4](./s2-s3-panel/02-temporal.md#24-tiêm-lỗi-commit-xong-mất-kết-quả-một-cách-tất-định) · [`os/exec`](https://pkg.go.dev/os/exec) · `GetWorkflowHistory` trong Go SDK client.

**Mục tiêu:** Worker chết ngay sau commit → lần thử sau trả cùng `entryId`. Hai lần thử chạy chồng nhau → vẫn 1 entry.

**Bạn tự thiết kế:**
- `cmd/worker` cấu hình qua biến môi trường (DSN, địa chỉ Temporal, danh sách task queue).
- Harness: build binary worker một lần cho cả package; chạy, chờ thoát, kill.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestRetry_WorkerDiesAfterCommit_SameEntry` (D1) | worker A tự thoát sau commit → worker B hoàn thành; 1 entry; id trong kết quả workflow = id trong DB; attempt cuối ≥ 2 (đọc từ history) |
| `TestRetry_ConcurrentAttempts_OneEntry` (D2) | hai worker, attempt 1 ngủ lâu hơn StartToClose → 1 entry, workflow hoàn thành |

**Phải FAIL:** cờ naive khoá ngẫu nhiên → D1 thấy 2 entry.

**Bẫy:**
- `go run` trên Windows: kill tiến trình cha không kill được tiến trình con.
- Biến môi trường của test không tự sang tiến trình con.
- Ý nghĩa thật của số attempt trong sự kiện `ActivityTaskStarted`.

**Xong khi:** PASS, naive FAIL. **Checkpoint:** "review task 10".

### 🚦 Cổng B

- [ ] Kết luận Q4, Q5 (phần tiền vào), kèm bằng chứng. Cùng mentor quyết đi tiếp.

---

# Giai đoạn C — Saga giải ngân (Q6)

### Task 11: Activity giải ngân và stub Operations/Campaign (1 ngày)

**Học trước:** [thiết kế §5.3, §7](./2026-10-11-s2-s3-money-flow-design.md#7-saga-disbursement) · [báo cáo Temporal §5](./s2-s3-panel/02-temporal.md#5-activity-xuyên-service-operations-markdisbursed-campaign-advancephase) · [đăng ký activity theo tên](https://pkg.go.dev/go.temporal.io/sdk/worker#ActivityRegistry).

**Mục tiêu:** Có đủ các activity mà saga cần; các activity phía đích (stub) đều idempotent.

**Đã chốt:**
- **Funds** (task queue `funds`):

  | Activity | Bút toán / việc làm | Khoá |
  |---|---|---|
  | `Reserve` | `budget → reserved:{req}` | `reservation:{req}:reserve` |
  | `PostDisbursement` | `reserved → platform_cash` | `reservation:{req}:resolve` |
  | `VoidReservation` | `reserved → budget` | `reservation:{req}:resolve` (cùng khoá với Post) |
  | `HasOutflow` | có `fake_bank` chiều out gắn request không | — |
  | `SetDisbursementStatus` | cập nhật `funds.disbursements` | — |
  | `RecordApproval` | ghi `approval_records`, idempotent theo update ID | update ID |
  | `Publish` | ghi `published_events` | event ID tất định |
  | `OpenReconciliationCase` | mở case | `recon:disbursement:{req}` |

- **Stub**, đăng ký theo tên chuỗi:
  - `operations.MarkReadyToDisburse`, `operations.RejectRequest`, `operations.MarkDisbursed`, `operations.MarkDisbursementFailed` (task queue `operations`);
  - `campaign.AdvancePhase` (task queue `campaign`).

  Mỗi stub ghi một dòng `stub_calls`, idempotent.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestReserve_Insufficient_NonRetryableTyped` | `ApplicationError` non-retryable, type thiếu tiền |
| `TestResolve_PostThenVoid_SecondReturnsConflict` | Void sau Post → lỗi bug; sổ không đổi |
| `TestStubs_CalledTwice_OneRow` | 1 dòng |

**Xong khi:** PASS. **Checkpoint:** "review task 11".

---

### Task 12: Workflow `Disbursement`, đường thuận và Update (2 ngày)

**Học trước:** [thiết kế §7](./2026-10-11-s2-s3-money-flow-design.md#7-saga-disbursement) (sơ đồ) · [Update handlers](https://docs.temporal.io/develop/go/message-passing#updates) · `workflow.AllHandlersFinished`. Pseudo-Go ở [báo cáo Temporal §3.3](./s2-s3-panel/02-temporal.md#33-phác-thảo-workflow-pseudo-go) đặt `SecondApproval` sai chỗ. Thứ tự đúng là theo D-9.

**Mục tiêu:** Saga chạy đúng các đường thuận; mọi Update sai bước, sai người hay trùng lặp đều bị chặn.

**Đã chốt:**
- **Input:** ngưỡng BR-13 (so sánh `>`) và hạn chờ xác nhận được chốt lúc start; hạn tính từ `TransferRecorded`.
- **Sáu Update:** `SecondApproval`, `TransferRecorded`, `ReceiptConfirmed`, `ReceiptDisputed`, `AdminResolved`, `Cancel`. Mọi payload có `Actor`.
- **Luật validator:**

  | Update | Chấp nhận khi |
  |---|---|
  | `SecondApproval` | đang chờ duyệt lần hai, và người duyệt ≠ người duyệt request |
  | `TransferRecorded` | đang chờ chuyển tiền, và số tiền = số đã duyệt |
  | `ReceiptConfirmed` | đang chờ xác nhận; hoặc đang đối soát mà chưa ghi xác nhận nào (D-7) |
  | `ReceiptDisputed` | đang chờ xác nhận |
  | `Cancel` | trước pivot |
  | `AdminResolved` | đang đối soát (luật chi tiết ở Task 13) |

- Handler ghi `approval_records` (update ID lấy từ `GetUpdateInfo`) trước khi trả kết quả.
- Activity sau pivot không đặt `ScheduleToStartTimeout`.

**Bạn tự thiết kế:** mô hình state (các pha); cách đăng ký handler; cấu trúc file.

**Test** (testsuite với thời gian ảo; activity Funds và stub chạy **thật** trên PG; audit sau mỗi test):

| Tên | Đạt khi |
|---|---|
| `TestDisbursement_BelowThreshold_HappyPath` (E1) | stub gọi theo thứ tự MarkReady → MarkDisbursed → AdvancePhase; DISBURSED; `reserved` về 0; có event Completed |
| `TestDisbursement_AboveThreshold_NoMarkReadyBeforeSecondApproval` (E1, D-9) | chưa có MarkReady trước SecondApproval |
| `TestDisbursement_SameAdminSecondApproval_Rejected` (E7) | bị từ chối; admin khác thì đi tiếp |
| `TestDisbursement_ReceiptBeforeTransfer_Rejected` (E2) | bị từ chối; không có post |
| `TestDisbursement_DuplicateTransferRecorded_Rejected` (E3) | 1 post |
| `TestDisbursement_TransferAmountMismatch_Rejected` | bị từ chối |
| `TestDisbursement_Insufficient_RejectsRequest` | RejectRequest, không MarkReady, REJECTED |

**Bẫy:**
- Đăng ký handler sau activity đầu tiên.
- Handler đổi state **sau** lời gọi chặn đầu tiên.
- Validator có tác dụng phụ.
- Kết thúc workflow khi còn handler đang chạy.
- Quên ghi `fake_bank` out cho saga có tiền thật rời đi.

**Xong khi:** PASS. **Checkpoint:** "review task 12".

---

### Task 13: Hết hạn, đối soát, huỷ và luật "một kết cục" (1,5 ngày)

**Học trước:** [thiết kế D-5, D-7](./2026-10-11-s2-s3-money-flow-design.md#2-quyết-định-đã-chốt-trong-phiên-thiết-kế) · `workflow.AwaitWithTimeout` · [báo cáo kiểm thử E4, E9, E10](./s2-s3-panel/03-adversarial-tests.md#nhóm-e--saga-giải-ngân-và-tín-hiệu-q6).

**Mục tiêu:** Sau pivot, saga không bao giờ tự void; void chỉ xảy ra khi đủ điều kiện, và mỗi request chỉ có một kết cục.

**Đã chốt:**
- **`AdminResolved(Transferred)`** → đi tiếp như đường thuận.
- **`AdminResolved(NotTransferred)`:**
  - Đã có tiền ra gắn với request → handler trả **lỗi**, case vẫn mở.
  - Vượt ngưỡng → cần hai admin khác nhau.
  - Đủ điều kiện → Void → MarkDisbursementFailed → Publish Failed → FAILED.
- **`Cancel` trước pivot** → Void → RejectRequest → CANCELLED.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestDisbursement_ReceiptTimeout_OpensCase_ThenTransferred` (E9) | case mở; DISBURSED |
| `TestDisbursement_ReceiptTimeout_ThenNotTransferred_Voids` (E9) | FAILED; có void, không có post |
| `TestDisbursement_Disputed_OpensCase` (E9) | hai nhánh resolve |
| `TestDisbursement_LateReceiptAfterCase_StillNeedsAdmin` (E4) | nhận làm bằng chứng; vẫn chờ AdminResolved |
| `TestDisbursement_NotTransferredWithOutflow_Refused` (E10) | handler trả lỗi; không void; I5 = 0 lệch |
| `TestDisbursement_NotTransferredAboveThreshold_NeedsTwoAdmins` (D-5) | cùng admin hai lần → chưa void |
| `TestDisbursement_CancelBeforePivot_Voids` / `…CancelAfterPivot_Rejected` | đúng như tên |
| `TestDisbursement_AdminResolvedTwice_SecondRejected` (E9) | bị từ chối |

**Phải FAIL:** tạm bỏ bước kiểm tra tiền ra (sửa tại chỗ, không commit) → E10 FAIL, và audit I5 báo lệch đúng số tiền.

**Bẫy:** "bị validator từ chối" và "handler trả lỗi" đi vào hai callback khác nhau.

**Xong khi:** PASS, naive FAIL. **Checkpoint:** "review task 13".

---

### Task 14: Saga trên dev server, replay và `GetVersion` (2 ngày)

**Học trước:** [Go versioning (patching)](https://docs.temporal.io/develop/go/versioning) · [Replay testing](https://docs.temporal.io/develop/go/testing-suite#replay) · [báo cáo Temporal §3.4–3.5](./s2-s3-panel/02-temporal.md#34-kiểm-thử).

**Mục tiêu:** Chứng minh Q5 cho saga trên server thật, và chứng minh replay test bắt được thay đổi phá tính tất định.

**Test:**

| Tên | Đạt khi |
|---|---|
| `TestSagaRetry_ReserveWorkerDiesAfterCommit` | 1 entry; giữ tiền chạy lại **không** báo thiếu tiền; DISBURSED |
| `TestSagaRetry_PostDisbursementWorkerDiesAfterCommit` | 1 entry; DISBURSED |
| `TestCaptureHistories` | chỉ chạy khi bật cờ; ghi history JSON của (a) đường thuận và (b) hết hạn → NotTransferred |
| `TestReplay_Histories` | replay mọi file → PASS |

**Bằng chứng đỏ/xanh (E16)**, mỗi bước một commit:
- [ ] A: đã ghi history, replay xanh.
- [ ] B: đổi thứ tự `MarkDisbursed` và `AdvancePhase`, không bọc gì → replay **đỏ**.
- [ ] C: bọc thay đổi bằng `GetVersion` → replay **xanh** với history cũ.
- [ ] `workflowcheck` trên `workflows/` không có vi phạm.

**Bẫy:** ghi lại history sau khi đã sửa workflow thì phép thử đỏ/xanh mất ý nghĩa.

**Xong khi:** đủ bằng chứng. **Checkpoint:** "review task 14".

---

# Giai đoạn D — Cổng Q1–Q6

### Task 15: Kết luận Q1–Q6 (0,5 ngày)

- [ ] Bản nháp kết quả có kết luận đạt/trượt cho Q1–Q6, kèm lệnh, output và các lần naive FAIL.
- [ ] Ghi các mục *(unverified)* của ba báo cáo panel nay đã được xác nhận hay bác bỏ: sqlc với PG18, `unnest` nhiều mảng, pgx giữ kết nối sau COMMIT lỗi, thứ tự khoá `FOR UPDATE … ORDER BY`, Update trên server 1.32, xoá execution.
- [ ] Cùng mentor quyết: các quyết định kiến trúc đang chờ (ADR-001, ADR-003) có mở khoá được chưa.
- [ ] Commit.

---

# Giai đoạn E — Funds API và deploy lên kind

### Task 16: Funds API theo OpenAPI (2 ngày)

**Học trước:** [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3) · [thiết kế bổ sung §4.1](./2026-10-15-s2-s3-money-flow-skills-addendum.md#41-funds-api) · `client.UpdateWorkflow` và các kiểu lỗi của nó · [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) (tham khảo cho body lỗi).

**Mục tiêu:** Viết đặc tả **trước**, rồi viết API theo đúng đặc tả.

**Đã chốt:**
- Năm endpoint và bảng ánh xạ HTTP ở thiết kế bổ sung §4.1.
- `Idempotency-Key` là `UpdateID`. Actor đi trong body.
- Chạy chung tiến trình với webhook.

**Bạn tự thiết kế:** schema request/response, định dạng lỗi, cấu hình (ngưỡng, hạn chờ) đọc từ đâu.

- [ ] Viết `api/openapi.yaml` và lint bằng một công cụ bạn tự chọn. Mentor review đặc tả **trước** khi bạn code.
- [ ] Viết API; test Go cho bảng ánh xạ HTTP (mỗi dòng một test, chạy trên dev server).
- [ ] Đi hết một saga bằng `curl` trên máy local. Lưu lệnh vào `NOTES.md`.

**Bẫy:**
- Phân biệt "validator từ chối" và "handler trả lỗi" ở phía client.
- Update tới workflow đã đóng.
- Hết thời gian chờ Update.

**Xong khi:** mọi dòng của bảng ánh xạ có test xanh. **Checkpoint:** "review task 16".

---

### Task 17: Container hoá và deploy lên kind (2 ngày)

**Học trước:**
- [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) và multi-stage build.
- [kind: loading an image](https://kind.sigs.k8s.io/docs/user/quick-start/#loading-an-image-into-your-cluster).
- [CNPG declarative role management](https://cloudnative-pg.io/docs/1.30/declarative_role_management/) và [bootstrap](https://cloudnative-pg.io/docs/1.30/bootstrap/).
- Kubernetes: [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), [Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/), [Secret](https://kubernetes.io/docs/concepts/configuration/secret/), [probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/), [resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/), [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/), [Kustomize](https://kubectl.docs.kubernetes.io/references/kustomize/).
- Gateway API `HTTPRoute`.
- Cấu hình cluster từ S-9: [`s4-config/`](./s4-config/).

**Mục tiêu:** Dựng toàn bộ phần ứng dụng của spike lên cluster `foodfund` bằng một lệnh.

**Đã chốt** (thiết kế bổ sung §4.2):
- CNPG cluster riêng cho `funds`, role qua `managed.roles` (gồm `funds_qa` chỉ SELECT). **Không** dùng user `app` mặc định.
- Migration chạy bằng `Job`.
- Hai Deployment (webhook + API; worker).
- Namespace Temporal `moneyflow` có retention.
- HTTPRoute qua Traefik; Secret; probe; requests/limits; NetworkPolicy.
- Manifest viết tay, kustomize được phép, **không** Helm.

**Bạn tự thiết kế:** cấu trúc `deploy/`; thứ tự dựng và cách chờ theo điều kiện; probe kiểm cái gì; mức requests/limits (đo trước rồi mới đặt).

- [ ] Dựng từ đầu bằng một lệnh; ghi thời gian dựng và RAM tăng thêm (cách đo như S-4).
- [ ] Đi hết một saga và một webhook qua Traefik bằng `curl`.
- [ ] Chạy `ledger_audit.sql` trên DB của cluster → sạch.
- [ ] Xoá namespace rồi dựng lại → vẫn chạy.
- [ ] Commit.

**Bẫy:**
- Cache file của WSL (S-4).
- Image tag `latest` khi nạp vào kind.
- Migration Job chạy lại.
- Thứ tự sẵn sàng giữa DB, migration và app.
- Mật khẩu hay khoá HMAC lọt vào git.

**Xong khi:** đủ checklist. **Checkpoint:** "review task 17".

### 🚦 Cổng E

- [ ] Ghi kết quả deploy (thời gian, RAM, vướng mắc) vào bản nháp. Cùng mentor quyết đi tiếp.

---

# Giai đoạn F — Bộ test API bằng Python

### Task 18: Nền tảng bộ test (2 ngày)

**Học trước:**
- [uv projects](https://docs.astral.sh/uv/guides/projects/).
- [pytest](https://docs.pytest.org/en/stable/getting-started.html): fixture, scope, `conftest.py`, parametrize, marker.
- [httpx](https://www.python-httpx.org/).
- [psycopg 3](https://www.psycopg.org/psycopg3/docs/basic/usage.html).
- [schemathesis](https://schemathesis.readthedocs.io/).

**Mục tiêu:** Một dự án Python độc lập trong `apitests/`, chạy bằng `uv run pytest` vào hệ thống trên kind.

**Đã chốt:**
- Kiểm DB bằng `funds_qa` (chỉ đọc).
- `ledger_audit.sql` chạy sau mỗi test, dùng **chính file** của Task 4, không chép lại.
- Mỗi test tự tạo dữ liệu riêng.

**Bạn tự thiết kế:** cấu hình địa chỉ và khoá (môi trường); fixture (client, kết nối DB, nạp tiền, ký webhook); cách nạp tiền qua đường hợp lệ để I5 vẫn đúng; cấu trúc thư mục.

**Test:**

| Nhóm | Đạt khi |
|---|---|
| `test_contract_*` | mọi response trong các test chức năng khớp `openapi.yaml` |
| schemathesis trên toàn bộ đặc tả | không có lỗi 5xx nào chưa được ghi lại |
| `test_webhook_matched_posts_donation`, `test_webhook_unmatched_goes_to_suspense` | trạng thái DB đúng; audit sạch |

**Bẫy:**
- Dữ liệu sinh ngẫu nhiên của schemathesis chạm vào tiền thật trong sổ.
- Thứ tự chạy test.
- Kết nối DB từ máy vào cluster.

**Xong khi:** chạy được bằng một lệnh, xanh. **Checkpoint:** "review task 18".

---

### Task 19: Test chức năng, âm và đồng thời (2 ngày)

**Mục tiêu:** Phủ các nhóm ở thiết kế bổ sung §5, từ bên ngoài vào.

**Test** (tên gợi ý; bạn được thêm):

| Tên | Đạt khi |
|---|---|
| `test_saga_below_threshold_happy_path` / `test_saga_above_threshold_needs_second_admin` | DISBURSED; sổ cái đúng |
| `test_saga_timeout_then_not_transferred_fails` | FAILED; có void |
| `test_same_idempotency_key_returns_same_result` | không ghi thêm |
| `test_action_out_of_order_is_409` · `test_same_admin_second_approval_is_409` · `test_not_transferred_with_outflow_is_422` | đúng mã HTTP; sổ không đổi |
| `test_missing_idempotency_key_is_400` · `test_malformed_body_is_400` | đúng mã HTTP |
| `test_double_click_concurrent_same_key` | hai request đồng thời cùng khoá → một hiệu lực |
| `test_webhook_burst_same_txn` | 20 webhook song song → 1 entry |

**Phải FAIL:** ít nhất một test đỏ khi tắt một cơ chế bảo vệ trên cluster. Bạn tự chọn cơ chế và cách tắt tạm, và ghi lại.

**Xong khi:** xanh; có bằng chứng phải-FAIL. **Checkpoint:** "review task 19".

### 🚦 Cổng F

- [ ] Ghi kết quả. Cùng mentor quyết đi tiếp.

---

# Giai đoạn G — Pen test

> **Luật phạm vi (D-21):** chỉ nhắm vào cluster kind trên laptop. Không quét hay gửi gì tới địa chỉ bên ngoài.
> Plan **cố ý không liệt kê lỗ hổng** (D-23).

### Task 20: Threat model và do thám (1 ngày)

**Học trước:** [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) · [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) · [STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) · [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html).

**Mục tiêu:** Biết hệ thống có gì để tấn công trước khi tấn công.

- [ ] Sơ đồ luồng dữ liệu, có ranh giới tin cậy (internet → Traefik → webhook/API → Temporal → DB).
- [ ] Bảng STRIDE theo từng thành phần và từng luồng.
- [ ] Do thám: những gì lộ ra ngoài cluster; những gì gọi được từ bên trong một pod bất kỳ.
- [ ] Danh sách giả thuyết tấn công, xếp theo hậu quả với tiền.

**Xong khi:** mentor duyệt threat model. **Checkpoint:** "review task 20".

---

### Task 21: Tấn công và báo cáo (2 ngày)

**Học trước:** [ZAP API scan](https://www.zaproxy.org/docs/docker/api-scan/) · [kubescape](https://kubescape.io/docs/) · [CVSS 4.0 calculator](https://www.first.org/cvss/calculator/4.0).

**Mục tiêu:** Tấn công năm bề mặt (webhook · Funds API · database · Temporal · Kubernetes) và báo cáo kết quả.

- [ ] Cài ZAP và kubescape.
- [ ] Chạy ZAP API scan theo `openapi.yaml`; chạy kubescape trên namespace của spike.
- [ ] Viết script tấn công Python trong `apitests/attacks/` cho từng giả thuyết.
- [ ] Viết báo cáo `docs/spikes/<ngày>-money-flow-pentest.md`. Mỗi lỗ hổng có: cách tái hiện (lệnh/script), vector CVSS 4.0, hậu quả với tiền, cách sửa. Ghi cả giả thuyết **không** thành công, kèm lý do.

**Bẫy:** coi kết quả của máy quét là lỗ hổng mà chưa tự kiểm chứng.

**Xong khi:** nộp báo cáo. Mentor so với đáp án ẩn và ghi tỉ lệ tìm được. **Checkpoint:** "review task 21".

---

### Task 22: Sửa và test hồi quy (1 ngày)

- [ ] Sửa mọi lỗ hổng mức Cao trở lên.
- [ ] Mỗi bản sửa có test hồi quy trong `apitests/`: đỏ trước khi sửa, xanh sau khi sửa.
- [ ] Mức thấp hơn: ghi thành rủi ro đã biết, kèm hướng xử lý khi dựng Funds thật (ví dụ việc nào cần Keycloak).
- [ ] Commit.

**Checkpoint:** "review task 22".

### 🚦 Cổng G

- [ ] Ghi kết quả. Cùng mentor quyết đi tiếp.

---

# Giai đoạn H — Hiệu năng

> Plan **cố ý không liệt kê nút thắt** (D-23).

### Task 23: Quan sát được hệ thống (1 ngày)

**Học trước:**
- [OpenTelemetry Go](https://opentelemetry.io/docs/languages/go/).
- Interceptor OpenTelemetry của Temporal Go SDK (`go.temporal.io/sdk/contrib/opentelemetry`).
- [Grafana Alloy](https://grafana.com/docs/alloy/latest/).
- [pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html).
- [Temporal metrics](https://docs.temporal.io/references/sdk-metrics).

**Mục tiêu:** Nhìn được một request đi qua webhook/API → Temporal → activity → DB trên Grafana Cloud.

- [ ] Tạo tài khoản Grafana Cloud bản miễn phí. Dự phòng: Prometheus local.
- [ ] Instrument HTTP, Temporal client/worker, truy vấn DB.
- [ ] Deploy Alloy lên kind; thấy trace và metrics trên Grafana.
- [ ] Bật `pg_stat_statements` trên cluster CNPG của `funds`.
- [ ] Tắt tạm Keycloak (`replicas: 0`); ghi RAM trước và sau.

**Xong khi:** thấy được một trace đầy đủ cho một saga. **Checkpoint:** "review task 23".

---

### Task 24: SLO, mốc ban đầu và thí nghiệm coordinated omission (1 ngày)

**Học trước:** [k6 scenarios và executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/) · [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) · module `k6/crypto` (`hmac`) · [open vs closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/).

**Mục tiêu:** Có SLO đã duyệt, một mốc đo ban đầu, và tự thấy được coordinated omission.

- [ ] Cài k6.
- [ ] Viết SLO (độ trễ, tỉ lệ lỗi, thông lượng) cho webhook và cho Funds API. Mentor review **trước** khi đo.
- [ ] Script k6 trong `perf/`, SLO viết bằng `thresholds`.
- [ ] Đo mốc ban đầu ở tải thấp.
- [ ] Thí nghiệm: cùng một mức tải, chạy kiểu "chờ phản hồi" và kiểu `constant-arrival-rate`, so hai số p95. Ghi lại giải thích của bạn.

**Bẫy:** máy tạo tải tranh CPU với cluster; dữ liệu do lần đo trước để lại; thời gian khởi động (warm-up).

**Xong khi:** có mốc ban đầu và kết quả thí nghiệm. **Checkpoint:** "review task 24".

---

### Task 25: Tìm nút thắt và cải thiện khả năng mở rộng (1,5 ngày)

**Mục tiêu:** Tìm được nút thắt bằng bằng chứng, và chứng minh một cải thiện bằng số đo.

- [ ] Tăng tải từng bậc (`ramping-arrival-rate`) tới khi vượt SLO; ghi điểm gãy.
- [ ] Với mỗi nút thắt nghi ngờ: giả thuyết → bằng chứng (trace, `pg_stat_statements`, metrics Temporal, CPU bị giới hạn) → đổi **một** thứ → đo lại.
- [ ] Ít nhất **một** cải thiện khả năng mở rộng, có số đo trước và sau, và giải thích vì sao nó hiệu quả.
- [ ] Chạy lại bộ test API sau mỗi thay đổi, để chắc tối ưu không làm sai tiền.

**Bẫy:** đổi nhiều thứ cùng lúc; kết luận từ một lần chạy; tối ưu làm hỏng bất biến sổ cái.

**Xong khi:** có chuỗi giả thuyết–bằng chứng–kết quả. **Checkpoint:** "review task 25".

---

### Task 26: Đo Q7 và viết báo cáo hiệu năng (0,5 ngày)

- [ ] Đo theo [báo cáo Temporal §4.3](./s2-s3-panel/02-temporal.md#43-spike-cần-đo-gì--nửa-ngày): độ trễ "ghi sổ rồi phát event" so với transaction thường; số event history mỗi thao tác; hành vi khi Temporal ngừng; số dòng boilerplate.
- [ ] Viết báo cáo `docs/spikes/<ngày>-money-flow-performance.md`: SLO, các bậc tải, nút thắt kèm bằng chứng, thay đổi và số đo trước/sau, kết quả Q7, hạn chế của phép đo.

**Xong khi:** nộp báo cáo. Mentor so với đáp án ẩn. **Checkpoint:** "review task 26".

### 🚦 Cổng H

- [ ] Ghi kết quả. Cùng mentor quyết sang giai đoạn I.

---

# Giai đoạn I — Kết thúc

### Task 27: Báo cáo cuối và gom phần giữ lại (1 ngày)

- [ ] Hoàn thiện `docs/spikes/<ngày hoàn thành>-s2-s3-money-flow.md`: Q1–Q7, liên kết tới báo cáo pen test và hiệu năng, mục nào chưa làm thì ghi rõ là **chưa kiểm**.
- [ ] Mục **"AI trong kiểm thử"**, tổng hợp từ các file nhật ký: chỗ có ích, chỗ sai, cách kiểm chứng, khi nào nên và không nên dùng.
- [ ] Danh sách phần giữ lại: thiết kế §10 và thiết kế bổ sung §9.
- [ ] Cùng mentor rà bảng "Cập nhật tài liệu" ở [thiết kế §10](./2026-10-11-s2-s3-money-flow-design.md#10-đầu-ra), tách thành các commit riêng.
- [ ] Commit.

**Checkpoint:** "review task 27".

---

## Phụ lục — Việc P1 (chỉ làm nếu còn thời gian)

Theo [thiết kế §8.3](./2026-10-11-s2-s3-money-flow-design.md#83-kịch-bản-p1-nếu-còn-thời-gian):
- A8 số tiền biên/tràn
- B3 deadlock theo thứ tự khoá
- D5 event ID tất định
- D6 publish lỗi sau khi ghi sổ không được bù trừ
- E5 Update tới workflow đã đóng
- E6 Update đúng biên hạn chót
- E8 gửi signal vòng qua Funds bằng CLI
- E14 worker chết giữa saga
- E15 dev server khởi động lại giữa saga
- E17 khởi động lại `disbursement-{req}` sau FAILED
- E19 số tiền chuyển khác số duyệt → case
