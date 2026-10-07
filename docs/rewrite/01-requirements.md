# FoodFund (bản viết lại) — Requirements

> **Trạng thái:** NHÁP v0.1 — 2026-10-07 — chờ chủ dự án trả lời các câu hỏi ở mục 8.
> **Nguồn:** dựng ngược từ hệ thống cũ (`origin/master` @ `84fed04`: 3 Prisma schema, enum trạng thái, service) + tài liệu sản phẩm `.cursor/rules/project.mdc` + kết quả audit.
> **Quy ước:** mục ghi **(suy ra)** là đoán từ code cũ, cần xác nhận. Mã `FR-*` = yêu cầu chức năng, `BR-*` = quy tắc nghiệp vụ, `NFR-*` = phi chức năng, `Q-*` = câu hỏi mở.

Tài liệu này **chỉ mô tả hệ thống phải làm gì**, không chọn kiến trúc hay công nghệ. Thứ tự làm việc: requirements (tài liệu này) → tách hệ thống (`02-decomposition.md`) → chọn kỹ thuật implement (`03-tech-stack.md`).

---

## 1. Tầm nhìn & mục tiêu

FoodFund là nền tảng gây quỹ từ thiện về thực phẩm: kết nối donor, tổ chức gây quỹ, bếp và đội giao hàng, và cho phép **truy vết từng đồng tiền** từ lúc quyên góp đến khi suất ăn được giao.

**Mục tiêu của bản viết lại**

- G-1: Đạt **feature parity** với hệ thống cũ (mục 4), sửa các lỗi thiết kế đã biết.
- G-2: Thêm tính năng mới, trong đó có ít nhất một tính năng AI (mục 4.14).
- G-3: Chất lượng kỹ thuật đủ làm portfolio SE I: có test, CI thật, chạy local được, quyết định thiết kế được ghi lại.

**Ràng buộc:** làm solo, 5–6 tháng; vẫn theo hướng microservices nhưng thiết kế lại ranh giới.

---

## 2. Tác nhân (actors)

| Mã | Vai trò | Mục đích chính |
|---|---|---|
| A-1 | **Donor** | Quyên góp, theo dõi tiền được dùng ra sao, nhận huy hiệu, tương tác với bài cập nhật |
| A-2 | **Fundraiser** (thành viên tổ chức) | Tạo/quản lý campaign và phase, đăng bài cập nhật, nhận/điều phối lại campaign |
| A-3 | **Kitchen staff** (thành viên tổ chức) | Gửi yêu cầu nguyên liệu và chi phí nấu, nộp chứng từ chi tiêu, quản lý mẻ ăn |
| A-4 | **Delivery staff** (thành viên tổ chức) | Nhận/từ chối và thực hiện nhiệm vụ giao hàng, gửi yêu cầu chi phí giao |
| A-5 | **Admin** | Xác minh tổ chức/thành viên, duyệt campaign, duyệt yêu cầu chi và chứng từ, giải ngân, điều phối lại campaign, cấu hình hệ thống |
| A-6 | **Khách (chưa đăng nhập)** **(suy ra)** | Xem campaign và sao kê công khai |
| S-1 | PayOS | Cổng thanh toán (tạo link/QR, webhook kết quả) |
| S-2 | SePay | Thông báo biến động số dư tài khoản ngân hàng (tiền vào/ra) |
| S-3 | Dịch vụ email | Gửi email giao dịch |
| S-4 | Nhà cung cấp danh tính | Đăng ký/đăng nhập (bản cũ dùng AWS Cognito) |

---

## 3. Luồng giá trị chính (end-to-end)

1. Tổ chức đăng ký → admin **xác minh**. Người dùng xin gia nhập tổ chức với vai trò fundraiser / kitchen / delivery → được duyệt.
2. Fundraiser tạo **campaign** gồm một hoặc nhiều **phase**. Mỗi phase có: địa điểm, ngày mua nguyên liệu, ngày nấu, ngày giao, **% ngân sách** cho nguyên liệu / nấu / giao, danh sách **món dự kiến** và **nguyên liệu dự kiến**.
3. Admin **duyệt** campaign → campaign mở nhận quyên góp.
4. Donor **quyên góp** qua PayOS hoặc chuyển khoản QR (SePay). Hệ thống ghi nhận cả chuyển **thiếu, bổ sung, dư**. Donor được trao **huy hiệu** theo tổng số tiền đã góp.
5. Đến ngày của phase: kitchen staff gửi **yêu cầu nguyên liệu** → admin duyệt → **giải ngân** → kitchen nộp **chứng từ chi tiêu** (ảnh hoá đơn) → admin duyệt chứng từ.
6. Gửi **yêu cầu chi phí nấu** → duyệt → giải ngân → tạo **mẻ ăn** và ghi nguyên liệu đã dùng.
7. Gửi **yêu cầu chi phí giao** → duyệt → giải ngân → giao **nhiệm vụ giao hàng** cho delivery staff → mọi lần đổi trạng thái được ghi log.
8. Phase hoàn tất → campaign hoàn tất → **sao kê công khai**. Tiền dư (nếu có) được chuyển sang campaign khác và donor được thông báo.

---

## 4. Yêu cầu chức năng (feature parity)

### 4.1 Danh tính & tài khoản

- **FR-ID-01** Đăng ký, xác thực email, đăng nhập, làm mới phiên, đăng xuất, quên mật khẩu.
- **FR-ID-02** Phân quyền theo vai trò A-1…A-5; một người dùng có đúng một vai trò chính **(suy ra từ `User.role`)**.
- **FR-ID-03** Hồ sơ cá nhân: xem/sửa; trạng thái sẵn sàng làm việc (AVAILABLE/UNAVAILABLE) cho staff.
- **FR-ID-04** Admin tạo tài khoản staff **(suy ra từ commit "combine method create staff account")**.
- **FR-ID-05** Đăng nhập bằng Google **(suy ra từ `GOOGLE_CLIENT_ID` trong `.env.example`)** — xem Q-07.

### 4.2 Tổ chức

- **FR-ORG-01** Đăng ký tổ chức; admin xác minh (PENDING → VERIFIED / REJECTED / CANCELLED / INACTIVE).
- **FR-ORG-02** Người dùng xin gia nhập tổ chức với vai trò cụ thể; tổ chức/admin duyệt; ghi nhận ngày vào/rời.
- **FR-ORG-03** Xem danh sách thành viên theo vai trò; hồ sơ fundraiser và staff.

### 4.3 Campaign & phase

- **FR-CMP-01** Tạo/sửa campaign (tiêu đề ≤ 200 ký tự, mô tả, ảnh bìa, danh mục, mục tiêu tiền, thời gian).
- **FR-CMP-02** Tạo/sửa phase với địa điểm, 3 mốc ngày, % ngân sách, món và nguyên liệu dự kiến.
- **FR-CMP-03** Admin duyệt / từ chối campaign kèm lý do (≤ 500 ký tự).
- **FR-CMP-04** Gia hạn campaign, tối đa **30 ngày** mỗi lần.
- **FR-CMP-05** Huỷ campaign.
- **FR-CMP-06** Quản lý danh mục campaign (admin).
- **FR-CMP-07** Thống kê campaign: tổng tiền nhận, số donor, tiến độ phase.

### 4.4 Quyên góp & thanh toán

- **FR-PAY-01** Donor tạo khoản quyên góp → nhận link/QR PayOS với mã đơn hàng.
- **FR-PAY-02** Nhận webhook PayOS → cập nhật giao dịch (thành công / thất bại).
- **FR-PAY-03** Nhận thông báo SePay về tiền vào: khớp với mã đơn hàng; xử lý **chuyển thiếu (PARTIAL)**, **chuyển bổ sung**, **chuyển dư (OVERPAID)**; tiền không khớp được chuyển vào ví admin.
- **FR-PAY-04** Nhận thông báo SePay về tiền ra (rút tiền) **(suy ra)**.
- **FR-PAY-05** Tự huỷ link thanh toán treo quá N giờ (`PAYOS_CANCEL_PENDING_AFTER_HOURS`).
- **FR-PAY-06** Quyên góp ẩn danh **(suy ra — cần xác nhận, xem Q-08)**.
- **FR-PAY-07** Donor xem lịch sử quyên góp của mình.
- **FR-PAY-08** Hoàn tiền — trạng thái `REFUNDED` có trong code cũ nhưng **chưa thấy luồng nghiệp vụ** (xem Q-05).

### 4.5 Ví & dòng tiền

- **FR-WAL-01** Ví fundraiser và ví admin; giao dịch: nhận tiền, rút tiền, điều chỉnh của admin.
- **FR-WAL-02** Rút tiền từ ví là thao tác nguyên tử (cập nhật số dư + ghi giao dịch cùng lúc).
- **FR-WAL-03** Xem và tìm kiếm lịch sử giao dịch ví.

### 4.6 Giải ngân & chứng từ chi tiêu

- **FR-DSB-01** Kitchen staff gửi **yêu cầu nguyên liệu** cho một phase, gồm danh sách món hàng và chi phí.
- **FR-DSB-02** Kitchen/delivery staff gửi **yêu cầu chi phí vận hành** loại COOKING hoặc DELIVERY.
- **FR-DSB-03** Admin duyệt / từ chối yêu cầu kèm ghi chú.
- **FR-DSB-04** Giải ngân yêu cầu đã duyệt cho người nhận, kèm bằng chứng chuyển khoản; trạng thái → DISBURSED.
- **FR-DSB-05** Kitchen staff nộp **chứng từ chi tiêu** (ảnh/tệp, số tiền) cho yêu cầu nguyên liệu; admin duyệt / từ chối.
- **FR-DSB-06** Thống kê yêu cầu (đã duyệt, đã giải ngân, đang chờ).

### 4.7 Bếp

- **FR-KIT-01** Tạo mẻ ăn cho phase (PREPARING → READY → DELIVERED).
- **FR-KIT-02** Ghi nguyên liệu thực tế đã dùng cho từng mẻ.

### 4.8 Giao hàng

- **FR-DLV-01** Giao nhiệm vụ giao hàng cho delivery staff đang sẵn sàng.
- **FR-DLV-02** Delivery staff chấp nhận / từ chối; cập nhật OUT_FOR_DELIVERY → COMPLETED / FAILED.
- **FR-DLV-03** Mọi thay đổi trạng thái được ghi log có thời gian và người thực hiện.

### 4.9 Cộng đồng

- **FR-COM-01** Fundraiser đăng bài cập nhật cho campaign (văn bản + ảnh).
- **FR-COM-02** Like, comment, trả lời comment.

### 4.10 Thông báo

- **FR-NTF-01** Thông báo trong ứng dụng cho ~30 loại sự kiện (duyệt/từ chối/giải ngân/giao việc/tương tác bài…).
- **FR-NTF-02** Email cho các sự kiện quan trọng (ví dụ: tiền dư được chuyển sang campaign mới).
- **FR-NTF-03** Đánh dấu đã đọc, danh sách thông báo.

### 4.11 Huy hiệu

- **FR-BDG-01** Trao huy hiệu theo **tổng tiền donor đã góp**: First Donation (bất kỳ), Bronze ≥ 100K, Silver ≥ 1M, Gold ≥ 10M, Platinum ≥ 100M, Diamond ≥ 500M VND.

### 4.12 Điều phối lại, gia hạn, tiền dư

- **FR-RSG-01** Admin chuyển campaign sang tổ chức khác; tổ chức nhận phải chấp nhận trong **7 ngày**, quá hạn → EXPIRED.
- **FR-RSG-02** Chuyển quyền sở hữu campaign khi được chấp nhận; thông báo cho các bên.
- **FR-SUR-01** Tiền dư của campaign đã kết thúc được dùng cho campaign mới; gửi email cho donor liên quan.

### 4.13 Tìm kiếm & minh bạch

- **FR-SRC-01** Tìm kiếm campaign (từ khoá, danh mục, trạng thái, địa điểm).
- **FR-SRC-02** Tìm kiếm quyên góp (theo campaign, số tiền) và giao dịch ví.
- **FR-TRN-01** **Sao kê công khai** của campaign: tiền vào (quyên góp), tiền ra (giải ngân), chứng từ đi kèm.

### 4.14 Tính năng mới (ứng viên — chọn ở Q-10)

| Mã | Tính năng | Ghi chú |
|---|---|---|
| AI-01 | **Xác minh hoá đơn/chứng từ**: trích xuất món, đơn giá, tổng tiền từ ảnh; đối chiếu với yêu cầu nguyên liệu đã duyệt; gắn cờ sai lệch, trùng lặp. Admin là người quyết định cuối | Gắn với FR-DSB-05 |
| AI-02 | **Chatbot minh bạch** cho donor: hỏi đáp về campaign và dòng tiền, chỉ đọc dữ liệu donor được phép xem | Có spec cũ ở `.kiro/specs/transparency-ai-chatbot/` (hướng NL→SQL, cần đánh giá lại) |
| AI-03 | Tìm kiếm campaign theo ngữ nghĩa | Mở rộng FR-SRC-01 |
| AI-04 | Tóm tắt sao kê thành báo cáo dễ đọc | Mở rộng FR-TRN-01 |
| AI-05 | Trợ lý soạn campaign và kiểm duyệt nội dung | Mở rộng FR-CMP-01 |
| NEW-01 | **Phê duyệt rút tiền nhiều chữ ký** (fund committee) | Có trong tài liệu sản phẩm, **không có** trong code cũ (Q-02) |
| NEW-02 | **Phiếu ăn điện tử** cho người nhận | Có trong tài liệu sản phẩm, **không có** trong code cũ (Q-03) |

---

## 5. Quy tắc nghiệp vụ & vòng đời trạng thái

- **BR-01 Campaign:** PENDING → APPROVED / REJECTED; APPROVED → ACTIVE → PROCESSING → COMPLETED; có thể ENDED hoặc CANCELLED. *(Chưa rõ khác biệt ENDED vs COMPLETED — Q-04.)*
- **BR-02 Phase:** PLANNING → AWAITING_INGREDIENT_DISBURSEMENT → INGREDIENT_PURCHASE → AWAITING_COOKING_DISBURSEMENT → COOKING → AWAITING_DELIVERY_DISBURSEMENT → DELIVERY → COMPLETED; bất kỳ lúc nào có thể CANCELLED / FAILED.
- **BR-03 Yêu cầu chi** (nguyên liệu, vận hành): PENDING → APPROVED / REJECTED; APPROVED → DISBURSED.
- **BR-04 Chứng từ chi tiêu:** PENDING → APPROVED / REJECTED.
- **BR-05 Thanh toán:** trạng thái giao dịch PENDING / SUCCESS / FAILED / REFUNDED; trạng thái số tiền PENDING / PARTIAL / COMPLETED / OVERPAID.
- **BR-06 Ngân sách phase:** tổng % nguyên liệu + nấu + giao **phải ≤ 100%** **(suy ra — code cũ không thấy kiểm tra, Q-06)**.
- **BR-07 Giải ngân không vượt ngân sách** phần tương ứng của phase **(suy ra — cần xác nhận)**.
- **BR-08 Một webhook / một giao dịch ngân hàng chỉ được ghi nhận đúng một lần** (idempotent).
- **BR-09 Điều phối lại** hết hạn sau 7 ngày; gia hạn campaign tối đa 30 ngày.
- **BR-10 Huy hiệu** chỉ tăng bậc, không bị thu hồi **(suy ra)**.

---

## 6. Yêu cầu phi chức năng

| Mã | Yêu cầu | Đo bằng |
|---|---|---|
| NFR-01 | **Tiền đúng tuyệt đối**: webhook phải xác thực chữ ký/nguồn gửi; xử lý idempotent; số dư mọi ví tính lại được từ lịch sử giao dịch | Test tự động cho webhook giả mạo, webhook lặp; job đối soát |
| NFR-02 | **Audit trail không sửa được** cho mọi thao tác tiền và phê duyệt | Bản ghi chỉ thêm, không cập nhật/xoá |
| NFR-03 | **Minh bạch**: mọi khoản tiền vào/ra truy được tới quyên góp gốc hoặc chứng từ | Sao kê công khai khớp sổ sách 100% |
| NFR-04 | **Bảo mật**: phân quyền ở mọi API; không log dữ liệu nhạy cảm; secret không nằm trong repo | Secret scan trong CI; test phân quyền |
| NFR-05 | **Chạy local ≤ 10 phút** từ clone sạch, không cần credential cloud thật | Job smoke trong CI |
| NFR-06 | **Chất lượng**: test tự động cho luồng tiền và state machine; CI chặn merge khi lint/test fail | Coverage mục tiêu (Q-11) |
| NFR-07 | **Khả năng chịu lỗi**: một phần hệ thống hỏng (thông báo, tìm kiếm, AI) không chặn quyên góp và giải ngân | Test kịch bản dịch vụ phụ ngừng |
| NFR-08 | **Quan sát được**: log có cấu trúc, trace xuyên service, cảnh báo cho lỗi thanh toán | |
| NFR-09 | **Chi phí vận hành thấp** (solo) | Ước tính chi phí hằng tháng (Q-12) |
| NFR-10 | **AI có trách nhiệm**: AI chỉ gợi ý, con người quyết định ở luồng tiền; có bộ eval; ẩn dữ liệu cá nhân trước khi gửi cho mô hình; giới hạn chi phí | Eval chạy trong CI; audit log prompt/kết quả |
| NFR-11 | Ngôn ngữ giao diện/nội dung: tiếng Việt; tiền tệ VND **(suy ra)** | |

---

## 7. Ngoài phạm vi (đề xuất — xác nhận ở Q-09)

- Ứng dụng web/mobile phía client (bản viết lại chỉ gồm backend + API).
- Đa tiền tệ, thanh toán quốc tế.
- Hạ tầng Kubernetes/ArgoCD cho production (chỉ cần một cách deploy đơn giản).

---

## 8. Câu hỏi mở — vui lòng trả lời ngay dưới mỗi câu

**Q-01. Tác nhân & luồng chính (mục 2, 3) có sai hoặc thiếu gì không?**
Trả lời:

**Q-02. "Fund committee" duyệt rút tiền nhiều chữ ký (NEW-01): có phải vai trò riêng khác admin không, và có nằm trong phạm vi bản viết lại?**
Trả lời:

**Q-03. Phiếu ăn điện tử (NEW-02) có nằm trong phạm vi không? Nếu có, ai phát, ai đổi phiếu?**
Trả lời:

**Q-04. Khác biệt giữa campaign ENDED và COMPLETED là gì? PROCESSING bắt đầu khi nào?**
Trả lời:

**Q-05. Có cần luồng hoàn tiền cho donor không (campaign bị huỷ, chuyển dư)?**
Trả lời:

**Q-06. Tổng % ngân sách phase phải đúng 100% hay ≤ 100%? Phần còn lại dùng vào đâu?**
Trả lời:

**Q-07. Có giữ đăng nhập Google không?**
Trả lời:

**Q-08. Donor có được quyên góp ẩn danh / không cần tài khoản không?**
Trả lời:

**Q-09. Phạm vi bản viết lại có bao gồm frontend (web/mobile) không?**
Trả lời:

**Q-10. Chọn tính năng mới nào trong mục 4.14 (khuyến nghị: AI-01, thêm AI-02 nếu còn thời gian)?**
Trả lời:

**Q-11. Mục tiêu coverage cho luồng tiền và toàn hệ thống?** (đề xuất: ≥ 80% cho payment/ledger/disbursement, ≥ 60% toàn bộ)
Trả lời:

**Q-12. Ngân sách hạ tầng hằng tháng tối đa? Có bắt buộc deploy lên cloud để demo không?**
Trả lời:

---

## 9. Bước tiếp theo

1. Chủ dự án trả lời mục 8 → cập nhật tài liệu lên v1.0.
2. Viết `02-decomposition.md`: tách hệ thống thành các service dựa trên requirement đã chốt.
3. Viết `03-tech-stack.md`: chọn ngôn ngữ, cơ sở dữ liệu, cách giao tiếp, hạ tầng — mỗi lựa chọn kèm lý do.
