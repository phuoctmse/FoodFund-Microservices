# Spike S-2 + S-3 (luồng tiền) — Thiết kế bổ sung: thực hành kỹ năng

- **Trạng thái:** Đã duyệt thiết kế — 2026-10-15 (chủ dự án duyệt từng phần trong phiên brainstorming)
- **Bổ sung cho:** [thiết kế spike luồng tiền](./2026-10-11-s2-s3-money-flow-design.md). Mọi quyết định D-1…D-13 giữ nguyên, trừ chỗ ghi rõ ở §2.
- **Người thực hiện:** chủ dự án tự làm toàn bộ, kể cả code; Claude làm mentor.

---

## 1. Mục đích

Chủ dự án giữ hướng Software Engineer, đồng thời muốn thực hành **thực chiến** các kỹ năng dưới đây trên chính hệ thống FoodFund. Bảng sau ghi mỗi kỹ năng được thực hành ở đâu.

| Kỹ năng | Thực hành ở |
|---|---|
| Cloud, hệ phân tán, kiến trúc hạ tầng | Giai đoạn A–C (Temporal, chống trùng, retry, saga) · E (deploy lên k8s) · H (đo trên hệ thống phân tán thật) |
| Độ trễ, khả năng mở rộng, nút thắt hiệu năng | Giai đoạn H |
| Ngôn ngữ kiểm thử tự động: Python | Giai đoạn F (pytest), G (script tấn công) |
| Kiểm thử API và database ở backend | A–C (Go, PG thật) · F (Python, từ bên ngoài vào) |
| Pen test | Giai đoạn G |
| Tư duy phân tích, chia nhỏ hệ thống phức tạp | Thói quen ở mọi task (§3) · threat model (G) · phân tích nút thắt (H) |
| Dùng AI agent và công cụ AI hỗ trợ kiểm thử | Thói quen ở mọi task (§3) |
| Server OS, k8s | Giai đoạn E, H · sau này: spike S-7 phần 2 (VPS kubeadm) |
| Playwright | **Để sau**, khi có giao diện React (spike chưa có UI) |
| Java, Selenium | **Bỏ**: không có chỗ dùng tự nhiên trong FoodFund (Go + Python) |

---

## 2. Quyết định

| # | Quyết định | Lý do ngắn |
|---|---|---|
| D-14 | **Tự mò hoàn toàn.** Plan không chứa code: không harness, không test mẫu, không chữ ký hàm Go. Plan chỉ ghi mục tiêu, những gì đã chốt trong thiết kế, tên test và điều kiện đạt, tài liệu nên đọc, bẫy cần tránh (chỉ nêu bẫy, không nêu cách giải). API Go do chủ dự án tự thiết kế, ghi vào `spikes/money-flow/NOTES.md` | Mục tiêu học và làm chủ code |
| D-15 | **Mentor:** không viết code trừ khi được yêu cầu rõ; gợi ý theo bậc "gợi ý 1/2/3"; review cuối mỗi task theo ba mức *phải sửa / nên sửa / để ý* | Giữ quyền làm chủ cho người học |
| D-16 | **Hai thói quen ở mọi task:** phân tích trước khi code, và dùng AI agent hỗ trợ kiểm thử (§3) | Kỹ năng thói quen cần lặp lại, không học một lần là xong |
| D-17 | **Ba kỹ năng cần hệ thống hoàn chỉnh thành giai đoạn riêng sau C:** F (test API), G (pen test), H (hiệu năng). Giai đoạn E (deploy) đứng trước làm nền | Giữ cổng quyết định Q1–Q6 đúng hạn; có mục tiêu thật để kiểm thử và tấn công |
| D-18 | **Giai đoạn E–H chạy trên cluster kind `foodfund`.** Câu "Không dùng kind" ở thiết kế §3 chỉ còn áp dụng cho A–D | Phép đo Q7 và hiệu năng chỉ có ý nghĩa trên Temporal thật ([báo cáo Temporal §4.3](./s2-s3-panel/02-temporal.md#43-spike-cần-đo-gì--nửa-ngày)); thực hành k8s |
| D-19 | **Thêm Funds API mỏng** có đặc tả OpenAPI 3.0; header `Idempotency-Key` dùng làm `UpdateID` (D-4) | Muốn test API thì phải có API; khớp T-1 |
| D-20 | **Bộ test API:** Python, pytest + httpx + psycopg 3 + schemathesis, quản lý bằng `uv` | Python trong danh sách kỹ năng; schemathesis sinh test từ OpenAPI |
| D-21 | **Pen test chỉ trong phạm vi cluster kind trên laptop.** Theo OWASP API Security Top 10 (2023) và OWASP WSTG; chấm mức độ bằng CVSS 4.0 | Hệ thống của chính chủ dự án; không đụng dịch vụ bên ngoài |
| D-22 | **Hiệu năng:** k6 ở chế độ cố định số request mỗi giây (`constant-arrival-rate`), SLO viết bằng `thresholds`; metrics và trace gửi lên Grafana Cloud bản miễn phí qua Alloy (dự phòng: Prometheus local) | Chế độ "chờ phản hồi" làm số đo độ trễ thấp hơn thực tế (*coordinated omission*); khớp T-14; tiết kiệm RAM |
| D-23 | **Đáp án ẩn:** mentor giữ riêng danh sách lỗ hổng và nút thắt dự đoán, không ghi vào plan; chỉ đem ra so sau khi chủ dự án nộp báo cáo G và H | "Tự mò" chỉ có nghĩa khi không có đáp án sẵn |
| D-24 | **Thời lượng khoảng 40 ngày công** (§8), giữ đủ phạm vi | Chủ dự án chấp nhận |

---

## 3. Thói quen ở mọi task

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

## 4. Giai đoạn E — Funds API và deploy lên kind

### 4.1 Funds API

Một tiến trình HTTP chung với webhook (cùng image, cùng Deployment). Actor vẫn đi trong body (thiết kế §3: Keycloak/JWT ngoài phạm vi).

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

### 4.2 Deploy

Manifest viết tay (được dùng kustomize, không dùng Helm) ở `spikes/money-flow/deploy/`:
- **Database:** cluster CloudNativePG riêng cho `funds` (PostgreSQL 18.6). Role `funds_owner`, `funds_migrator`, `funds_app`, `funds_qa` khai báo qua `spec.managed.roles`. `funds_qa` chỉ có `SELECT`, dùng cho bộ test Python. **Không** dùng user `app` mặc định của CNPG, vì user đó là owner ([báo cáo ledger §3.1](./s2-s3-panel/01-ledger-postgres.md#31-thiết-kế-role-và-quyền)).
- **Migration:** `Job` chạy goose bằng `funds_migrator`.
- **Ứng dụng:** `Deployment` cho webhook + API; `Deployment` riêng cho worker. Image build bằng Docker, nạp vào cluster bằng `kind load docker-image`.
- **Temporal:** dùng Temporal của cluster (S-9); namespace `moneyflow` với retention đặt rõ.
- **Mạng:** `HTTPRoute` qua Traefik cho `/webhooks/sepay` và `/disbursements`, `/accounts`; NetworkPolicy.
- **Cấu hình:** Secret cho DSN và khoá HMAC; probe; requests/limits.

**Đạt khi:** dựng từ đầu bằng một lệnh và mọi pod Ready; đi hết một saga bằng `curl` qua Traefik; `ledger_audit.sql` sạch trên DB của cluster; ghi lại thời gian dựng và RAM tăng thêm.

---

## 5. Giai đoạn F — Bộ test API bằng Python

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
- Có ít nhất một test "phải FAIL" khi tắt một cơ chế bảo vệ (theo tinh thần thiết kế §8.1).

---

## 6. Giai đoạn G — Pen test

**Luật phạm vi:** chỉ tấn công cluster kind trên laptop. Không quét hay gửi gì tới địa chỉ bên ngoài, kể cả dịch vụ thật của SePay.

**Quy trình:**
1. **Threat model:** sơ đồ luồng dữ liệu, ranh giới tin cậy (internet → Traefik → webhook/API → Temporal → DB), bảng STRIDE.
2. **Do thám:** những gì lộ ra ngoài cluster; những gì gọi được từ bên trong một pod.
3. **Tấn công** năm bề mặt: webhook · Funds API · database · Temporal · Kubernetes.
4. **Báo cáo** `docs/spikes/<ngày>-money-flow-pentest.md`: mỗi lỗ hổng có cách tái hiện, vector CVSS 4.0, hậu quả với tiền, cách sửa.

**Công cụ:** OWASP ZAP (quét theo OpenAPI) · script tấn công Python trong `apitests/attacks/` · kubescape · `psql` · CLI `temporal`.

**Sau báo cáo:** lỗ hổng mức Cao trở lên phải sửa, kèm test hồi quy trong `apitests/`. Mức thấp hơn ghi thành rủi ro đã biết, kèm hướng xử lý khi dựng Funds thật. Mentor so báo cáo với đáp án ẩn (D-23) và ghi tỉ lệ tìm được vào báo cáo.

---

## 7. Giai đoạn H — Hiệu năng

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
5. **Đo Q7** theo [báo cáo Temporal §4.3](./s2-s3-panel/02-temporal.md#43-spike-cần-đo-gì--nửa-ngày).
6. **Thí nghiệm coordinated omission:** cùng một mức tải, chạy kiểu "chờ phản hồi" và kiểu `constant-arrival-rate`, so hai số p95.

**Báo cáo** `docs/spikes/<ngày>-money-flow-performance.md`: SLO, các bậc tải, nút thắt kèm bằng chứng, thay đổi và số đo trước/sau, kết quả Q7. Ghi rõ hạn chế: máy tạo tải chạy chung laptop với cluster, nên số đo chỉ mang tính tương đối.

---

## 8. Lịch và cổng quyết định

Tổng ~40 ngày công (≈ 8 tuần): 0–D ~23, mỗi giai đoạn E–H 4, I 1. Lịch theo task ở [plan](./2026-10-15-s2-s3-money-flow-plan.md#lịch).

- **Cổng D (sau giai đoạn C):** kết luận Q1–Q6, để mở khoá các quyết định kiến trúc đang chờ.
- **Cổng sau mỗi giai đoạn E–H:** ghi kết quả, cùng mentor quyết đi tiếp hay cắt.
- 8 tuần là khoảng 30% quỹ 5–6 tháng của dự án. Phần bù lại: sản phẩm của E–H dùng lại được cho Funds thật (§9).

---

## 9. Phần giữ lại (bổ sung D-13)

Ngoài danh sách ở thiết kế §10:
- `api/openapi.yaml` làm bản nháp cho Funds API thật.
- Manifest deploy, đặc biệt CNPG `managed.roles` và tách role.
- Cấu trúc bộ `apitests/` (fixture, kiểm DB, audit sau mỗi test).
- Script k6, SLO và quy trình đo.
- Checklist pen test và các test hồi quy bảo mật.
- Mục tổng kết AI trong kiểm thử.

## 10. Ngoài phạm vi

Java, Selenium · Playwright (để tới khi có UI) · Keycloak/JWT (pen test ghi nhận hậu quả của việc thiếu xác thực, nhưng không sửa bằng Keycloak trong spike) · S-7 phần 2 (VPS) · HPA và cluster nhiều node · tải lớn mang tính benchmark tuyệt đối.
