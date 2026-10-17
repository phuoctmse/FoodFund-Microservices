# Spike luồng tiền — Tư liệu nghiên cứu

- **Nguồn:** gộp và cắt gọn từ ba báo cáo của nhóm chuyên gia (2026-10-11): PostgreSQL/sổ cái, Temporal, kiểm thử đối kháng. Bản gốc đầy đủ vẫn còn trong git: `git show b4b266e:docs/spikes/s2-s3-panel/01-ledger-postgres.md` (tương tự `02-temporal.md`, `03-adversarial-tests.md`).
- **Đã bỏ:** phần đã chốt thành quyết định ở [thiết kế](./design.md) (so sánh mô hình, throwaway hay skeleton, YAGNI), các bảng khoá chống trùng đã cũ, và các gap đã xử lý (còn bảng đối chiếu ở §3.4).
- **Khi khác thiết kế, thiết kế thắng.** Báo cáo viết trước khi chốt D-1…D-13, nên một số chỗ đã cũ (khoá chống trùng, tài khoản `disbursed`, mô hình postings). Mỗi chỗ như vậy có ghi chú.
- **Ký hiệu:** **[V]** = đã kiểm chứng trong tài liệu chính thức hoặc source (có URL) · **[S]** = suy luận từ tài liệu/source, spike phải xác nhận · *(chưa kiểm chứng)*.

---

## 1. Sổ cái PostgreSQL (Q1, Q2, Q3)

Phiên bản đối chiếu: PostgreSQL 18 docs, pgx **v5.11.0** (tag 2026-09-07, [tags](https://github.com/jackc/pgx/tags)), sqlc **v1.31.1** (2026-04-22, [releases](https://github.com/sqlc-dev/sqlc/releases)).

### 1.1 Vì sao chọn mô hình này

- **Transfer hai chân (D-1):** mỗi dòng `transfers` tự cân bằng nhờ `CHECK (amount > 0)` và `CHECK (debit <> credit)`, nên Go không thể biểu diễn một bút toán lệch. Bút toán phức (1 nợ, N có) là N transfer cùng `entry_id`. Sao kê công khai (FR-TRN-01) đọc thẳng "từ → đến". Nếu sau này cần mô hình postings (`amount` có dấu, tổng = 0), chuyển T → P là migration cơ học: mỗi transfer tách thành hai posting.
- **Tài khoản giữ tiền thay cho pending kiểu TigerBeetle (D-10):** Reserve, giải ngân và huỷ đều là bút toán đã ghi sổ; "pending" là số dư của `reserved:{req}`. Pending có hạn trong DB thì số dư tự đổi mà không có lần ghi nào, không tái lập được, và mâu thuẫn với "không tự hoàn" ở `02` §7.3. TigerBeetle cho phép post một phần ([two-phase transfers](https://docs.tigerbeetle.com/coding/two-phase-transfers/)) [V]; spike cấm (§5.3 thiết kế). VA hết hạn (FR-PAY-05) không cần pending trong sổ cái vì chưa có tiền nào vào.
- **Số dư = `SUM` thuần, chưa có bảng cache:** đúng nguyên văn FR-LED-02 và giữ được quyền chỉ INSERT. Cache dựng lại được từ `transfers`, nên thêm sau vẫn dễ.

### 1.2 Phác thảo DDL

Mô hình T (transfer hai chân) + A (tài khoản giữ tiền). Từ giai đoạn E có thêm role `funds_qa` (chỉ `SELECT`).

```sql
-- ===== Role (bootstrap, chạy bằng superuser / CNPG managed roles) =====
CREATE ROLE funds_owner NOLOGIN;                         -- sở hữu schema/bảng/hàm
CREATE ROLE funds_migrator LOGIN IN ROLE funds_owner;    -- goose: SET ROLE funds_owner
CREATE ROLE funds_app LOGIN;                             -- service; KHÔNG là member của owner
REVOKE CONNECT, TEMPORARY ON DATABASE funds FROM PUBLIC; -- mặc định PUBLIC có CONNECT (ý của T-6: không vào DB service khác)
GRANT CONNECT ON DATABASE funds TO funds_app, funds_migrator;

CREATE SCHEMA ledger AUTHORIZATION funds_owner;
REVOKE ALL ON SCHEMA ledger FROM PUBLIC;
GRANT USAGE ON SCHEMA ledger TO funds_app;               -- không có CREATE
ALTER DEFAULT PRIVILEGES FOR ROLE funds_owner IN SCHEMA ledger REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE funds_owner IN SCHEMA ledger REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE funds_owner IN SCHEMA ledger GRANT SELECT, INSERT ON TABLES TO funds_app;

-- ===== Bảng (chạy bằng funds_owner) =====
CREATE TABLE ledger.accounts (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  code           text NOT NULL UNIQUE,                  -- 'budget:{phase}:{category}', 'reserved:{request}'...
  normal_side    char(1) NOT NULL CHECK (normal_side IN ('D','C')),
  allow_negative boolean NOT NULL DEFAULT false,        -- tương đương flag *_must_not_exceed_* của TigerBeetle
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger.journal_entries (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  idempotency_key text NOT NULL UNIQUE,                 -- xem 1.3
  request_hash    bytea NOT NULL,                       -- sha256(nội dung chuẩn hoá), phát hiện dùng lại key với nội dung khác
  kind            text NOT NULL,                        -- donation|allocate|reserve|post|void|refund|adjust|...
  transfer_count  smallint NOT NULL CHECK (transfer_count BETWEEN 1 AND 64),
  ref_type        text NOT NULL, ref_id text NOT NULL,  -- tham chiếu nghiệp vụ (FR-LED-01)
  actor           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()    -- thời điểm nghiệp vụ; KHÔNG suy từ uuidv7
);

CREATE TABLE ledger.transfers (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  entry_id          uuid   NOT NULL REFERENCES ledger.journal_entries(id),  -- không CASCADE
  debit_account_id  uuid   NOT NULL REFERENCES ledger.accounts(id),
  credit_account_id uuid   NOT NULL REFERENCES ledger.accounts(id),
  amount            bigint NOT NULL CHECK (amount > 0),                      -- VND
  CHECK (debit_account_id <> credit_account_id)
);
CREATE INDEX ON ledger.transfers (debit_account_id)  INCLUDE (amount);
CREATE INDEX ON ledger.transfers (credit_account_id) INCLUDE (amount);
CREATE INDEX ON ledger.transfers (entry_id);

-- Số dư theo phía thông thường của tài khoản (dương = bình thường)
CREATE VIEW ledger.account_balances AS
SELECT a.id, a.code,
       CASE a.normal_side WHEN 'C' THEN c.s - d.s ELSE d.s - c.s END AS balance
FROM ledger.accounts a
CROSS JOIN LATERAL (SELECT COALESCE(sum(amount),0) s FROM ledger.transfers WHERE credit_account_id = a.id) c
CROSS JOIN LATERAL (SELECT COALESCE(sum(amount),0) s FROM ledger.transfers WHERE debit_account_id  = a.id) d;
```

Trigger hoãn (lý do ở §1.4 và §1.6):

```sql
CREATE FUNCTION ledger.check_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ledger, pg_catalog, pg_temp AS $$
DECLARE
  v_entry uuid; v_expected int; v_actual int; r record;
BEGIN
  -- IF thay vì CASE: tránh truy cập NEW.entry_id khi NEW là dòng journal_entries
  IF TG_TABLE_NAME = 'transfers' THEN v_entry := NEW.entry_id; ELSE v_entry := NEW.id; END IF;

  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION 'ledger writes must run in READ COMMITTED'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_isolation';
  END IF;

  SELECT transfer_count INTO v_expected FROM journal_entries WHERE id = v_entry;
  SELECT count(*)       INTO v_actual   FROM transfers       WHERE entry_id = v_entry;
  IF v_actual IS DISTINCT FROM v_expected THEN   -- chặn entry rỗng, thiếu chân, và thêm chân vào entry cũ
    RAISE EXCEPTION 'entry % has % transfers, declared %', v_entry, v_actual, v_expected
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_entry_complete';
  END IF;

  -- Khoá theo thứ tự id mọi tài khoản bị cấm âm mà entry chạm tới (Q3)
  PERFORM 1 FROM accounts a
   WHERE NOT a.allow_negative
     AND a.id IN (SELECT debit_account_id  FROM transfers WHERE entry_id = v_entry
                  UNION SELECT credit_account_id FROM transfers WHERE entry_id = v_entry)
   ORDER BY a.id FOR UPDATE;

  -- Câu lệnh mới → snapshot mới (READ COMMITTED + hàm VOLATILE) → thấy transfer đã commit của transaction vừa nhả khoá
  FOR r IN SELECT b.code, b.balance FROM account_balances b JOIN accounts a USING (id)
            WHERE NOT a.allow_negative
              AND b.id IN (SELECT debit_account_id  FROM transfers WHERE entry_id = v_entry
                           UNION SELECT credit_account_id FROM transfers WHERE entry_id = v_entry)
  LOOP
    IF r.balance < 0 THEN
      RAISE EXCEPTION 'account % would go negative (%)', r.code, r.balance
        USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_account_nonnegative';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION ledger.check_entry() FROM PUBLIC;

CREATE CONSTRAINT TRIGGER transfers_check AFTER INSERT ON ledger.transfers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.check_entry();
CREATE CONSTRAINT TRIGGER entries_check AFTER INSERT ON ledger.journal_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.check_entry();

-- Lưới an toàn cho sai sót của owner/migration (app vốn đã không có quyền)
CREATE FUNCTION ledger.forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ledger is append-only' USING ERRCODE = 'insufficient_privilege'; END $$;
CREATE TRIGGER transfers_no_upd_del BEFORE UPDATE OR DELETE ON ledger.transfers
  FOR EACH ROW EXECUTE FUNCTION ledger.forbid_mutation();
CREATE TRIGGER transfers_no_truncate BEFORE TRUNCATE ON ledger.transfers
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.forbid_mutation();
-- (lặp lại cho journal_entries, accounts)
ALTER TABLE ledger.transfers ENABLE ALWAYS TRIGGER transfers_check;  -- vẫn bắn khi session_replication_role=replica
```

Ghi chú:
- `ENABLE ALWAYS`: trigger ở trạng thái thường **không bắn** khi `session_replication_role = replica`; trigger `ENABLE ALWAYS` thì bắn bất kể giá trị đó [V] ([ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)). CNPG dùng physical replication nên đặt `ENABLE ALWAYS` không có tác dụng phụ.
- Mỗi entry trigger chạy N+1 lần (mỗi chân một lần, cộng một lần cho entry), phần lớn là lặp. **Không tối ưu trong spike.**
- Bút toán và khoá chống trùng của từng thao tác: xem [thiết kế §5.3](./design.md#53-bút-toán). Bảng trong báo cáo gốc dùng tài khoản `disbursed:{c}` đã bị bỏ (D-3).

### 1.3 Ghi idempotent và `uuidv7()`

- **`UNIQUE (journal_entries.idempotency_key)`.** Key suy ra từ **danh tính nghiệp vụ** (mã giao dịch của nhà cung cấp, requestId + bước), không lấy từ attempt của activity hay `RunID` (RunID đổi khi continue-as-new hoặc reset).
- Ghi bằng `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. `DO NOTHING` chỉ cần quyền INSERT (cộng SELECT trên cột conflict target); `DO UPDATE` mới cần quyền UPDATE [V] ([INSERT](https://www.postgresql.org/docs/18/sql-insert.html)). Dòng bị bỏ qua **không được trả về** [V] → sqlc `:one` trả `pgx.ErrNoRows` → khi đó `SELECT` entry hiện có và **so `request_hash`**: trùng thì trả kết quả cũ; khác thì báo `ErrIdempotencyConflict`, vì đây là bug chứ không phải retry.
- Hai lần gửi đồng thời cùng key: lần thứ hai chờ ở unique index cho tới khi lần thứ nhất kết thúc. Nếu lần thứ nhất bị rollback (ví dụ trigger hoãn từ chối) thì lần thứ hai được insert. Đây là hành vi mong muốn **[S]**.
- Reserve bị từ chối vì thiếu ngân sách thì **không để lại** key (đã rollback). Gọi lại sẽ đánh giá lại; chấp nhận được vì Temporal đã ghi kết quả "thiếu" vào history nên không gọi lại.
- `provider_events`: `UNIQUE (provider, provider_txn_id)` (BR-08), thuộc Q4.
- **`uuidv7()`** (PG18) sinh UUID v7 có thứ tự thời gian [V] ([UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)) → B-tree ít phân mảnh. **Không** dùng làm thời điểm nghiệp vụ (docs ghi `uuid_extract_timestamp` "không nhất thiết bằng đúng" thời điểm sinh [V] → giữ cột `created_at`). **Không** dùng làm khoá chống trùng. Tính đơn điệu trong cùng backend: docs không nêu *(chưa kiểm chứng)*; thiết kế không phụ thuộc vào nó.
- **Rủi ro sqlc với `uuidv7()`:** catalog tĩnh của sqlc có thể không biết hàm này *(chưa kiểm chứng)*. Giảm rủi ro: chỉ dùng `uuidv7()` trong `DEFAULT` của DDL, không gọi trong query; nếu vẫn lỗi thì bật database-backed analysis (`database: { uri: … }` hoặc `managed: true`) [V] ([sqlc generate](https://docs.sqlc.dev/en/latest/howto/generate.html)), hoặc thử experiment `analyzerv2` (v1.31.0) [V].

### 1.4 Q1 — Trigger hoãn: cơ chế và cạm bẫy

**Cơ chế** (đã kiểm chứng trên docs PG18, [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)):
- Constraint trigger **bắt buộc** là `AFTER` và `FOR EACH ROW`, trên bảng thường [V].
- **Không dùng được transition table** (`REFERENCING`) cho constraint trigger [V]. Trigger statement-level có transition table thì lại không hoãn được → phương án hoãn duy nhất là **row-level constraint trigger**, chạy lại truy vấn trên entry ở mỗi lần bắn.
- `DEFERRABLE INITIALLY DEFERRED`: trigger bắn ở cuối transaction; `SET CONSTRAINTS` có thể ép bắn sớm [V].
- Điều kiện `WHEN` của constraint trigger được đánh giá **ngay lúc ghi**, không hoãn [V] → **không dùng `WHEN`**.
- `CREATE OR REPLACE` không áp dụng được cho constraint trigger [V] → migration phải `DROP TRIGGER` rồi `CREATE`.
- Trạng thái enable của trigger hoãn được xét **lúc sự kiện xảy ra**, không phải lúc hàm chạy [V] ([ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)).

**Với mô hình transfer, trigger kiểm gì:**

| Bất biến | Ở đâu | Vì sao cần hoãn |
|---|---|---|
| Mỗi transfer tự cân | `CHECK` (ngay lập tức) | Không cần hoãn |
| Entry có đủ `transfer_count` chân (không rỗng, không thiếu, không bị thêm chân vào entry cũ ở transaction sau) | Trigger hoãn trên cả `journal_entries` và `transfers` | Các chân được insert bằng nhiều câu lệnh |
| Tài khoản bị cấm âm không âm (kèm khoá, §1.6) | Trigger hoãn | Trạng thái trung gian trong transaction được phép lệch; chỉ trạng thái cuối mới đáng kể |

**Cạm bẫy:**

| Cạm bẫy | Thực tế | Biện pháp |
|---|---|---|
| `SET CONSTRAINTS … IMMEDIATE` | **Không phải đường vòng.** Kiểm tra vẫn chạy, chỉ sớm hơn: ngay lúc `SET` và áp dụng hồi tố; vi phạm thì lệnh `SET` lỗi [V] ([SET CONSTRAINTS](https://www.postgresql.org/docs/18/sql-set-constraints.html)). Rủi ro duy nhất là báo lỗi giả nếu gọi giữa chừng một entry | Code không gọi lệnh này; test ghi lại hành vi |
| `SET CONSTRAINTS ALL DEFERRED` | Không hoãn được qua COMMIT | — |
| `session_replication_role = replica` | Trigger thường không bắn, **FK cũng tắt**. Chỉ superuser hoặc role được cấp quyền `SET` trên tham số này mới đặt được [V] ([runtime-config-client](https://www.postgresql.org/docs/18/runtime-config-client.html)) | App không phải superuser, không cấp `SET`; thêm `ENABLE ALWAYS` |
| `ALTER TABLE … DISABLE TRIGGER` / `DROP TRIGGER` | Phải là **owner** của bảng [V]. Chỉ trigger ràng buộc do hệ thống sinh mới cần superuser; trigger tự tạo bằng `CREATE CONSTRAINT TRIGGER` thì owner tắt được | App ≠ owner (§1.5) |
| Superuser | Vượt được mọi lớp | Ngoài mô hình đe doạ; dựa vào audit/PITR. Service không bao giờ kết nối bằng superuser, kể cả user `postgres` hay `app` mặc định của CNPG |
| `COPY FROM` / batch | Trigger hàng vẫn bắn với COPY *(chưa trích lại — [COPY](https://www.postgresql.org/docs/18/sql-copy.html))* | Không cần xử lý thêm |
| TRUNCATE | Trigger TRUNCATE chỉ có dạng `FOR EACH STATEMENT` [V] | Chỉ GRANT mới chặn được app |
| Hàm `SECURITY DEFINER` | Rủi ro `search_path` | `SET search_path = ledger, pg_catalog, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC` ([Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/18/sql-createfunction.html)) |

Kịch bản test của Q1: nhóm L ở §3.2.

### 1.5 Q2 — role, quyền, lỗi COMMIT và sqlc

**Role và quyền:**

| Role | LOGIN | Sở hữu | Quyền trên `ledger.*` |
|---|---|---|---|
| `funds_owner` | Không | schema, bảng, hàm, trigger | Toàn quyền (vì là owner) |
| `funds_migrator` | Có | — (member của `funds_owner`, goose chạy `SET ROLE`) | Kế thừa từ owner |
| `funds_app` | Có | Không sở hữu gì | `USAGE` trên schema; `SELECT, INSERT` trên `accounts`, `journal_entries`, `transfers`. **Không có** UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |

Lý do:
- Owner luôn được coi là nắm mọi grant option, nên **luôn tự cấp lại được** quyền đã thu hồi; quyền sửa/xoá đối tượng gắn với việc sở hữu, không thu hồi được [V] ([Privileges](https://www.postgresql.org/docs/18/ddl-priv.html)). → `REVOKE UPDATE` trên chính owner là vô nghĩa; **bắt buộc tách owner và app**.
- `TRUNCATE` là quyền riêng, khác `DELETE`; PG17+ có thêm quyền `MAINTAIN` (cho `LOCK TABLE`, VACUUM, …) [V] (cùng URL).
- Không cấp predefined role `pg_write_all_data` hay `pg_maintain` cho `funds_app` [V] ([Predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)).
- `SELECT … FOR UPDATE` đòi **quyền UPDATE trên ít nhất một cột** của bảng bị khoá [V] ([SELECT](https://www.postgresql.org/docs/18/sql-select.html)). Đây là chỗ Q2 va chạm với Q3: app chỉ có INSERT thì **không tự khoá được** dòng `accounts`, nên khoá phải nằm trong trigger `SECURITY DEFINER` của owner (§1.6, D-2).
- `ON CONFLICT DO UPDATE` cần quyền UPDATE [V] → app chỉ dùng được `DO NOTHING`. Ràng buộc có lợi: không ai upsert nhầm vào sổ cái.
- Các bảng nghiệp vụ mutable (`disbursements`, `reconciliation_cases`, …) nằm ở schema `funds`, cấp quyền bình thường. Ranh giới chỉ-INSERT trùng với ranh giới schema `ledger`, nên kiểm tra được theo schema.
- **CloudNativePG:** bootstrap `initdb` mặc định tạo database `app` thuộc **owner `app`** [V] ([CNPG bootstrap](https://cloudnative-pg.io/docs/1.30/bootstrap/)). Service kết nối bằng user này thì nó *là owner* và Q2 mất tác dụng. Role khai báo qua `spec.managed.roles` [V] ([CNPG roles](https://cloudnative-pg.io/docs/1.30/declarative_role_management/)); GRANT trên bảng **không** do operator quản lý (docs không đề cập) → GRANT nằm trong migration goose hoặc `postInitApplicationSQL`.

**Lỗi trigger hoãn đi về Go (pgx v5):**
- `(*dbTx).Commit` chạy `commit`. Server trả lỗi thì **trả nguyên lỗi** đó (`*pgconn.PgError`). Server trả command tag `ROLLBACK` (transaction đã hỏng từ trước) thì trả `pgx.ErrTxCommitRollback` [V] ([tx.go](https://github.com/jackc/pgx/blob/master/tx.go)).
- `PgError` có `Code`, `Message`, `Detail`, `ConstraintName`, `TableName`, `SchemaName`, …; `Error()` có dạng `"ERROR: … (SQLSTATE 23514)"` [V] ([pgconn/errors.go](https://github.com/jackc/pgx/blob/master/pgconn/errors.go)).
- PL/pgSQL cho phép `RAISE … USING ERRCODE = …, CONSTRAINT = …, TABLE = …`. Mặc định là `P0001`; nên tránh SQLSTATE tự đặt kết thúc bằng `000` [V] ([PL/pgSQL errors](https://www.postgresql.org/docs/18/plpgsql-errors-and-messages.html)). Chọn `check_violation` (23514) + `CONSTRAINT` vì thuộc lớp 23 (integrity violation), công cụ chung đều coi là không retry, và Go phân biệt các loại qua `pgErr.ConstraintName`.
- Sau khi COMMIT lỗi, server ở trạng thái idle; pgx chỉ đóng kết nối khi `TxStatus() != 'I'` → kết nối được trả về pool và dùng tiếp **[S]** (suy từ source).
- Bảng phân loại lỗi đã chốt: [thiết kế §5.5](./design.md#55-phân-loại-lỗi).

**sqlc:**
- sqlc **không bọc `Commit`**. Code sinh ra chỉ chạy query qua `DBTX`; transaction là `pgx.Tx` do mình mở rồi gọi `queries.WithTx(tx)` [V] ([sqlc transactions](https://docs.sqlc.dev/en/latest/howto/transactions.html)). Câu hỏi đúng là hàm ghi sổ trong Go có kiểm lỗi của `tx.Commit` hay không. Bật `errcheck` để bắt chỗ quên kiểm.
- `pgx/v5` qua `sql_package: "pgx/v5"` [V] ([sqlc + pgx](https://docs.sqlc.dev/en/latest/guides/using-go-and-pgx.html)). sqlc không thấy trigger, và điều đó không ảnh hưởng gì.
- `ON CONFLICT DO NOTHING RETURNING` với `:one` → `pgx.ErrNoRows` khi trùng (xem §1.3). Phải xử lý tường minh.
- Insert nhiều chân: `:copyfrom` **không hỗ trợ `RETURNING`** ([sqlc#4165](https://github.com/sqlc-dev/sqlc/issues/4165), còn mở). Hướng khác: tham số mảng với `unnest`, hoặc `:batchexec`. Khả năng sqlc suy kiểu đúng cho `unnest` nhiều mảng *(chưa kiểm chứng)*.
- `sum(bigint)` trả về `numeric` [V] ([aggregate functions](https://www.postgresql.org/docs/current/functions-aggregate.html)), nên sqlc có thể sinh `pgtype.Numeric` *(chưa kiểm chứng với sqlc hiện hành)*.
- Rủi ro catalog/parser của sqlc với cú pháp PG18 (`uuidv7()`, `CREATE CONSTRAINT TRIGGER`, thân hàm plpgsql trong file migration goose) *(chưa kiểm chứng)*. Spike chạy `sqlc generate` trên chính các file migration đó.

### 1.6 Q3 — Đồng thời trên một ngân sách

**Vì sao có race:** kịch bản "kiểm tra rồi ghi" (SUM ≥ amount → INSERT) ở READ COMMITTED: hai transaction cùng đọc số dư cũ và cùng ghi → ngân sách âm (write skew). Kiểm tra trong trigger hoãn **mà không khoá** vẫn race: hai lần COMMIT chạy song song, trigger của mỗi bên không thấy dữ liệu chưa commit của bên kia.

| Phương án | DB tự bảo vệ khi Go sai? | Quyền cần | Nhạy với isolation | Retry | Chỉ INSERT | Độ phức tạp |
|---|---|---|---|---|---|---|
| a. `FOR UPDATE` trên `accounts`, đặt trong Go, rồi SUM ở câu lệnh tiếp theo | **Không** — chỉ đúng khi mọi đường ghi đều khoá | UPDATE trên ≥1 cột `accounts` [V] | RC: đúng. **RR: sai** — snapshot cố định từ trước khi chờ khoá; dòng chỉ bị khoá chứ không bị UPDATE nên không có lỗi 40001 **[S]** | Không (deadlock nếu thứ tự khoá lệch) | Giữ được | Thấp |
| **b. `FOR UPDATE` trong trigger hoãn `SECURITY DEFINER`** (đã chọn, D-2) | **Có** — mọi INSERT vào `transfers` đều kích hoạt | Không cần cấp thêm | Như (a); trigger **từ chối RR** để đóng lỗ hổng | Chỉ khi `40P01` (hiếm; khoá theo thứ tự id) | Giữ được | Thấp–trung bình |
| c. `SERIALIZABLE` + retry | Có, nhưng **chỉ giữa các transaction cùng SERIALIZABLE** — một đường ghi RC là đủ để thủng | Không | Phải ép mọi transaction ghi sổ dùng SERIALIZABLE | **Bắt buộc** retry 40001 [V] ([Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)) | Giữ được | Trung bình; khó test tất định |
| d. `pg_advisory_xact_lock(hash(account_id))` | Chỉ khi đặt trong trigger | Không | Như (a) | Như (a) | Giữ được | Thấp; không gắn với dòng thật |
| e. Bảng cache số dư + `CHECK (balance >= 0)` | **Có** — mạnh nhất | Hàm `SECURITY DEFINER` | Ít nhạy hơn | Không | **Lệch FR-LED-02** + bảng mutable | Trung bình; cache phải đối soát. Là phương án dự phòng (thiết kế §11) |

Điều kiện kèm theo (b):
- Ghi sổ ở **READ COMMITTED** (mặc định của PG/pgx); trigger từ chối RR; quy ước **một journal entry cho mỗi transaction** để thứ tự khoá luôn nhất quán.
- Câu lệnh sau khi khoá thấy dữ liệu mới vì hàm `VOLATILE` lấy snapshot mới cho **mỗi câu lệnh** nó chạy [V] ([Function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html)), và ở READ COMMITTED snapshot đó gồm các transaction đã commit [V].
- `FOR UPDATE … ORDER BY` khoá theo đúng thứ tự đã sắp **[S]** (suy từ ghi chú của docs SELECT) → kiểm bằng test deadlock (B3).

**Chi tiết test:**
- `TestReserveNoOverspend` (B1): mỗi vòng tạo tài khoản `budget:X` mới có số dư B = 1.000.000 VND; mỗi `Reserve` lấy 100.000 → sức chứa đúng 10. 50 goroutine, mỗi cái một `requestId`. Pool `MaxConns = 50` đặt tường minh: để mặc định thì pool nhỏ (khoảng max(4, NumCPU) — *chưa trích lại docs pgxpool*), tự tuần tự hoá và test pass "giả". PG `max_connections` ≥ 60. Barrier để mọi goroutine cùng bắt đầu. Khẳng định: đúng 10 thành công, 40 thiếu tiền, 0 lỗi khác; `balance(budget:X) == 0`; `Σ balance(reserved:*) == B`. Lặp 50 vòng với `-race -count=1`.
- Biến thể số tiền ngẫu nhiên trong [1, B/5]: khẳng định `balance ≥ 0` và tổng tiền bảo toàn (không khẳng định số lần thành công).
- **NC-1** (phải FAIL): schema biến thể chỉ cho test, hàm trigger bỏ `FOR UPDATE` và thêm `pg_sleep(0.05)` sau bước SUM → thành công > 10 ở ít nhất một vòng.
- **NC-2:** một `Reserve` trong `REPEATABLE READ` → bị từ chối với `ledger_isolation`.
- Phụ: 20 goroutine ghi entry chạm cả {X, Y}, nửa theo thứ tự X→Y, nửa Y→X → 0 lỗi `40P01`; `Reserve` và `Void` đồng thời trên cùng budget → số dư cuối đúng; 20 goroutine cùng một key → 1 entry, tất cả nhận cùng `entry_id`.

---

## 2. Temporal (Q4–Q7)

Phiên bản tham chiếu: Temporal server 1.32.0 (đã chạy trong S-9), Go SDK **v1.49.0** ([releases](https://github.com/temporalio/sdk-go/releases)).

### 2.1 Q4 — Chống trùng ở điểm vào

**Ngữ nghĩa** ([Workflow Id / Run Id](https://docs.temporal.io/workflow-execution/workflowid-runid); Go SDK `internal/client.go`) [V]:

| Tình huống | Policy quyết định | Giá trị | Mặc định |
|---|---|---|---|
| Đã có execution **đang chạy** cùng ID | `WorkflowIDConflictPolicy` | `Fail` (trả lỗi *already started*), `UseExisting` (trả RunID đang chạy), `TerminateExisting` | **`Fail`** |
| Execution cùng ID **đã đóng** | `WorkflowIDReusePolicy` | `AllowDuplicate`, `AllowDuplicateFailedOnly` (chỉ khi lần trước không *Completed*), `RejectDuplicate`, `TerminateIfRunning` | **`AllowDuplicate`** ← nguy hiểm cho dedup |

Điểm then chốt:
1. **Không bao giờ có hai execution đang chạy cùng ID**, bất kể policy.
2. **Reuse policy chỉ nhìn thấy execution đã đóng còn trong retention.** Hết retention → ID dùng lại được như mới.
3. **Bẫy của Go SDK:** mặc định `WorkflowExecutionErrorWhenAlreadyStarted=false` → khi server trả `WorkflowExecutionAlreadyStarted`, SDK **nuốt lỗi** và trả `WorkflowRun` của lần chạy hiện tại. Handler không phân biệt được "mới" và "trùng". Đặt `true` để nhận `*serviceerror.WorkflowExecutionAlreadyStarted`.
4. Quên đặt reuse policy thì webhook gửi lại **sau khi** `IncomingTransfer` đã hoàn thành sẽ **khởi động lần chạy mới** → ghi sổ lần hai nếu DB không chặn.

**Webhook → `IncomingTransfer` dùng `client.ExecuteWorkflow` thường:**

| Lựa chọn | Vì sao |
|---|---|
| **Start thường** ✅ | Đúng ngữ nghĩa "mỗi giao dịch ngân hàng = một quy trình"; trả về ngay khi server ghi nhận, không cần worker đang chạy → webhook trả lời nhanh (SePay chờ tối đa 30 s) |
| SignalWithStart ❌ | Không có gì để gửi. Mặc định của nó là `UseExisting` → bản trùng thành **signal thứ hai** vào workflow đang chạy → phải tự dedup trong workflow |
| UpdateWithStart ❌ | **Không nguyên tử** ("Unlike Signal-with-Start - Update-With-Start is *not* atomic") và kết quả phụ thuộc worker đang chạy ([Sending messages](https://docs.temporal.io/sending-messages)) |

- Vì sao `AllowDuplicateFailedOnly` thay vì `RejectDuplicate`: nếu một `IncomingTransfer` bị **terminate/fail** (bug, operator dừng tay), lần gửi lại của nhà cung cấp sẽ **xử lý lại từ đầu** — an toàn vì activity ghi sổ idempotent (Q5). `RejectDuplicate` thì giao dịch đó kẹt vĩnh viễn.
- **Thứ tự trong handler:** verify chữ ký → lưu `provider_events … ON CONFLICT DO NOTHING` → **luôn** gọi `ExecuteWorkflow`. Không được "thấy event đã có thì trả 200 luôn": lần trước có thể đã lưu event nhưng Temporal sập trước khi start → lần gửi lại là cơ hội duy nhất để khởi động workflow.
- Options và ánh xạ HTTP đã chốt: [thiết kế §6](./design.md#6-tiền-vào-webhook--incomingtransfer). Trùng trả 200 vì trả 4xx/5xx sẽ khiến nhà cung cấp gửi lại vô ích.

**Chỉ dựa vào workflow ID có đủ cho BR-08 không? Không** (D-11):
- Dedup chỉ có hiệu lực **trong retention** của namespace. Giá trị mặc định của `temporal operator namespace create --retention` không được ghi trên trang CLI ([operator](https://docs.temporal.io/cli/operator)) *(chưa kiểm chứng)* → đặt rõ.
- Các đường **ngoài webhook** có thể đưa cùng giao dịch vào lại: `DailyReconciliation` lấy giao dịch từ API ngân hàng, admin nhập tay, chạy lại sau sự cố, reset workflow.
- `AllowDuplicateFailedOnly` **dựa vào** DB để an toàn.

`IncomingTransfer` → `DonationPayment` nằm ngoài spike (thiết kế §3). Hướng khi làm: `SignalExternalWorkflow` từ `IncomingTransfer`; `DonationPayment` dedup theo `providerTxnId` và rút cạn signal trước khi kết thúc; đích đã đóng → `suspense` + case. Signal không có dedup sẵn ("Signals have no built-in Update ID", [Handling messages](https://docs.temporal.io/handling-messages)).

### 2.2 Q5 — Activity idempotent

**Khoá chống trùng là khoá nghiệp vụ, không phải RunID + ActivityID.** Tài liệu Temporal gợi ý ghép Run Id + Activity Id ([Activity definition](https://docs.temporal.io/activity-definition)). Với sổ cái, cách này **không đủ**:

| Rủi ro | Hậu quả với RunID+ActivityID |
|---|---|
| **Workflow reset** (công cụ sửa sự cố thường dùng) | RunID mới → khoá mới → **ghi sổ lần hai** |
| Continue-As-New | RunID mới |
| `AllowDuplicateFailedOnly` khởi động lại | RunID mới |
| ActivityID trong Go là số thứ tự lịch sử | Đổi thứ tự activity khi versioning → khoá khác |
| Hai workflow khác nhau ghi cùng một sự việc (`IncomingTransfer` và `DonationPayment`) | Không chặn được |

Khoá cụ thể của từng activity: [thiết kế §5.3](./design.md#53-bút-toán). Bảng khoá trong báo cáo gốc (`reserve:`, `disburse:`, `void:`) đã cũ: giải ngân và huỷ nay dùng chung khoá `reservation:{req}:resolve`.

**Ghi trong một transaction** (mẫu ở thiết kế §5.4):
- **Hai lần thử chạy đồng thời** (lần 1 "zombie" vẫn chạy sau khi StartToClose hết hạn; Temporal không giết được lần 1): INSERT thứ hai **chờ** khoá của unique index tới khi tx thứ nhất commit → `DO NOTHING` → câu SELECT kế tiếp (snapshot mới trong READ COMMITTED) thấy dòng đã commit.
- **`Reserve` — bẫy thứ tự:** phải **tra khoá trước, kiểm tra số dư sau**. Nếu kiểm số dư trước, lần thử lại sau khi đã commit sẽ thấy ngân sách "thiếu" (vì chính khoản giữ lần 1 đã trừ) → workflow từ chối yêu cầu **trong khi tiền vẫn bị giữ**. Đây là ca test giá trị nhất của Q5.
- Activity trả về **cùng kết quả** cho mọi lần thử (id bút toán), để workflow không phân biệt "mới" và "đã có".

**Retry và lỗi không retry:**
- Giá trị retry/timeout đã chốt ở [thiết kế §7](./design.md#7-saga-disbursement). Luôn đặt `StartToCloseTimeout` (tài liệu "strongly recommend"). `MaximumAttempts=0` nghĩa là không giới hạn ([RetryPolicy](https://github.com/temporalio/sdk-go/blob/main/_autodocs/types.md)).
- Lỗi nghiệp vụ do **activity** quyết định bằng `temporal.NewNonRetryableApplicationError(msg, type, cause)` ([temporal API](https://github.com/temporalio/sdk-go/blob/main/_autodocs/api-reference/temporal.md)), thay vì liệt kê `NonRetryableErrorTypes` ở phía workflow — nơi hiểu lỗi là nơi phân loại.

**Tiêm lỗi "commit xong, mất kết quả" một cách tất định** — ba mức, từ rẻ đến thật:

| Mức | Cách | Chứng minh gì | Môi trường |
|---|---|---|---|
| 1 | Nếu `activity.GetInfo(ctx).Attempt == 1` và cờ bật → **commit rồi trả** một `ApplicationError` retryable | Lần thử 2 thấy khoá → không ghi thêm; workflow nhận cùng id | `testsuite` + PostgreSQL thật |
| 2 | Cờ → `os.Exit(1)` ngay sau commit ở lần thử 1; khởi động lại worker không có cờ | Đường thật: worker chết, **không báo hoàn thành**, StartToClose (đặt ngắn cho test) hết hạn → lần thử 2 ở worker mới | dev server |
| 3 | Activity ngủ **sau** INSERT, **trước** COMMIT lâu hơn StartToClose → lần 2 chạy song song lần 1 | Zombie attempt + unique index chặn | dev server |

Kiểm: đếm entry theo khoá = 1, số lần thử ≥ 2 (đọc `ActivityTaskStarted.attempt` trong history). `TestWorkflowEnvironment` có thực thi retry policy với activity thật không *(chưa kiểm chứng; mức 1 tự xác nhận, nếu không thì chuyển sang dev server)*. Cờ tiêm lỗi chỉ đọc từ biến môi trường/build tag test, **không** để trong code production.

### 2.3 Q6 — Saga giải ngân

**Signal hay Update cho thao tác của con người? Update** (D-4):

| Tiêu chí | Signal | Update |
|---|---|---|
| Kết quả cho API | Không (fire-and-forget) → API trả 202, UI phải đợi DB | **Đồng bộ**: API trả 200/409 ngay |
| Từ chối thao tác sai (sai trạng thái, cùng admin duyệt hai lần) | Phải nhận rồi tự bỏ qua; lỗi ứng dụng trong signal handler **làm fail cả workflow** | **Validator** từ chối; bị từ chối thì "no indication that it was ever requested" — lịch sử sạch; lỗi trong handler **không** làm fail workflow ([Handling messages](https://docs.temporal.io/handling-messages)) |
| Bấm đúp | Tự dedup bằng khoá trong payload | Server dedup theo **UpdateID** (trong một run) |
| Phụ thuộc worker | Không | Có: worker Funds phải chạy để validator chạy → API trả 503 khi worker chết. Chấp nhận được vì API và worker cùng service Funds |

- SDK **buffer** signal khi chưa có handler ([Go message passing](https://docs.temporal.io/develop/go/message-passing)) → một xác nhận gửi sớm sẽ nằm chờ rồi được tiêu thụ khi workflow tới bước đó. Validator của Update tránh được việc này.
- Quy tắc trong handler: validator chỉ đọc state; handler **đổi state ngay dòng đầu (trước mọi lời gọi chặn)**, sau đó chạy activity ghi bằng chứng vào DB rồi mới trả → khi API trả 200 thì DB đã phản ánh. Hai Update cùng lúc (hai admin bấm `SecondApproval`) có cùng qua validator không *(chưa kiểm chứng thứ tự validator/handler trong cùng workflow task)* → handler kiểm lại state.
- Go: `workflow.SetUpdateHandlerWithOptions(ctx, name, handler, UpdateHandlerOptions{Validator: ...})`; client `UpdateWorkflow(..., WaitForStage: WorkflowUpdateStageCompleted)`; lỗi client timeout là `*client.WorkflowUpdateServiceTimeoutOrCanceledError`. Update đã bật mặc định trên server 1.32 *(chưa kiểm chứng trực tiếp; plan Task 7 gửi thử)*.

**Phác thảo workflow (pseudo-Go).** Viết trước khi chốt thiết kế. Thứ tự BR-13 ở đây đã đúng D-9, nhưng còn khác thiết kế ở các điểm sau:
- Khoá chống trùng: theo thiết kế §5.3 (`reservation:{req}:reserve`, `reservation:{req}:resolve`).
- Không còn tài khoản `disbursed`: giải ngân ghi Có `platform_cash` (D-3).
- Ngưỡng và hạn chờ nằm trong input lúc start (D-9), không đọc bằng activity.
- `NotTransferred` phải kiểm tiền ra và duyệt hai người khi vượt ngưỡng (D-5).
- Thiếu các bước ghi `approval_records` và cập nhật `funds.disbursements`.

```go
func DisbursementWorkflow(ctx workflow.Context, in DisbursementInput) (DisbursementResult, error) {
    s := &disbState{Phase: PhaseInit}          // khởi tạo state TRƯỚC khi đăng ký handler
    registerUpdates(ctx, s, in)                 // validator kiểm s.Phase, BR-13: approver != in.ApprovedBy
    funds := withFundsOpts(ctx)                 // task queue "funds", retry vô hạn
    ops   := withRemoteOpts(ctx, "operations")  // không ScheduleToStart (xem §2.4)
    camp  := withRemoteOpts(ctx, "campaign")

    // Ngưỡng BR-13 + thời hạn: đọc MỘT LẦN, đóng băng vào state (tất định + có giá trị audit)
    var cfg DisbConfig
    exec(funds, a.GetDisbursementConfig, in.CampaignID).Get(ctx, &cfg)

    // 1. Giữ tiền: budget → reserved
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
    exec(funds, a.PostDisbursement, "disburse:"+in.RequestID).Get(ctx, nil)
    exec(ops,  "operations.MarkDisbursed", in.RequestID).Get(ctx, nil)
    exec(camp, "campaign.AdvancePhase", in.PhaseID).Get(ctx, nil)
    exec(funds, a.Publish, evt("DisbursementCompleted", in.RequestID)).Get(ctx, nil)

    workflow.Await(ctx, func() bool { return workflow.AllHandlersFinished(ctx) })
    return completed(), nil
}
```

Nguyên tắc saga:
- **Pivot = `TransferRecorded`.** Trước pivot: lỗi/huỷ → bù trừ `reserved → budget`. Sau pivot: chỉ đi tới; hết hạn hoặc tranh chấp → **case đối soát**, không auto-void.
- Lỗi activity sau pivot **không được** dẫn tới bù trừ → activity sau pivot không có timeout không-retry (§2.4).
- Không có timer "admin chưa chuyển tiền": có `Cancel` là đủ cho spike.

**Kiểm thử:**

(a) `testsuite` có tua thời gian — chạy trong `go test`, không cần server. Activity ở task queue khác đăng ký theo tên chuỗi; gửi Update bằng `env.RegisterDelayedCallback(func(){ env.UpdateWorkflow(name, id, cb, args...) }, delay)`; timer 7 ngày tự tua ([testsuite](https://github.com/temporalio/sdk-go/blob/main/internal/internal_workflow_testsuite_test.go), [Go testing](https://docs.temporal.io/develop/go/testing-suite)).

| Ca | Kỳ vọng |
|---|---|
| T1 dưới ngưỡng, đường vui | Reserve → MarkReady → Transfer → Receipt → Post → MarkDisbursed → AdvancePhase → Publish |
| T2 trên ngưỡng | Không gọi MarkReady trước SecondApproval |
| T3 BR-13 cùng admin | Validator từ chối; workflow vẫn chờ |
| T4 thiếu ngân sách | RejectRequest; **không** MarkReady |
| T5 hết hạn → AdminResolved(Transferred) | OpenReconciliationCase, rồi Post |
| T6 hết hạn → AdminResolved(NotTransferred) | Void + MarkDisbursementFailed; **không** Post |
| T7 ReceiptDisputed | Như T5/T6 |
| T8 Update sai pha (Receipt trước Transfer) | Bị từ chối |
| T9 Update trùng UpdateID | Một lần hiệu lực |
| T10 Cancel trước pivot / sau pivot | Trước: Void; sau: bị từ chối |
| **Bất biến** | `VoidReservation` không bao giờ được gọi sau `TransferRecorded` trừ khi `AdminResolved=NotTransferred` |

(b) **Replay test từ lịch sử thật.** Chạy trên dev server với hạn chờ ngắn → `temporal workflow show -w <id> --output json > testdata/histories/*.json` → test dùng `worker.NewWorkflowReplayer()` + `ReplayWorkflowHistoryFromJSONFile` ([worker API](https://github.com/temporalio/sdk-go/blob/main/_autodocs/api-reference/worker.md)). Bằng chứng cần thu: cố ý đổi thứ tự `MarkDisbursed`/`AdvancePhase` → replay **đỏ**; bọc thay đổi bằng `workflow.GetVersion` → **xanh** với lịch sử cũ.

(c) **Lint tất định:** `workflowcheck` (contrib của sdk-go, v0.6.0 — [releases](https://github.com/temporalio/sdk-go/releases)), hiện thực hoá C-10.

**Versioning: patching từ ngày đầu, chưa bật Worker Versioning** (D-12). Đã kiểm chứng:
- Worker Versioning **GA từ 30/03/2026** ([blog](https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new)); yêu cầu server ≥ **1.29.1**, Go SDK ≥ **1.35.0** ([Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)).
- Bản thử nghiệm cũ (trước 2025, theo build ID) **bị gỡ khỏi server từ 03/2026** ([Go versioning](https://docs.temporal.io/develop/go/versioning)) → bỏ qua blog/sample cũ.
- Hướng dẫn chính thức: workflow **Pinned** giữ phiên bản worker cũ sống tới khi xong; workflow kéo dài qua nhiều lần deploy mà **không** dùng Continue-As-New → **Auto-Upgrade + patching** (vẫn phải patching). `GetVersion` **không bị deprecate**.
- Áp vào FoodFund: `Disbursement`, `CampaignLifecycle`, `SurplusCase`, `ReportDeadline` đều dài hơn chu kỳ deploy → Pinned buộc chạy song song nhiều Deployment worker trên laptop 16 GB → không hợp.

### 2.4 Activity xuyên service (Operations `MarkDisbursed`, Campaign `AdvancePhase`)

| Bẫy | Hậu quả | Xử lý |
|---|---|---|
| Worker đích không chạy | Activity nằm trong hàng đợi; không có ScheduleToStart/ScheduleToClose thì **chờ vô hạn** — đúng mong muốn ("tự tiếp tục khi service lên lại") nhưng im lặng | **Không** đặt `ScheduleToStartTimeout` cho activity sau pivot: nó **non-retryable by design** ([Detecting activity failures](https://docs.temporal.io/encyclopedia/detecting-activity-failures)) → hết hạn là workflow nhận lỗi sau khi tiền đã chuyển. Thay bằng metric `temporal_activity_schedule_to_start_latency` + cảnh báo |
| Thiếu `StartToCloseTimeout` | Worker đích chết giữa chừng thì không bao giờ retry ("The Temporal Server doesn't detect failures when a Worker loses communication") | Luôn đặt |
| Gọi theo **tên chuỗi** + task queue | Không có kiểm tra kiểu lúc biên dịch | Tham số/kết quả là message trong `proto/` (C-6); hằng số tên activity sinh từ một chỗ |
| Lệch phiên bản: Funds gọi activity mà Operations chưa deploy | Activity task lỗi "không tìm thấy activity type" và retry *(chưa kiểm chứng kiểu lỗi và có retry hay không)* | Deploy phía cung cấp activity trước; không đổi chữ ký tại chỗ — chỉ thêm field tuỳ chọn hoặc tạo `MarkDisbursedV2` |
| Activity phía đích không idempotent | Retry làm hỏng trạng thái | `MarkDisbursed` khi đã `DISBURSED` → trả OK; `AdvancePhase` theo trạng thái đích, không theo "bước +1" |
| Bảo mật | Mọi worker trong namespace gọi được mọi activity | Ngoài phạm vi spike (mTLS/namespace để sau) |

Spike cần: một process stub với hai worker trên task queue `operations`, `campaign`, đăng ký `MarkReadyToDisburse`, `RejectRequest`, `MarkDisbursed`, `MarkDisbursementFailed`, `AdvancePhase`, ghi vào một bảng nhỏ để kiểm idempotent. Một ca: dừng stub → workflow đứng ở `MarkDisbursed` → bật lại → chạy tiếp, không trùng.

### 2.5 Q7 — Phát event không outbox

**Chi phí thật của "ghi DB rồi phát event" cho thao tác ghi đơn giản.** Mỗi thao tác thành: StartWorkflow → workflow task → activity ghi → workflow task → activity publish → workflow task → hoàn thành. Ước lượng ~3 workflow task, 2 activity task, ~15 event lịch sử *(ước lượng, chưa đo)*. Theo báo cáo, hiệu năng không phải vấn đề chính (lưu lượng thấp); vấn đề là:
1. **Ghép độ sẵn sàng:** Temporal sập → **mọi** thao tác ghi có phát event đều 503, không chỉ luồng tiền.
2. **Ngữ nghĩa API:** hoặc API chờ kết quả workflow (độ trễ + phụ thuộc worker), hoặc trả 202 và UI đọc DB chưa cập nhật.
3. **Boilerplate & versioning:** mỗi đường ghi = một workflow type, một ID scheme, thêm vào phạm vi replay test.

Trong luồng tiền (đã là workflow), activity publish gần như miễn phí — giữ nguyên.

| Phương án | Ưu | Nhược | Đảo ngược |
|---|---|---|---|
| A. Workflow ghi-rồi-phát mọi nơi (hiện tại) | Một cơ chế duy nhất | Ba vấn đề ở trên | Dễ |
| B. **Outbox tối thiểu** cho thao tác đơn giản (`libs/events`: INSERT outbox trong cùng tx; relay `FOR UPDATE SKIP LOCKED` → NATS với `Nats-Msg-Id = eventId`) | Ghi cục bộ, đồng bộ, không phụ thuộc Temporal | Hai cơ chế; ~100–150 dòng relay *(ước lượng)* | Dễ |
| C. **Bỏ NATS**: activity chiếu thẳng sang consumer trên task queue của họ | Bớt một thành phần vận hành và RAM | Producer biết danh sách consumer (~15 cặp event→consumer) → thêm consumer = sửa + version workflow của producer | Trung bình |
| D. Bỏ NATS, consumer **kéo** (poll) feed thay đổi của producer | Không bus, không ghép producer→consumer | Mỗi consumer poll mỗi producer; vẫn phải có bảng outbox | Trung bình |

Khuyến nghị (giữ đảo ngược được): luôn có interface `Publisher` + envelope event (`eventId`, `occurredAt`, `correlationId`, `schemaVersion`) trong `proto/`; thao tác đơn giản để số đo quyết giữa A và B; bỏ NATS không quyết trong spike.

**Spike cần đo gì:**

| Đo | Cách | Ngưỡng gợi ý để chuyển sang outbox |
|---|---|---|
| Độ trễ p50/p95: tx thường vs ghi-rồi-phát (chờ kết quả) vs ghi-rồi-phát (202) | Nhiều thao tác tuần tự trên kind | p95 chờ kết quả > ~200 ms *(ngưỡng do chủ dự án chốt)* |
| Số event lịch sử / workflow task mỗi thao tác; dung lượng tăng của DB `temporal` | `temporal workflow show`; `pg_total_relation_size` trước/sau | Tham khảo cho dung lượng VPS demo |
| Hành vi khi Temporal ngừng | Scale frontend về 0, thử lệnh ghi | Nếu chủ dự án không chấp nhận lệnh ghi đơn giản trả 503 → B |
| Boilerplate | Số dòng/file cần thêm cho một đường ghi mới theo A và theo B | So sánh trực tiếp |
| Consumer idempotent | Publish trùng cùng `eventId` → consumer xử lý một lần | Bắt buộc đạt cho mọi phương án |
| RAM của NATS | Lấy từ S-4 (nếu đã có) | Lợi ích nếu bỏ NATS |

---

## 3. Kiểm thử đối kháng

Mục tiêu của báo cáo gốc: phá thiết kế trên giấy, biến mỗi đòn tấn công thành một test pass/fail.

### 3.1 Giả định và ngân hàng giả

Danh mục và bất biến viết cho **mô hình postings** (trước D-1). Đổi tên cột thì đổi query, **không đổi bất biến**. Schema giả định:

```sql
accounts(id, code UNIQUE, kind, normal_side CHAR(1) CHECK (normal_side IN ('D','C')))
journal_entries(id, idempotency_key TEXT UNIQUE NOT NULL, kind, ref_type, ref_id, created_at)
postings(id, entry_id FK, account_id FK, side CHAR(1) CHECK (side IN ('D','C')), amount BIGINT CHECK (amount > 0))
provider_events(provider, provider_txn_id, amount, payload_hash, received_at, UNIQUE(provider, provider_txn_id))
disbursements(request_id, approved_amount, status, ...)        -- bảng nghiệp vụ, được UPDATE
-- CHỈ DÙNG TRONG TEST: "ngân hàng giả", ghi lại tiền thật đã vào/ra
fake_bank(txn_id, direction IN ('in','out'), amount, linked_ref)
```

Quy ước phía: `platform_cash` là tài sản (D); các tài khoản còn lại là quỹ/nợ phải trả (C). Tiền đang giữ nằm ở `reserved:{request}`, nên không cần cột "pending balance" riêng.

**"Ngân hàng giả" (`fake_bank`)** là mảnh harness quan trọng nhất cho kiểm thử đối kháng. Nó ghi lại tiền **thật** đã đi đâu, độc lập với sổ cái. Thiếu nó thì không test được "void sau khi tiền đã đi" hay "đối soát = 0".

### 3.2 Danh mục kịch bản

**Phạm vi:** **P0** = bắt buộc trong spike · **P1** = làm nếu còn thời gian · **Defer** = để tới lúc triển khai.
**Tầng test:** **SQL** = Go test + pgx với PG 18 (testcontainers) · **TS** = `testsuite` của Temporal Go SDK (time-skipping, activity chạy thật với PG) · **DEV** = `temporal server start-dev --db-filename …` + worker là tiến trình thật, kill được.

#### Nhóm L — Hình dạng bút toán (Q1) · SQL · P0

Chạy bằng role `funds_app` trên PG18 thật.

- **L1.** Entry khai `transfer_count=2` nhưng chỉ insert 1 chân → `Commit` lỗi `23514`, `ConstraintName="ledger_entry_complete"`; DB không còn dòng nào của entry đó.
- **L2.** Entry không có chân nào → bị từ chối, nhờ trigger trên `journal_entries`. Constraint trigger là `AFTER ROW`: nếu chỉ gắn vào bảng chân thì entry **không có dòng nào** sẽ không bao giờ kích hoạt trigger.
- **L3.** Ở transaction sau, thêm một chân vào entry đã commit → bị từ chối. Thêm chân là sửa lịch sử dù không cần UPDATE.
- **L4.** Ghi các chân bằng **nhiều câu lệnh riêng** trong cùng transaction → thành công. Test này chứng minh việc hoãn thật sự cần thiết.
- **L5.** `amount <= 0` hoặc `debit = credit` → lỗi **ngay tại câu lệnh** (`23514` từ CHECK), không đợi tới COMMIT.
- **L6.** `SET CONSTRAINTS ALL IMMEDIATE` sau chân đầu tiên của entry 2 chân → lệnh `SET` lỗi (ghi lại hành vi).
- **L7.** App thử `SET session_replication_role = replica`, `ALTER TABLE … DISABLE TRIGGER`, `DROP TRIGGER` → `42501` (gộp vào A6).

#### Nhóm A — Toàn vẹn sổ cái ở mức DB (Q2)

A1–A3 (bút toán lệch, lệch từng entry nhưng cân tổng, entry thiếu phía) chỉ có nghĩa với mô hình postings. Với mô hình transfer, cân bằng do cấu trúc và nhóm L thay thế. A4 (thêm chân vào entry đã commit) chính là L3.

**A5. UPDATE / DELETE / TRUNCATE bằng user ứng dụng** — Q2 · SQL · **P0**
- *Tái hiện:* đăng nhập bằng `funds_app`, chạy UPDATE, DELETE, TRUNCATE trên các bảng sổ cái và `provider_events`.
- *Pass:* mọi lệnh lỗi `42501`; số dòng không đổi. TRUNCATE chỉ GRANT mới chặn được (§1.4).

**A6. Vô hiệu hoá trigger** — Q2 · SQL · **P0** (phần kiểm tra quyền và cấu hình)
- *Tấn công:* (a) app là owner → `ALTER TABLE … DISABLE TRIGGER`; (b) `SET session_replication_role = replica`; (c) `SET CONSTRAINTS … IMMEDIATE` chỉ đổi thời điểm kiểm tra, không bỏ qua được.
- *Bất biến:* owner của bảng sổ cái ≠ `funds_app`; `funds_app` không phải superuser, không có quyền SET `session_replication_role`; trigger `ENABLE ALWAYS` (`pg_trigger.tgenabled = 'A'`).
- *Pass:* (a), (b) bị từ chối; (c) vẫn bị từ chối lúc kiểm tra; query cấu hình trả đúng.

**A7. pgx/sqlc báo lỗi trigger hoãn lúc COMMIT** — Q2 · SQL · **P0**
- *Kiểm tra:* (1) lỗi từ `tx.Commit(ctx)` là `*pgconn.PgError` đọc được `Code`, `ConstraintName`, để activity phân loại non-retryable; `40001`/`40P01` là retryable. (2) Không có trạng thái "nửa commit". (3) Truy vấn số dư trả `int64`, không phải `numeric` (§1.5).
- *Pass:* có bảng phân loại lỗi và test cho từng mã.

**A8. Số tiền âm, bằng 0, quá lớn, tràn số** — SQL · **P1**
- *Tái hiện:* INSERT `amount = -1`, `0`, `9223372036854775807`. Hai chân gần `MaxInt64` cùng tài khoản rồi đọc số dư bằng `::bigint`.
- *Bất biến:* `0 < amount ≤ AMOUNT_CAP` (đề xuất cap 10^13 VND, quy tắc an toàn chứ không phải nghiệp vụ); đọc số dư không bao giờ tràn im lặng.
- *Pass:* INSERT sai bị CHECK chặn (`23514`). Ép kiểu tràn trả `22003 numeric_value_out_of_range`, không quay vòng.

*Defer:* A9 chân vào sai tài khoản (quy tắc nghiệp vụ trong Go) · A10 sửa trực tiếp bằng superuser/owner (phát hiện bằng hash chain hoặc pgaudit; đối soát ngân hàng bắt được lệch tiền nhưng không bắt được sửa nhãn).

#### Nhóm B — Đồng thời trên một ngân sách (Q3)

**B1. N `Reserve` đồng thời trên một budget** — Q3 · SQL · **P0**. Chi tiết ở §1.6.
- Trộn thêm (để bắt B3): goroutine Void reservation cũ và goroutine giải ngân cùng lúc, khoá **nhiều tài khoản** để lộ deadlock do thứ tự khoá.
- *Bất biến:* `bal(budget) ≥ 0` tại mọi thời điểm commit; `Σ reserved + bal(budget) + Σ đã giải ngân từ budget này = ngân sách ban đầu`.
- *Test the test:* biến thể "naive" (bỏ khoá) **phải FAIL**. Nếu naive không fail thì test không đủ nhạy, phải tăng sleep hoặc số goroutine.

**B3. Deadlock do thứ tự khoá** — SQL · **P1**. *Pass:* hoặc không có `40P01` (khoá theo thứ tự `account_id`), hoặc có và được retry thành công.

**B4. Lỗi serialization nổi lên tới activity** — gộp vào B1. *Pass:* activity trả lỗi retryable, Temporal retry, kết quả cuối giống chạy tuần tự.

**B5. Biên chính xác** — gộp vào B1. Còn lại = X: Reserve X → OK, sau đó `bal=0`; Reserve X+1 → từ chối, sổ cái không đổi.

*Defer:* B2 Reserve đồng thời với điều chỉnh sổ cái (FR-LED-03).

#### Nhóm C — Tiền vào: webhook → IncomingTransfer (Q4)

**C1. Webhook lặp khi workflow đang chạy** — DEV · **P0**
- *Tái hiện:* gửi cùng payload đã ký 10 lần song song. Activity ghi sổ có hook dừng 2 giây để workflow còn đang chạy.
- *Pass:* 10/10 response là 200 (handler coi `WorkflowExecutionAlreadyStarted` là thành công — đây là **C8**); đúng 1 entry; 1 dòng `provider_events`.
- *Fail phụ:* handler trả 5xx khi gặp AlreadyStarted → nhà cung cấp gửi lại mãi.

**C2. Webhook lặp SAU khi workflow đã đóng** — DEV · **P0** — rủi ro số 1
- *Lý do:* reuse policy mặc định là *Allow Duplicate* (§2.1). Nhà cung cấp có thể gửi lại sau vài phút đến vài giờ.
- *Tái hiện:* gửi webhook, chờ workflow Completed, gửi lại payload y hệt.
- *Pass:* đúng một entry; ghi rõ lớp nào đã chặn.
- *Test the test:* tắt UNIQUE và để policy mặc định → test **phải FAIL** (2 entry).

**C3. Lặp sau retention** — DEV · **P0** (gộp với C2). `temporal workflow delete` execution cũ (giả lập hết retention), rồi gửi lại. *Pass:* vẫn đúng một entry, tức **chỉ DB** đứng ra bảo vệ.

**C4. Cùng số tiền, khác `providerTxnId` (BR-08)** — DEV hoặc TS · **P0**. Hai webhook cùng số tiền, nội dung, VA, cùng giây, `providerTxnId` khác. *Pass:* 2 entry. *Fail:* dedup dựa trên (số tiền, nội dung, thời gian) — đúng lỗi của hệ thống cũ (`sepay-webhook.service.ts:133-137`).

**C5. Cùng `providerTxnId`, payload khác** — DEV · **P0**. Với workflow ID tất định, lần thứ hai bị coi là trùng và **payload khác bị nuốt im lặng**. *Pass:* 1 entry (theo payload đầu) + 1 cảnh báo hoặc case; response vẫn 200.

**C7. Temporal ngừng khi webhook đến** — DEV · **P0**
- *Tái hiện:* dừng dev server → POST webhook → bật lại server → POST lại cùng payload.
- *Pass:* lần 1 trả 5xx và **không** có entry; lần 2 trả 200 và có 1 entry. Biến thể "nhà cung cấp **không** gửi lại": truy vấn I-13 phải phát hiện được event mồ côi.

*Defer:* C6 webhook đến sai thứ tự · C9 một khoản tiền báo bởi cả PayOS lẫn SePay (đã xử lý bằng D-8) · C10 thanh toán khớp đúng lúc VA hết hạn (luật ở thiết kế §3) · C11 duyệt tay rồi webhook đến sau (thiết kế §12, FR-PAY-11) · C12 resolve hàng chờ đối soát hai lần · C13 webhook giả mạo (S-1).

#### Nhóm D — Activity chạy lại (Q5, Q7)

**D1. Worker chết sau khi DB commit, trước khi báo hoàn thành** — DEV · **P0**
- *Tái hiện:* điểm tiêm lỗi gọi `os.Exit(1)` ngay sau `tx.Commit` trong `PostDonation`, `Reserve`, `PostDisbursement`. Supervisor của test khởi động lại worker. StartToClose đặt ngắn để retry nhanh.
- *Lý do:* server không phát hiện được worker chết, chỉ dựa vào StartToClose timeout để ép retry ([Detecting activity failures](https://docs.temporal.io/encyclopedia/detecting-activity-failures)).
- *Bất biến:* khoá không chứa attempt hay RunID. Báo cáo gốc đề xuất `workflowID:bước`; thiết kế chốt khoá nghiệp vụ (D-11, §5.3).
- *Pass:* sau khi restart, workflow hoàn thành; mỗi khoá có 1 entry; lần chạy lại trả **cùng `entryId`**.
- *Test the test:* sinh khoá bằng `uuid.New()` trong activity → test **phải FAIL**.

**D2. Hai attempt chạy CÙNG LÚC** — DEV · **P0**
- *Tái hiện:* ngủ trước commit lâu hơn StartToClose; hai worker cùng lắng nghe task queue.
- *Bất biến:* "SELECT xem có chưa, chưa có thì INSERT" **không đủ**; phải dựa vào UNIQUE + `ON CONFLICT`.
- *Pass:* đúng 1 entry; attempt nào thua phải đọc lại và trả kết quả của bên thắng, không ném lỗi vĩnh viễn.

**D3. Trùng khoá nhưng payload khác** — TS · **P0**. Gọi ghi sổ với khoá K số tiền 100, rồi khoá K số tiền 90 (mô phỏng bug hoặc workflow bị sửa giữa chừng). *Pass:* lần 2 trả `ApplicationError{NonRetryable:true}`; sổ cái không đổi.

**D4. Khoá lấy theo RunID hoặc attempt** — review + TS · **P0** (gộp D1). *Pass:* khoá không đổi qua retry, qua reset và qua continue-as-new.

**D5. `eventId` sinh mới mỗi lần retry** — TS · **P1**. Activity `Publish` sinh `eventId = uuid.New()`; attempt 1 đã publish nhưng không báo được → attempt 2 publish lại với `eventId` mới. *Bất biến:* `eventId` tất định; consumer dedup theo `eventId`. *Pass:* subscriber nhận 2 message cùng `eventId`, xử lý 1 lần.

**D6. Publish lỗi vĩnh viễn sau khi tiền đã ghi sổ** — TS · **P1**. *Pass:* workflow **không** bù trừ hay đảo bút toán chỉ vì bus lỗi; tiền đã ghi giữ nguyên; workflow retry hoặc cảnh báo (NFR-07).

#### Nhóm E — Saga giải ngân (Q6)

Chạy được trong **TS** (`RegisterDelayedCallback` để gửi Update vào thời điểm mong muốn), với activity Funds chạy thật trên PG và activity Operations/Campaign là stub.

**E1. Happy path dưới và trên ngưỡng BR-13** — TS · **P0**
- *Bất biến sau khi xong:* `bal(reserved:{req}) = 0`; tiền ra khỏi `platform_cash` đúng `approved_amount`; `fake_bank.out` có 1 dòng gắn `req`; stub nhận `MarkDisbursed` đúng 1 lần; I-11.
- *Pass:* 2 ca đều đạt; ca trên ngưỡng không đi tiếp khi thiếu SecondApproval.

**E2. `ReceiptConfirmed` đến TRƯỚC `TransferRecorded`** — TS · **P0**. SDK buffer signal khi chưa có handler (§2.3) → xác nhận gửi sớm sẽ được tiêu thụ ngay khi workflow tới bước đó. *Pass:* validator từ chối; không có giải ngân.

**E3. Update lặp hoặc mâu thuẫn** (`TransferRecorded` hai lần, lần hai khác số tiền; `ReceiptConfirmed` hai lần) — TS · **P0**. *Pass:* mỗi bước chuyển trạng thái xảy ra đúng một lần; Update thứ hai không đổi số tiền đã ghi nhận; 1 entry giải ngân.

**E4. `ReceiptConfirmed` đến SAU khi hết hạn** (case đã mở, đang chờ `AdminResolved`) — TS · **P0**. *Pass:* hành vi theo D-7; đúng một kết cục; I-11 không có request vừa giải ngân vừa huỷ.

**E5. Update tới workflow đã đóng** — DEV · **P1**. *Pass:* API trả lỗi (409/410), **không** trả 200; sổ cái không đổi.

**E6. Update đúng biên hạn chót** — TS · **P1**. Gửi tại `deadline − 1s` và `deadline + 1s`; nếu được thì thêm ca timer và Update trong cùng một workflow task. *Pass:* đúng một nhánh thắng, tất định khi replay; quy tắc biên ghi thành văn.

**E7. Cùng một admin làm cả hai lần duyệt (BR-13)** — TS · **P0**. *Bất biến:* `approver2 ≠ approver1`. *Pass:* duyệt lần hai bị validator từ chối; workflow chờ admin khác. Ca A và A' là hai tài khoản của cùng một người thì không phát hiện được — ghi nhận giới hạn.

**E8. Signal/Update gửi vòng qua Funds (C-7)** — DEV · **P1** (chỉ ghi nhận). `temporal workflow signal …` từ máy dev; thử gửi từ Web UI. Server tự host mặc định chấp nhận tất cả. *Pass:* ghi lại kết quả và các biện pháp: NetworkPolicy tới frontend Temporal; Web UI đặt `disableWriteActions`/`TEMPORAL_DISABLE_WRITE_ACTIONS` ([Web UI config](https://docs.temporal.io/references/web-ui-configuration)) *(chưa kiểm chứng việc chặn riêng thao tác signal)*; authorizer/claim mapper để sau.

**E9. Các biến thể `AdminResolved` và `ReceiptDisputed`** (Transferred → giải ngân; NotTransferred → huỷ; gửi hai lần; gửi khi không có case mở) — TS · **P0**. *Pass:* mỗi request `count(giải ngân) + count(huỷ) = 1`; `AdminResolved` thứ hai bị bỏ; `AdminResolved` khi chưa có case bị từ chối. (E11 gộp vào đây.)

**E10. Void sau khi tiền đã thật sự rời tài khoản** — TS · **P0** — rủi ro số 3
- *Tái hiện:* E1 tới `TransferRecorded`, ghi `fake_bank.out(linked_ref=req)` → hết hạn → `AdminResolved{NotTransferred}`.
- *Bất biến:* **không được void** khi đã có tiền ra gắn với request; I-12 (đối soát) = 0.
- *Pass:* void bị từ chối, case vẫn mở; `bal(budget)` không tăng.
- *Test the test:* bỏ kiểm tra tiền ra → I-12 **phải** báo lệch đúng `approved_amount`.

**E14. Worker chết giữa saga** — DEV · **P1**. Kill worker → gửi Update → bật worker → workflow tiếp tục; bất biến đạt; không có activity nào chạy thừa ngoài các lần retry hợp lệ.

**E15. Temporal server khởi động lại giữa saga** (timer rút xuống 30 giây) — DEV · **P1**. *Bắt buộc* chạy dev server với `--db-filename`, vì mặc định "Workflow Executions are lost when the server process dies" ([CLI server](https://docs.temporal.io/cli/server)). *Pass:* timer vẫn bắn sau khi server lên lại; case được mở.

**E16. Replay non-determinism sau khi sửa code** — TS + replayer · **P0**. Ghi history của E1 và E4 → sửa workflow (chèn một activity, hoặc đổi thứ tự) → chạy replayer. *Pass:* bản sửa thô **phải fail** replay; bản dùng `GetVersion` **phải pass**; chạy được trong `go test`.

**E17. Chạy lại `disbursement-{requestId}` sau FAILED** — SQL + TS · **P1**. Với D-6 (FAILED là kết thúc, `REJECT_DUPLICATE`), lần chạy lại phải bị từ chối.

**E19. Số tiền `TransferRecorded` khác số đã duyệt** — TS · **P1**. TigerBeetle **cho phép** post số nhỏ hơn pending ([TigerBeetle transfer](https://docs.tigerbeetle.com/reference/transfer/)); BR-07 đòi "bằng chi phí đã duyệt". *Bất biến:* giải ngân = giữ = duyệt; khác thì không giải ngân, mở case.

*Defer:* E12 ngưỡng BR-13 đổi giữa saga (đã xử lý: ngưỡng chốt vào input, D-9) · E13 Update chưa xử lý bị mất khi workflow kết thúc (chờ `AllHandlersFinished`) · E18 giải ngân xong nhưng `MarkDisbursed` lỗi vĩnh viễn · E20 campaign bị huỷ khi còn reservation đang chờ.

#### Nhóm F — Thời gian

**F1. Deadline, múi giờ, tính tất định** — TS + lint · **P1**. *Tấn công:* (a) code workflow dùng `time.Now()` hoặc `time.Local`; (b) deadline tính theo giờ máy worker (UTC trong container) trong khi người dùng hiểu theo `Asia/Ho_Chi_Minh` (UTC+7, không có DST). *Bất biến:* deadline tuyệt đối tính **một lần** từ `workflow.Now` và lưu `timestamptz`. *Pass:* `workflowcheck` không thấy vi phạm; E6 đạt.

*Defer:* F2 giờ DB và giờ workflow lệch nhau ở biên ngày của sao kê · G-1 làm tròn khi phân bổ BR-06 (`Σ budget + surplus = campaign_received` chính xác tới từng đồng).

### 3.3 Bộ bất biến (ledger audit)

Harness chạy **sau mỗi kịch bản**. Mỗi query phải trả **0 dòng**. Thiết kế §8.1 gộp 13 truy vấn dưới đây thành 7 nhóm (plan Task 4 gọi là I1–I7):

| Nhóm của thiết kế | Truy vấn gốc |
|---|---|
| I1 — mỗi entry đủ chân | I-1, I-2, I-3 |
| I2 — không tài khoản nào âm | I-4, I-5, I-6 |
| I3 — một bút toán mỗi giao dịch, đúng số tiền | I-7, I-8 |
| I4 — không vừa giải ngân vừa huỷ; trạng thái khớp sổ | I-10, I-11 |
| I5 — đối soát với ngân hàng giả | I-12 |
| I6 — không event mồ côi | I-13 |
| I7 — quyền và trigger | I-9 |

SQL dưới đây viết cho **mô hình postings** (§3.1); bạn tự chuyển sang mô hình transfers. Với D-3, giải ngân ghi Có `platform_cash`.

```sql
-- I-1  Mỗi entry cân bằng
SELECT entry_id FROM postings
GROUP BY entry_id
HAVING SUM(CASE side WHEN 'D' THEN amount ELSE -amount END) <> 0;

-- I-2  Mỗi entry có ≥2 posting, đủ hai phía
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

-- I-12 Đối soát với "ngân hàng giả" = 0 chênh lệch (NFR-01), quy ước "giải ngân ghi Có platform_cash"
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
- Replay toàn bộ history đã ghi trong lần chạy → pass.

### 3.4 Gap trong tài liệu và cách đã xử lý

Báo cáo gốc tìm ra 15 gap trong `01`, `02`, ADR. Tất cả đã thành quyết định hoặc nằm trong bảng "Cập nhật tài liệu" ([thiết kế §12](./design.md#12-đầu-ra)).

| Gap | Nội dung | Xử lý |
|---|---|---|
| G1 | Duyệt hai người diễn ra **sau** khi tiền đã chuyển (`02` §7.3) | D-9 |
| G2 | "Pending có hạn" (ADR-001, T-6) mâu thuẫn "không tự hoàn" (`02` §7.3) | D-10 |
| G3 | `platform_cash` không giảm khi giải ngân → đối soát ngân hàng = 0 bất khả thi | D-3 |
| G4 | ADR-003 luật 3 hứa "Temporal tự chống trùng" | D-11 |
| G5 | `disbursement-{requestId}` và giải ngân lại sau FAILED | D-6 |
| G6 | Một khoản tiền, hai nhà cung cấp (PayOS + SePay) | D-8 |
| G7 | BR-06 có sai số, không có quy tắc làm tròn | Thiết kế §12 (BR-06) |
| G8 | Ngưỡng BR-13: `>` hay `≥`, đọc lúc nào | D-9 |
| G9 | Hạn chót tính từ đâu; xác nhận đến muộn | D-7 |
| G10 | Duyệt tay (FR-PAY-11) không gắn với `providerTxnId` | Thiết kế §12 (FR-PAY-11) |
| G11 | Số tiền chuyển thực tế khác số đã duyệt | Thiết kế §5.3 (giải ngân = giữ = duyệt), validator `TransferRecorded` |
| G12 | C-7 không có cơ chế ép | Thiết kế §12 (C-7), kịch bản E8 |
| G13 | `provider_events` là inbox không có ai quét | Thiết kế §12 (`02` §7.1), bất biến I-13 |
| G14 | Tiền đến khi VA vừa hết hạn | Thiết kế §3 (luật `suspense`) |
| G15 | Void chỉ cần một admin, không đối chiếu tiền ra | D-5 |

---

## 4. Điều chưa kiểm chứng

Plan Task 15 ghi lại mục nào đã được xác nhận hay bác bỏ.

| Điều | Trạng thái | Kiểm ở |
|---|---|---|
| Catalog/parser tĩnh của sqlc biết `uuidv7()`, `CREATE CONSTRAINT TRIGGER`, plpgsql trong migration | *(chưa kiểm chứng)* | Task 5 (`sqlc generate`) |
| sqlc suy kiểu `unnest` nhiều mảng với pgx/v5; kiểu sinh cho `SUM(bigint)` | *(chưa kiểm chứng)* | Task 5 |
| `uuidv7()` đơn điệu trong cùng backend | *(chưa kiểm chứng)*; thiết kế không phụ thuộc | — |
| pgx giữ kết nối sau khi COMMIT lỗi | [S] từ source `tx.go` | Task 3 (`MaxConns=1`) |
| RR + `FOR UPDATE` trên dòng chỉ bị khoá (không bị UPDATE) không báo 40001 → snapshot cũ | [S] | Task 6 (NC-2) |
| `FOR UPDATE … ORDER BY` khoá theo thứ tự đã sắp | [S] | B3 |
| COPY FROM kích hoạt trigger hàng | *(chưa trích lại)* | Không cần cho spike |
| Mặc định `CONNECT` cấp cho PUBLIC; mặc định `MaxConns` của pgxpool | *(chưa trích lại)* | Test catalog / cấu hình tường minh |
| Update bật mặc định trên server 1.32 | *(chưa kiểm chứng)* | Task 7 |
| `TestWorkflowEnvironment` thực thi retry policy với activity thật | *(chưa kiểm chứng)* | Task 8, Task 10 |
| Thứ tự validator/handler khi hai Update đến cùng workflow task | *(chưa kiểm chứng)* | Task 12 |
| Retention mặc định khi tạo namespace; `temporal workflow delete` có trong CLI và xoá bất đồng bộ | *(chưa kiểm chứng)* | Task 9 (C3) |
| Kiểu lỗi khi activity type chưa được đăng ký ở worker đích, có retry không | *(chưa kiểm chứng)* | Task 11 |
| `disableWriteActions` của Web UI có chặn riêng thao tác gửi signal không | *(chưa kiểm chứng)* | E8 (P1) |
