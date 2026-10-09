# ADR-001 — Cơ sở dữ liệu: PostgreSQL 18

- **Trạng thái:** Đã chấp nhận — 2026-10-10
- **Người quyết định:** chủ dự án
- **Liên quan:** `docs/rewrite/01-requirements.md` (FR-LED, BR-14, NFR-02, NFR-05, NFR-09), `docs/rewrite/02-decomposition.md` (mục 3), `docs/rewrite/03-tech-stack.md` (T-6)
- **Loại quyết định:** cửa một chiều — đổi engine sau này rất đắt (dữ liệu, SQL, công cụ, các thành phần phụ thuộc).

## Bối cảnh

Hệ thống cần một nơi lưu dữ liệu nghiệp vụ cho 6 service và **sổ cái tiền kép**. Dữ liệu cũ (`seed_data/*.sql`) là dump PostgreSQL 17.7 nhưng chỉ chứa dữ liệu demo (35 user, 15 campaign, 11 donation), nên **không dùng được để lập luận về khối lượng**.

## Quyết định

Dùng **PostgreSQL 18** cho mọi service (mỗi service một database và một user riêng), cho Keycloak và cho engine điều phối quy trình. Lên PostgreSQL 19 sau khi bản này có bản vá đầu tiên.

## Dữ liệu làm căn cứ

| # | Dữ liệu | Kết quả | Nguồn |
|---|---|---|---|
| D1 | Hình dạng dữ liệu (đo từ schema cũ) | 36 bảng, 26 khoá ngoại, 13 ràng buộc UNIQUE, 13 enum, 11 cột `jsonb`, 145 index, bảng partition theo tháng → dữ liệu **quan hệ chặt** kèm một phần bán cấu trúc | `seed_data/*.sql` |
| D2 | Yêu cầu nhất quán | Bút toán nhiều dòng phải ghi nguyên tử và cân bằng; dữ liệu tiền chỉ thêm → cần transaction ACID nhiều câu lệnh và constraint trigger hoãn tới cuối transaction | FR-LED, BR-14; [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) |
| D3 | Khối lượng (mô hình xấu nhất, giả định ghi rõ) | 100 campaign × 2.000 donation/năm × ~10 dòng ≈ 2 triệu dòng/năm; đỉnh ~0,3 lượt ghi/giây → **khối lượng không phân biệt được các lựa chọn** | Giả định, không phải đo |
| D4 | Các thành phần khác cùng hỗ trợ | Keycloak: PostgreSQL 14–18; Temporal: PostgreSQL 12+ (gồm advanced visibility, không cần Elasticsearch); DBOS: chỉ PostgreSQL/SQLite → Postgres là engine **duy nhất** mọi ứng viên đều hỗ trợ → chỉ vận hành một loại database | [Keycloak DB](https://www.keycloak.org/server/db), [Temporal visibility](https://docs.temporal.io/self-hosted-guide/visibility), [DBOS Go](https://github.com/dbos-inc/dbos-transact-golang) |
| D5 | Lịch sử, giấy phép, vòng đời | Hệ thống cũ đã chạy PostgreSQL 17.7 managed; PostgreSQL License, quản trị cộng đồng; PG18 GA 25/09/2025, PG19 beta 4 ngày 24/09/2026 | Header dump; [PG19 beta 4](https://www.postgresql.org/about/news/postgresql-19-beta-4-3386/) |

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| MySQL 8.4 | Không mất D1/D5, nhưng không có phương án DBOS (D4); ràng buộc hoãn tới cuối transaction *(theo hiểu biết, chưa kiểm chứng)* |
| MongoDB | Mất khoá ngoại (D1); Keycloak và Temporal không hỗ trợ (D4); giấy phép SSPL |
| TigerBeetle (dùng một mình) | Chỉ có `accounts`/`transfers`, không lưu được dữ liệu nghiệp vụ; khuyến nghị 6 replica cho production. **Mượn mô hình** chuyển khoản hai pha của nó cho sổ cái trong Postgres |
| SQLite | Keycloak không hỗ trợ (D4); nhiều service ghi đồng thời |
| Distributed SQL (CockroachDB, YugabyteDB) | Không có nhu cầu ghi đa vùng |

## Hệ quả

- **Tích cực:** một công nghệ database để vận hành, backup, nâng cấp; ràng buộc ở mức database bảo vệ tiền ngay cả khi code sai; dùng được `uuidv7()` (PG18) cho khoá chính có thứ tự thời gian.
- **Tiêu cực / phải xử lý ngay:**
  - Một instance là điểm hỏng chung → **bắt buộc có backup khôi phục theo thời điểm (PITR)** từ ngày đầu, hoặc dùng Postgres managed khi deploy demo. Có bài kiểm tra khôi phục định kỳ.
  - Các service dùng chung instance có thể ảnh hưởng nhau về tài nguyên → mỗi service một user, giới hạn kết nối theo user.
- **Ràng buộc thiết kế đi kèm:** sổ cái theo ngữ nghĩa chuyển khoản bất biến và chuyển khoản pending/post/void có hạn (giữ tiền giải ngân, VA hết hạn); số dư tính từ bút toán, không cập nhật trực tiếp.

## Triển khai trên Kubernetes (cập nhật theo [ADR-004](./ADR-004-kubernetes-from-day-one.md))

- Chạy bằng operator **CloudNativePG**; PITR qua backup lên object storage của operator; khôi phục được kiểm tra định kỳ ([CloudNativePG docs](https://cloudnative-pg.io/docs/1.30/)).
- **Không dùng chart/image Bitnami** (ADR-004, luật 1).
- **Rủi ro cần kiểm chứng (spike S-9):** một báo cáo cộng đồng cho biết công cụ quản lý schema của Temporal chỉ có plugin `postgres12`, với PostgreSQL 18 phải chạy schema thủ công bằng `temporal-sql-tool` ([community thread](https://community.temporal.io/t/schema-auto-management-support-for-postgresql-13-in-self-hosted-temporal/19566)). Phương án dự phòng: cluster PostgreSQL 17 riêng cho Temporal.

## Điều kiện để xem lại quyết định

- Xuất hiện yêu cầu ghi đa vùng toàn cầu.
- Xuất hiện nhu cầu phân tích dữ liệu lớn → thêm database phân tích **bên cạnh**, không thay Postgres.
- Spike S-2 cho thấy không ép được tính cân bằng của bút toán trong Postgres một cách đáng tin cậy.
