# Tài liệu FoodFund (bản viết lại)

| File | Nội dung | Đọc khi |
|---|---|---|
| [`01-requirements.md`](./01-requirements.md) | Hệ thống phải làm gì: tác nhân, FR-, BR-, NFR-, phạm vi | Cần biết một quy tắc nghiệp vụ |
| [`02-decomposition.md`](./02-decomposition.md) | Ranh giới service, dữ liệu mỗi service sở hữu, workflow, event, luồng xuyên service | Cần biết việc gì thuộc service nào |
| [`03-tech-stack.md`](./03-tech-stack.md) | Công nghệ cho từng hạng mục (T-1…T-14), bốn quyết định lớn (ADR-001…ADR-004), danh sách spike | Cần biết vì sao chọn một công nghệ |
| [`spikes/money-flow/design.md`](./spikes/money-flow/design.md) | Spike luồng tiền: câu hỏi Q1–Q7, quyết định D-1…D-24, sổ cái, webhook, saga, kiểm thử, giai đoạn E–H | Trước khi bắt đầu một task của spike |
| [`spikes/money-flow/plan.md`](./spikes/money-flow/plan.md) | Kế hoạch theo task (0–27), tên test, bẫy, checkpoint. Không chứa code | Mỗi ngày làm spike |
| [`spikes/money-flow/research.md`](./spikes/money-flow/research.md) | Tư liệu nghiên cứu: DDL, cơ chế PostgreSQL/Temporal kèm nguồn, danh mục kịch bản, bất biến | Mục "Học trước" của plan trỏ tới |
| [`spikes/s4-s7-s9.md`](./spikes/s4-s7-s9.md) | Kết quả spike hạ tầng: RAM, thời gian dựng cluster, Traefik, Temporal trên PG 18 | Cần số đo của cluster kind |
| [`spikes/s4-config/`](./spikes/s4-config/) | Cấu hình cluster kind `foodfund` đã chạy được | Dựng lại cluster |

**Thứ tự đọc lần đầu:** `01` → `02` → `03` (mục 0 Tóm tắt là đủ) → `spikes/money-flow/design.md` → `plan.md`.

**Khi tài liệu mâu thuẫn:** thiết kế spike thắng `01`–`03`. Các chỗ cần sửa trong `01`–`03` nằm ở [thiết kế §12](./spikes/money-flow/design.md#12-đầu-ra), áp dụng khi spike có kết quả.

**Kết quả spike luồng tiền** sẽ nằm cạnh plan: `spikes/money-flow/results.md`, `pentest.md`, `performance.md`.
