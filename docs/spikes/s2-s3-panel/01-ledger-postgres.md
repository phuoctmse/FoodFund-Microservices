# Panel — Chuyên gia PostgreSQL / sổ cái kép: input cho spike S-2 (+ phần ledger của S-3)

- **Phạm vi:** Q1, Q2, Q3; mô hình dữ liệu sổ cái mà spike nên kiểm; throwaway vs skeleton; YAGNI.
- **Ngày:** 2026-10-11. Phiên bản đối chiếu: PostgreSQL 18 docs, pgx **v5.11.0** (tag 2026-09-07, [tags](https://github.com/jackc/pgx/tags)), sqlc **v1.31.1** (2026-04-22, [releases](https://github.com/sqlc-dev/sqlc/releases)).
- Quy ước: **[V]** = đã kiểm chứng trong tài liệu chính thức/source (có URL) · **[S]** = suy luận từ tài liệu/source, spike phải xác nhận · *(unverified)* = chưa kiểm chứng.

---

## 0. TL;DR

1. **Mô hình:** đề xuất bảng `transfers` **hai chân** (debit_account, credit_account, amount > 0) nhóm theo `journal_entries` — kiểu TigerBeetle. Cân bằng có được **do hình dạng schema** (CHECK), không phụ thuộc trigger. Bút toán nhiều chân = nhiều transfer cùng `entry_id`. Phương án multi-leg postings (`amount` có dấu, tổng = 0) để làm dự phòng.
2. **Pending / post / void:** dùng **tài khoản giữ tiền** `reserved:{request}` (đã có trong 02 §4). Reserve, post và void đều là bút toán *đã ghi sổ*; trạng thái "pending" suy ra từ số dư của `reserved:{request}`. **Không** lưu hạn dùng trong DB để tự hết hạn như TigerBeetle: thời gian do Temporal quản lý (timer), DB chỉ ghi kết quả.
3. **Số dư:** tính thuần bằng `SUM` có index (không có bảng cache). Ở ~0,3 lượt ghi/giây, mỗi tài khoản `budget:*` chỉ có vài chục dòng.
4. **Q1:** dùng `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED FOR EACH ROW` — đây là dạng hoãn **duy nhất** Postgres cho phép (constraint trigger bắt buộc là AFTER ROW và không được dùng transition table [V]). Trigger kiểm tra các bất biến chỉ đúng **tại COMMIT**: entry đủ số chân đã khai, và tài khoản bị cấm âm không âm.
5. **Q3:** **khoá dòng `accounts … FOR UPDATE` ngay trong trigger hoãn** (hàm `SECURITY DEFINER`, khoá theo thứ tự id), ở mức READ COMMITTED, và trigger từ chối REPEATABLE READ. Như vậy DB tự chặn chi vượt ngay cả khi code Go quên khoá. Test: 50 goroutine, sức chứa 10 → đúng 10 thành công, kèm *negative control*.
6. **Q2:** role chủ (owner) và role ứng dụng phải là **hai role khác nhau**. App chỉ có `SELECT, INSERT`. Lỗi tại COMMIT về Go dưới dạng `*pgconn.PgError` do `tx.Commit` trả ra (sqlc không tham gia). Đặt `ERRCODE = check_violation` (23514) kèm `CONSTRAINT = '<tên>'` để Go phân loại lỗi qua `pgErr.ConstraintName`.
7. **Throwaway-but-harvest:** đồng ý. Phần giữ lại là **SQL viết ở chất lượng production** (migration goose, bootstrap role) cùng danh sách kịch bản test; code Go bỏ đi.

---

## 1. Mô hình dữ liệu sổ cái cho spike

### 1.1 Ba trục lựa chọn

**Trục A — Hình dạng bút toán**

| | **P: postings nhiều chân** | **T: transfers hai chân (đề xuất)** |
|---|---|---|
| Dòng | `postings(entry_id, account_id, amount)`, amount có dấu (+ nợ / − có) | `transfers(entry_id, debit_account_id, credit_account_id, amount>0)` |
| Cân bằng | Phải có trigger hoãn kiểm `SUM(amount)=0` cho mỗi entry | **Cân bằng do cấu trúc**: mỗi dòng tự cân; chỉ cần `CHECK (amount>0)` và `CHECK (debit<>credit)`. Go không thể biểu diễn một bút toán lệch |
| Đọc số dư | 1 index `(account_id) INCLUDE (amount)` → index-only scan | 2 index (debit, credit), `SUM` hai vế; hoặc dùng view `account_postings` dạng UNION ALL để đọc như mô hình P |
| Sao kê công khai (FR-TRN-01) | Phải ghép các chân thành "từ → đến" | Mỗi dòng đã là "từ → đến" |
| Bút toán phức (AllocateBudget: 1 nợ, N có) | 1 entry, N+1 posting | 1 entry, N transfer |
| Khớp với "mượn TigerBeetle" | Một phần | Trùng hình dạng `transfers` của TigerBeetle → nếu sau này chuyển sang TigerBeetle thì dữ liệu ánh xạ 1:1 |
| Rủi ro | Trigger là tuyến phòng thủ duy nhất cho cân bằng → Q1 mang tính sống còn | Q1 phần "cân bằng" trở nên tầm thường; trigger hoãn vẫn cần cho các bất biến khác (§2) |

*Khả năng đảo ngược:* lúc này (chưa có dữ liệu) đổi rất rẻ. Khi đã có dữ liệu, chuyển T → P là migration cơ học (mỗi transfer tách thành 2 posting); chuyển P → T thì phải ghép cặp các chân. Tên thực thể trong 02 §4 (`JournalEntry`, `Posting`) vẫn giữ được: "posting" = một chân của transfer, đọc qua view. **Đây là đề xuất, không phải quyết định đã chốt — chủ dự án quyết.** Nếu giữ mô hình P, quy mô spike gần như không đổi: thêm kiểm tra `SUM=0` vào cùng hàm trigger.

**Trục B — Biểu diễn pending/post/void**

| | **A: tài khoản giữ tiền (đề xuất)** | **B: pending kiểu TigerBeetle trong DB** |
|---|---|---|
| Reserve | Bút toán đã ghi sổ `budget:{p}:{c} → reserved:{req}` | Dòng transfer có `flags=pending`, `expires_at` |
| Post | Bút toán `reserved:{req} → disbursed:{campaign}` | Dòng resolution `post` tham chiếu `pending_id`, `UNIQUE(pending_id)` |
| Void | Bút toán `reserved:{req} → budget:{p}:{c}` | Dòng resolution `void`, `UNIQUE(pending_id)` |
| Hết hạn | Timer Temporal → activity ghi void, **hoặc** mở case đối soát (02 §7.3: không tự hoàn) | Hoặc job ghi void (thêm thành phần), hoặc truy vấn coi `expires_at < now()` là void → **số dư thay đổi mà không có lần ghi nào**, không tái lập được, mâu thuẫn với "không tự hoàn" ở 02 §7.3 |
| Available balance | `balance(budget:…)` — một SUM | `posted − pending chưa resolve` — anti-join |
| Post hai lần / vừa post vừa void | Tài khoản `reserved:{req}` cấm âm + idempotency key chung `reservation:{req}:resolve` | `UNIQUE(pending_id)` |
| Post một phần (TigerBeetle cho phép, [V] [docs](https://docs.tigerbeetle.com/coding/two-phase-transfers/)) | 1 entry gồm 2 transfer: X → disbursed, phần còn lại → budget | Có sẵn |
| Chỉ INSERT? | Có — mọi thứ đều là bút toán mới | Có — nếu resolution là dòng riêng |

Phương án A giữ một loại bút toán duy nhất (đã ghi sổ) và một cách tính số dư duy nhất, nên hợp với nguyên tắc "thời gian thuộc về Temporal" của ADR-003. Hết hạn VA (FR-PAY-05) **không cần pending trong sổ cái**, vì chưa có tiền nào vào trước khi thanh toán. Vậy pending trong sổ cái chỉ phục vụ giải ngân, và A là đủ.

**Trục C — Số dư: SUM thuần (đề xuất) vs bảng cache**

| | SUM thuần | Bảng cache `account_balances` cập nhật bằng trigger + `CHECK (balance>=0)` |
|---|---|---|
| FR-LED-02 ("không có số dư tự cập nhật ở nơi khác") | Đúng nguyên văn | Lệch nguyên văn (dù là cache dẫn xuất trong cùng transaction) |
| Chỉ INSERT | Giữ được | Bảng mutable → cần hàm `SECURITY DEFINER` để app không có UPDATE |
| Đồng thời | Phải khoá (Q3) | `UPDATE … SET balance = balance + d` tự tuần tự hoá theo dòng; CHECK chặn âm |
| Hiệu năng | Thừa đủ ở khối lượng này (~2 triệu dòng/năm, mỗi tài khoản vài chục dòng) | O(1) |
| Đảo ngược | Thêm cache sau, dựng lại được từ transfers | Bỏ cache dễ |

→ **YAGNI:** chưa cần cache. Chỉ thêm khi đo được truy vấn số dư chậm (ví dụ `platform_cash` có hàng triệu dòng), và lúc đó cache phải dựng lại được và được đối soát hằng ngày.

### 1.2 Phác thảo DDL (mô hình T + A)

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
  idempotency_key text NOT NULL UNIQUE,                 -- xem 1.4
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

Trigger hoãn (chi tiết lý do ở §2, §4):

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

Ghi chú về DDL:
- `ENABLE ALWAYS`: trigger ở trạng thái thường **không bắn** khi `session_replication_role = replica`; trigger `ENABLE ALWAYS` thì bắn bất kể giá trị đó [V] ([ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)). CNPG dùng physical replication nên đặt `ENABLE ALWAYS` không có tác dụng phụ.
- Mỗi entry trigger chạy N+1 lần (mỗi chân một lần, cộng một lần cho entry), phần lớn là lặp. Với N ≤ ~10 và 0,3 lượt ghi/giây thì chi phí không đáng kể. **Không tối ưu trong spike.**

### 1.3 Thao tác nghiệp vụ → bút toán (các tài khoản theo 02 §4)

| Thao tác | Transfer | idempotency_key |
|---|---|---|
| PostDonation | `platform_cash → campaign_received:{c}` | `donation:{provider}:{providerTxnId}` |
| OpenReconciliationCase | `platform_cash → suspense` | `suspense:{provider}:{providerTxnId}` |
| AllocateBudget | `campaign_received:{c} → budget:{p}:{cat}` × N (+ `→ surplus:{c}`) | `allocate:{campaignId}` |
| Reserve | `budget:{p}:{cat} → reserved:{req}` | `reservation:{req}:reserve` |
| PostDisbursement | `reserved:{req} → disbursed:{c}` | `reservation:{req}:resolve` |
| Void (admin xác định chưa chuyển) | `reserved:{req} → budget:{p}:{cat}` | `reservation:{req}:resolve` (**trùng key với post** → post và void loại trừ nhau ở mức UNIQUE) |

*(Chiều nợ/có cụ thể của từng tài khoản và tài khoản nào bị cấm âm do người thiết kế Funds chốt; spike chỉ cần `budget:*` và `reserved:*` bị cấm âm.)*

### 1.4 Idempotency

- **`UNIQUE (journal_entries.idempotency_key)`**. Key được suy ra từ **danh tính nghiệp vụ** (mã giao dịch của nhà cung cấp, requestId + bước), không lấy từ attempt của activity hay `RunID` (RunID đổi khi continue-as-new hoặc reset). Cách này khớp C-3 ("ID workflow + bước"); dùng workflow ID cũng được vì nó tất định.
- Ghi bằng `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. `DO NOTHING` chỉ cần quyền INSERT (cộng SELECT trên cột conflict target); `DO UPDATE` mới cần quyền UPDATE [V] ([INSERT](https://www.postgresql.org/docs/18/sql-insert.html)). Dòng bị bỏ qua **không được trả về** [V] → sqlc `:one` trả `pgx.ErrNoRows` → khi đó `SELECT` entry hiện có, **so `request_hash`**: trùng thì trả kết quả cũ (idempotent); khác thì báo lỗi `ErrIdempotencyConflict`, vì đây là bug chứ không phải retry.
- Hai lần gửi đồng thời cùng key: lần thứ hai chờ ở unique index cho tới khi lần thứ nhất kết thúc. Nếu lần thứ nhất bị rollback (ví dụ trigger hoãn từ chối) thì lần thứ hai được insert. Đây là hành vi mong muốn; spike nên có 1 test cho trường hợp này. **[S]**
- Reserve bị từ chối vì thiếu ngân sách thì **không để lại** key (đã rollback). Gọi lại sẽ đánh giá lại; điều này chấp nhận được vì Temporal đã ghi kết quả "thiếu" vào history nên không gọi lại.
- `provider_events`: `UNIQUE (provider, provider_txn_id)` (BR-08). Thuộc Q4, chỉ nhắc ở đây.

### 1.5 `uuidv7()` (PG18)

- `uuidv7([shift interval])` sinh UUID v7 có thứ tự thời gian [V] ([UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)). Lợi ích: khoá chính tăng dần → B-tree ít phân mảnh, index `id` gần thứ tự chèn.
- **Không** dùng làm thời điểm nghiệp vụ: docs ghi rõ `uuid_extract_timestamp` "không nhất thiết bằng đúng" thời điểm sinh [V] → giữ cột `created_at`.
- **Không** dùng làm khoá chống trùng: id sinh trong DB khác nhau ở mỗi attempt. Chống trùng dựa vào `idempotency_key`.
- Tính đơn điệu trong cùng một backend: docs không nêu → *(unverified)*. Không phụ thuộc vào tính chất này.
- **Rủi ro sqlc:** catalog tĩnh của sqlc có thể không biết `uuidv7()`. Code search trên repo sqlc chỉ thấy `uuidv7` trong engine duckdb/clickhouse, không thấy trong postgresql; tuy vậy GitHub có thể không index file catalog lớn → *(unverified)*. Cách giảm rủi ro: chỉ dùng `uuidv7()` trong `DEFAULT` của DDL, không gọi trong query; nếu vẫn lỗi thì bật database-backed analysis (`database: { uri: … }` hoặc `managed: true`) trỏ vào PG18 [V] ([sqlc generate](https://docs.sqlc.dev/en/latest/howto/generate.html)), hoặc thử experiment `analyzerv2` (v1.31.0) [V] (release notes). **Spike phải kiểm.**

---

## 2. Q1 — Ép tính đúng của bút toán bằng trigger hoãn

### 2.1 Cơ chế (đã kiểm chứng trên docs PG18)

- Constraint trigger **bắt buộc** là `AFTER` và `FOR EACH ROW`, trên bảng thường [V] ([CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)).
- **Không dùng được transition table** (`REFERENCING`) cho constraint trigger [V]. Trigger statement-level có transition table thì lại không hoãn được. → Phương án hoãn duy nhất là **row-level constraint trigger**, chạy lại truy vấn trên entry ở mỗi lần bắn.
- `DEFERRABLE INITIALLY DEFERRED`: trigger bắn ở cuối transaction; `SET CONSTRAINTS` có thể ép bắn sớm [V].
- Điều kiện `WHEN` của constraint trigger được đánh giá **ngay lúc ghi**, không hoãn [V] → **không dùng `WHEN`** (nếu không sẽ có kiểm tra bị bỏ qua dựa trên trạng thái chưa hoàn chỉnh).
- `CREATE OR REPLACE` không áp dụng được cho constraint trigger [V] → migration phải `DROP TRIGGER` rồi `CREATE` (goose down/up).
- Trạng thái enable của trigger hoãn được xét **lúc sự kiện xảy ra**, không phải lúc hàm chạy [V] ([ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)).

### 2.2 Với mô hình T thì trigger kiểm tra gì

| Bất biến | Ở đâu | Vì sao cần hoãn |
|---|---|---|
| Mỗi transfer tự cân | `CHECK` (ngay lập tức) | Không cần hoãn |
| Entry có đủ `transfer_count` chân (không rỗng, không thiếu, không bị thêm chân vào entry cũ ở transaction sau) | Trigger hoãn trên cả `journal_entries` và `transfers` | Các chân được insert bằng nhiều câu lệnh |
| Tài khoản bị cấm âm không âm (kèm khoá, §4) | Trigger hoãn | Trạng thái trung gian trong transaction được phép lệch; chỉ trạng thái cuối mới đáng kể |
| *(Nếu chọn mô hình P)* `SUM(amount)=0` mỗi entry | Trigger hoãn | Như trên |

### 2.3 Cạm bẫy

| Cạm bẫy | Thực tế | Biện pháp |
|---|---|---|
| `SET CONSTRAINTS … IMMEDIATE` | **Không phải đường vòng.** Kiểm tra vẫn chạy, chỉ sớm hơn: ngay lúc `SET` và áp dụng hồi tố; vi phạm thì lệnh `SET` lỗi [V] ([SET CONSTRAINTS](https://www.postgresql.org/docs/18/sql-set-constraints.html)). Rủi ro duy nhất là báo lỗi giả nếu gọi giữa chừng một entry | Code không gọi lệnh này; test ghi lại hành vi |
| `SET CONSTRAINTS ALL DEFERRED` | Không hoãn được qua COMMIT | — |
| `session_replication_role = replica` | Trigger thường không bắn, **FK cũng tắt**. Chỉ superuser hoặc role được cấp quyền `SET` trên tham số này mới đặt được [V] ([runtime-config-client](https://www.postgresql.org/docs/18/runtime-config-client.html)) | App không phải superuser, không cấp `SET`; thêm `ENABLE ALWAYS` |
| `ALTER TABLE … DISABLE TRIGGER` / `DROP TRIGGER` | Phải là **owner** của bảng [V] | App ≠ owner (§3) |
| Superuser | Vượt được mọi lớp | Ngoài mô hình đe doạ; dựa vào audit/PITR. Service không bao giờ kết nối bằng superuser, kể cả user `postgres` hay `app` mặc định của CNPG |
| `COPY FROM` / batch | Trigger hàng vẫn bắn với COPY *(theo docs COPY, chưa trích lại — [COPY](https://www.postgresql.org/docs/18/sql-copy.html))* | Không cần xử lý thêm |
| Hiệu năng | Kiểm tra lặp N+1 lần mỗi entry; hàng đợi sự kiện trigger hoãn nằm trong bộ nhớ backend *(unverified chi tiết)* | Không đáng kể ở 0,3 lượt ghi/giây; không benchmark |
| Hàm `SECURITY DEFINER` | Rủi ro search_path | `SET search_path = ledger, pg_catalog, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC` ([CREATE FUNCTION — Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/18/sql-createfunction.html)) |

### 2.4 Spike phải chứng minh (Q1)

Mỗi mục là một test Go chạy bằng role `funds_app` trên PG18 thật (testcontainers hoặc cluster kind):

1. Go cố tình ghi entry khai `transfer_count=2` nhưng chỉ insert 1 chân → `Commit` lỗi `23514`, `ConstraintName="ledger_entry_complete"`; DB không còn dòng nào của entry đó.
2. Entry không có chân nào → bị từ chối, nhờ trigger trên `journal_entries`.
3. Ở transaction sau, thêm một chân vào entry đã commit → bị từ chối.
4. Ghi các chân bằng **nhiều câu lệnh riêng** trong cùng transaction → thành công. Test này chứng minh việc hoãn thật sự cần thiết.
5. `amount <= 0` hoặc `debit = credit` → lỗi **ngay tại câu lệnh** (`23514` từ CHECK), không đợi tới COMMIT.
6. `SET CONSTRAINTS ALL IMMEDIATE` sau chân đầu tiên của entry 2 chân → lệnh `SET` lỗi (ghi lại hành vi).
7. App thử `SET session_replication_role = replica` → `42501`. App thử `ALTER TABLE … DISABLE TRIGGER` hoặc `DROP TRIGGER` → `42501` (không phải owner).
8. *(Nếu chọn mô hình P)* entry lệch 100/90 → `ledger_entry_balanced`.

---

## 3. Q2 — Quyền chỉ INSERT, pgx v5 và sqlc

### 3.1 Thiết kế role và quyền

| Role | LOGIN | Sở hữu | Quyền trên `ledger.*` |
|---|---|---|---|
| `funds_owner` | Không | schema, bảng, hàm, trigger | Toàn quyền (vì là owner) |
| `funds_migrator` | Có | — (member của `funds_owner`, goose chạy `SET ROLE`) | Kế thừa từ owner |
| `funds_app` | Có | Không sở hữu gì | `USAGE` trên schema; `SELECT, INSERT` trên `accounts`, `journal_entries`, `transfers`. **Không có** UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |

Lý do:
- Owner luôn được coi là nắm mọi grant option, nên **luôn tự cấp lại được** quyền đã thu hồi; quyền sửa/xoá đối tượng gắn với việc sở hữu, không thu hồi được [V] ([Privileges](https://www.postgresql.org/docs/18/ddl-priv.html)). → `REVOKE UPDATE` trên chính owner là vô nghĩa; **bắt buộc tách owner và app**.
- `TRUNCATE` là quyền riêng, khác `DELETE`; PG17+ có thêm quyền `MAINTAIN` (cho `LOCK TABLE`, VACUUM, …) [V] (cùng URL).
- Không cấp các predefined role `pg_write_all_data` (tương đương INSERT/UPDATE/DELETE trên mọi bảng) hay `pg_maintain` cho `funds_app` [V] ([Predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)).
- `SELECT … FOR UPDATE` đòi **quyền UPDATE trên ít nhất một cột** của bảng bị khoá [V] ([SELECT](https://www.postgresql.org/docs/18/sql-select.html)). Đây là điểm va chạm giữa Q2 và Q3: app chỉ có INSERT thì **không tự khoá được** dòng `accounts`. Lời giải đề xuất là đặt việc khoá trong hàm trigger `SECURITY DEFINER` của owner (§4). Hai lời giải khác: cấp `UPDATE (một_cột_vô_hại)` theo cột, hoặc dùng advisory lock.
- `ON CONFLICT DO UPDATE` cần quyền UPDATE [V] → app chỉ dùng được `DO NOTHING`. Đây là ràng buộc có lợi: không ai upsert nhầm vào sổ cái.
- Các bảng nghiệp vụ mutable (`disbursements`, `reconciliation_cases`, …) nằm ở schema riêng (`funds`), cấp quyền bình thường. Ranh giới chỉ-INSERT trùng với ranh giới schema `ledger`, nên CI có thể kiểm tra theo schema.
- **CloudNativePG:** bootstrap `initdb` mặc định tạo database `app` thuộc **owner `app`** [V] ([CNPG bootstrap](https://cloudnative-pg.io/docs/1.30/bootstrap/)). Nếu service kết nối bằng user mặc định này thì nó *là owner* và toàn bộ Q2 mất tác dụng. Role khai báo qua `spec.managed.roles` [V] ([CNPG roles](https://cloudnative-pg.io/docs/1.30/declarative_role_management/)); GRANT trên bảng **không** do operator quản lý (docs không đề cập) → GRANT nằm trong migration goose hoặc `postInitApplicationSQL`. **Ngoài phạm vi spike**, nhưng phải ghi vào kết quả để không bị quên khi dựng Funds.

### 3.2 Lỗi trigger hoãn đi về Go như thế nào (pgx v5)

- `(*dbTx).Commit` chạy `commit`. Nếu server trả lỗi thì **trả nguyên lỗi** đó (`*pgconn.PgError`). Nếu server trả command tag `ROLLBACK` (transaction đã hỏng từ trước) thì trả `pgx.ErrTxCommitRollback` [V] ([tx.go](https://github.com/jackc/pgx/blob/master/tx.go)).
- `PgError` có các trường `Code`, `Message`, `Detail`, `ConstraintName`, `TableName`, `SchemaName`, …; `Error()` có dạng `"ERROR: … (SQLSTATE 23514)"` [V] ([pgconn/errors.go](https://github.com/jackc/pgx/blob/master/pgconn/errors.go)).
- PL/pgSQL cho phép `RAISE … USING ERRCODE = …, CONSTRAINT = …, TABLE = …`. Mặc định là `P0001`. SQLSTATE tự đặt được phép nhưng nên tránh mã kết thúc bằng `000` [V] ([PL/pgSQL errors](https://www.postgresql.org/docs/18/plpgsql-errors-and-messages.html)). **Đề xuất dùng `check_violation` (23514) + `CONSTRAINT`:** thuộc lớp 23 (integrity violation), công cụ chung đều coi là lỗi không retry, và Go phân biệt các loại qua `pgErr.ConstraintName` mà không phải tự đặt lớp SQLSTATE riêng.
- Sau khi COMMIT lỗi, server ở trạng thái idle; pgx chỉ đóng kết nối khi `TxStatus() != 'I'` → kết nối được trả về pool và dùng tiếp **[S]** (suy từ source; spike kiểm bằng pool `MaxConns=1`).
- Bảng phân loại cho activity Temporal:

| Lỗi | Phân loại |
|---|---|
| `23514` + `ledger_account_nonnegative` | Kết quả nghiệp vụ (`Insufficient`) → `Reserve` trả kết quả, **không** trả lỗi |
| `23514` khác, `23505` khác `idempotency_key`, `ErrIdempotencyConflict` | `NonRetryable` (bug) |
| `40001`, `40P01`, lỗi mạng, `pgconn.SafeToRetry` | Retryable (Temporal retry) |
| `ErrTxCommitRollback` | Bug (lỗi trước đó bị nuốt) → NonRetryable + log |

### 3.3 sqlc: liên quan gì và giới hạn nào đáng kể

- sqlc **không bọc `Commit`**. Code sinh ra chỉ chạy query qua `DBTX`; transaction là `pgx.Tx` do mình mở rồi gọi `queries.WithTx(tx)` [V] ([sqlc transactions](https://docs.sqlc.dev/en/latest/howto/transactions.html)). → "sqlc có xử lý lỗi COMMIT không" không phải câu hỏi đúng; câu hỏi đúng là hàm `ledger.Post` trong Go có kiểm lỗi của `tx.Commit` hay không. Bật `errcheck` để bắt chỗ quên kiểm. Cạm bẫy kinh điển: `defer tx.Rollback(ctx)` cộng `return tx.Commit(ctx)` là đúng; `tx.Commit(ctx)` không kiểm giá trị trả về là mất tiền im lặng.
- `pgx/v5` qua `sql_package: "pgx/v5"` [V] ([sqlc + pgx](https://docs.sqlc.dev/en/latest/guides/using-go-and-pgx.html)).
- sqlc không thấy trigger (trigger nằm ngoài phạm vi phân tích query) — không ảnh hưởng gì.
- `ON CONFLICT DO NOTHING RETURNING` với `:one` → `pgx.ErrNoRows` khi trùng (xem 1.4). Phải xử lý tường minh.
- Insert nhiều chân: `:copyfrom` **không hỗ trợ `RETURNING`** (issue #4165 còn mở — [sqlc#4165](https://github.com/sqlc-dev/sqlc/issues/4165)). Đề xuất `INSERT … SELECT unnest(@debits::uuid[]), unnest(@credits::uuid[]), unnest(@amounts::bigint[])` (sqlc hỗ trợ tham số mảng với pgx) hoặc `:batchexec`. *(Khả năng sqlc suy kiểu đúng cho `unnest` nhiều mảng: unverified → spike kiểm.)*
- CTE ghi dữ liệu (insert entry và transfers trong một câu lệnh) được sqlc hỗ trợ, nhưng không cần thiết. Hai câu lệnh trong một transaction rõ ràng hơn, và đằng nào trigger hoãn cũng chạy ở COMMIT.
- Rủi ro catalog/parser của sqlc với cú pháp PG18 (`uuidv7()`, `CREATE CONSTRAINT TRIGGER`, thân hàm plpgsql trong file migration goose) → *(unverified)*. Spike chạy `sqlc generate` trên chính các file migration đó; nếu lỗi thì bật database-backed analysis.

### 3.4 Spike phải chứng minh (Q2)

1. Bằng `funds_app`: `UPDATE`, `DELETE`, `TRUNCATE` trên `transfers`, `journal_entries`, `accounts` → `42501`. `ON CONFLICT DO UPDATE` → `42501`. `SELECT … FOR UPDATE` trên `accounts` → `42501` (ghi lại lý do khoá phải nằm trong trigger).
2. Test catalog chạy trong CI: `has_table_privilege('funds_app', t, p)` = false với mọi t ∈ `ledger.*`, p ∈ {UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN}; `funds_app` không sở hữu đối tượng nào và không là member của `funds_owner`, `pg_write_all_data`.
3. Bằng `funds_owner`: `UPDATE transfers` → lỗi từ `forbid_mutation` (chứng minh lưới an toàn).
4. `sqlc generate` (v1.31.x) thành công trên migration chứa `uuidv7()` + constraint trigger; ghi lại có cần `database:` hay không.
5. Commit của entry sai → `errors.As(err, &pgErr)`, `pgErr.Code == "23514"`, `pgErr.ConstraintName` đúng tên. Một câu lệnh lỗi trước đó (cố tình nuốt lỗi) rồi Commit → `errors.Is(err, pgx.ErrTxCommitRollback)`.
6. Pool `MaxConns=1`: sau một COMMIT lỗi, transaction kế tiếp chạy được.
7. Idempotency: ghi cùng key hai lần → một entry, lần hai trả cùng `id`. Cùng key nhưng khác nội dung → `ErrIdempotencyConflict`.

---

## 4. Q3 — Hai lần `Reserve` đồng thời có chi vượt ngân sách được không

### 4.1 Vì sao có race

Kịch bản "kiểm tra rồi ghi" (SUM ≥ amount → INSERT) ở READ COMMITTED: hai transaction cùng đọc số dư cũ và cùng ghi → ngân sách âm (write skew). Kiểm tra trong trigger hoãn **mà không khoá** vẫn race: hai lần COMMIT chạy song song, trigger của mỗi bên không thấy dữ liệu chưa commit của bên kia.

### 4.2 So sánh các phương án

| Phương án | DB tự bảo vệ khi Go sai? | Quyền cần | Nhạy với isolation | Retry | FR-LED-02 / chỉ INSERT | Độ phức tạp |
|---|---|---|---|---|---|---|
| **a. `FOR UPDATE` trên `accounts`, đặt trong Go**, rồi SUM ở câu lệnh tiếp theo | **Không** — chỉ đúng khi mọi đường ghi đều khoá | UPDATE trên ≥1 cột `accounts` [V] | RC: đúng, vì mỗi câu lệnh lấy snapshot mới. **RR: sai** — snapshot cố định từ trước khi chờ khoá; dòng chỉ bị khoá chứ không bị UPDATE nên không có lỗi 40001 **[S]** | Không (deadlock nếu thứ tự khoá lệch) | Giữ được | Thấp |
| **b. `FOR UPDATE` trong trigger hoãn `SECURITY DEFINER`** (đề xuất) | **Có** — mọi INSERT vào `transfers` đều kích hoạt | Không cần cấp thêm cho app | Như (a); trigger **từ chối RR** để đóng lỗ hổng | Chỉ khi `40P01` (hiếm; khoá theo thứ tự id) | Giữ được | Thấp–trung bình; logic nằm trong SQL |
| c. `SERIALIZABLE` + retry | Có, nhưng **chỉ giữa các transaction cùng SERIALIZABLE** — một đường ghi RC là đủ để thủng | Không | Phải ép mọi transaction ghi sổ dùng SERIALIZABLE | **Bắt buộc** retry 40001 cho mọi transaction [V] ([Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)); có thể báo lỗi giả do predicate lock | Giữ được | Trung bình; khó lập luận và khó test tất định |
| d. `pg_advisory_xact_lock(hash(account_id))` | Chỉ khi đặt trong trigger (như b) | Không cần quyền | Như (a) | Như (a) | Giữ được | Thấp; trùng hash chỉ làm tuần tự hoá thừa. Không gắn với dòng thật; thua (b) về khả năng quan sát |
| e. Bảng cache số dư + `CHECK (balance >= 0)` | **Có** — mạnh nhất, CHECK chạy ngay | Hàm `SECURITY DEFINER` (app không UPDATE) | Ít nhạy hơn (UPDATE tạo xung đột thật) | Không | **Lệch FR-LED-02** + bảng mutable | Trung bình; cache phải đối soát |

**Đề xuất: (b).** Lý do:
1. "Tiền đúng tuyệt đối" (NFR-01) cộng với tinh thần của Q1 (DB chặn cả khi Go sai) → bất biến "không âm" phải nằm **trong DB**, không chỉ nằm trong quy ước của code Go.
2. Giải quyết luôn va chạm với Q2: app không cần quyền UPDATE.
3. Khoá chỉ giữ trong khoảng ngắn từ lúc trigger chạy tới khi COMMIT xong. Ở 0,3 lượt ghi/giây thì gần như không có tranh chấp.
4. Đảo ngược dễ: chuyển sang (e) chỉ là thêm một bảng và một trigger, không đổi API Go.
- Điều kiện kèm theo: ghi sổ ở **READ COMMITTED** (mặc định của PG/pgx); trigger từ chối RR; quy ước **một journal entry cho mỗi transaction** để thứ tự khoá luôn nhất quán (nhiều entry trong một transaction có thể gây `40P01`; nếu xảy ra thì retry được).
- Cơ sở cho "câu lệnh sau khi khoá thấy dữ liệu mới": hàm `VOLATILE` lấy snapshot mới cho **mỗi câu lệnh** nó chạy [V] ([Function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html)); ở READ COMMITTED snapshot đó gồm các transaction đã commit [V] ([Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)). Khoá theo đúng thứ tự `ORDER BY` khi dùng `FOR UPDATE`: **[S]** (suy từ ghi chú của docs SELECT về việc khoá diễn ra sau sắp xếp) → spike kiểm bằng test deadlock.
- Hướng (a) có thể **bổ sung** sau để có thông báo sớm hơn, nhưng không phải tuyến bảo vệ chính.

### 4.3 Test đồng thời chứng minh (Q3)

**Test chính — `TestReserveNoOverspend`:**
- Chuẩn bị: mỗi vòng tạo tài khoản mới `budget:X` có số dư B = 1.000.000 VND (qua một entry nạp); mỗi `Reserve` lấy A = 100.000 → sức chứa đúng 10.
- **N = 50 goroutine**, mỗi goroutine một `requestId` và một idempotency key riêng. `pgxpool` **`MaxConns = 50`** đặt tường minh: nếu để mặc định thì pool nhỏ (khoảng max(4, NumCPU) — *theo docs pgxpool, chưa trích lại*), tự tuần tự hoá và test pass "giả". PG `max_connections` ≥ 60. Dùng barrier (`close(start)`) để mọi goroutine cùng bắt đầu.
- Khẳng định:
  - đúng **10** thành công; **40** lỗi đều thoả `errors.Is(err, ledger.ErrInsufficientFunds)` (ánh xạ từ `23514` + `ledger_account_nonnegative`); **0** lỗi loại khác (`40P01` nếu có thì retry và được đếm riêng, kỳ vọng 0);
  - `balance(budget:X) == 0`; `Σ balance(reserved:*) == B`; mỗi request thành công có đúng 1 entry; `count(transfers)` khớp.
- Lặp **50 vòng** (2.500 lần `Reserve` đồng thời), chạy với `go test -race -count=1`.
- Biến thể: số tiền ngẫu nhiên trong [1, B/5] → khẳng định `balance ≥ 0` và tổng tiền bảo toàn (không khẳng định số lần thành công).

**Negative control (bắt buộc — chứng minh test bắt được bug):**
- NC-1: schema biến thể **chỉ dùng cho test** — hàm trigger bỏ `FOR UPDATE` và thêm `pg_sleep(0.05)` sau bước SUM để mở rộng cửa sổ race → test chính phải **FAIL** (thành công > 10) ở ít nhất một vòng. Không bao giờ đưa công tắc bỏ khoá vào SQL production.
- NC-2: chạy một `Reserve` trong transaction `REPEATABLE READ` → bị từ chối với `ledger_isolation`.

**Phụ:**
- Deadlock: 20 goroutine ghi các entry chạm cả {X, Y}, một nửa insert theo thứ tự X→Y, nửa kia Y→X → 0 lỗi `40P01` (chứng minh khoá theo id).
- `Reserve` và `Void` đồng thời trên cùng budget → số dư cuối đúng.
- Idempotency đồng thời (giao với Q5): 20 goroutine cùng một key → 1 entry, tất cả nhận cùng `entry_id`.

---

## 5. Throwaway hay skeleton

**Đồng ý throwaway-but-harvest**, và chia rõ phần nào giữ:
- **Giữ (viết ở chất lượng production ngay từ spike):** file migration goose cho `ledger` (bảng, trigger, hàm), bootstrap role và GRANT, danh sách kịch bản test kèm các assert ở §2.4/§3.4/§4.3, bảng phân loại lỗi §3.2. Đây là phần **cửa một chiều** (schema của dữ liệu tiền, chỉ thêm, sửa về sau rất đắt), nên chất lượng phải đạt ngay. Nó cũng không phụ thuộc vào bố cục repo.
- **Bỏ:** code Go (package `ledger`, harness test, cấu hình sqlc). Lý do: bố cục `libs/`, `proto/` và vòng lặp phát triển (S-8) chưa chốt; spike chứa schema biến thể chỉ dùng cho negative control, những thứ không được lọt vào production; API của `ledger.Post` nên thiết kế lại cùng service Funds sau khi biết hình dạng activity (Q4–Q6).
- Rủi ro của throwaway: viết lại test đồng thời mất khoảng nửa ngày. Đổi lại, tránh được việc kéo theo cấu trúc tạm vào code thật. Đáng.

---

## 6. Không kiểm trong spike này (YAGNI)

- Benchmark hay tải: khối lượng thiết kế 0,3 lượt ghi/giây; chỉ cần test đồng thời về tính đúng.
- Bảng cache số dư, partition bảng `transfers`, index tối ưu thêm.
- `SERIALIZABLE` và advisory lock như phương án triển khai: chỉ thử nếu (b) thất bại.
- Hết hạn pending trong DB (kiểu timeout của TigerBeetle): thời gian thuộc Temporal.
- Post một phần, nhiều tiền tệ, `allow_negative` cho tài khoản kiểu nợ: chỉ mô hình hoá, không test sâu.
- Cấu hình role và GRANT qua CNPG `managed.roles` trên kind: spike dùng PG18 qua testcontainers/docker; ghi chú lại để làm khi dựng Funds.
- RLS, audit_log, PITR, đối soát hằng ngày, sao kê và báo cáo, chiến lược `ON DELETE` của FK (ngoài một assert "không CASCADE").
- So sánh mô hình P và T bằng code: chọn một mô hình trên giấy, spike chỉ cài một mô hình.
- TigerBeetle thật, event sourcing, logical replication.

---

## 7. Danh sách điều chưa kiểm chứng

| Điều | Trạng thái | Spike kiểm ở |
|---|---|---|
| Catalog/parser tĩnh của sqlc biết `uuidv7()`, `CREATE CONSTRAINT TRIGGER`, plpgsql trong migration | *(unverified)* | §3.4-4 |
| sqlc suy kiểu `unnest` nhiều mảng với pgx/v5 | *(unverified)* | §3.4 |
| `uuidv7()` đơn điệu trong cùng backend | *(unverified)* — docs không nêu; thiết kế không phụ thuộc | — |
| pgx giữ kết nối sau khi COMMIT lỗi | [S] từ source `tx.go` | §3.4-6 |
| RR + `FOR UPDATE` trên dòng chỉ bị khoá (không bị UPDATE) không báo 40001 → snapshot cũ | [S] | §4.3 NC-2 |
| `FOR UPDATE … ORDER BY` khoá theo thứ tự đã sắp | [S] | §4.3 test deadlock |
| COPY FROM kích hoạt trigger hàng; quyền EXECUTE của hàm trigger không bị kiểm lúc trigger bắn | *(unverified trong phiên này)* | Không cần cho spike |
| Mặc định `CONNECT` trên database cấp cho PUBLIC; mặc định `MaxConns` của pgxpool | *(theo hiểu biết, chưa trích lại)* | Test catalog / cấu hình tường minh |
