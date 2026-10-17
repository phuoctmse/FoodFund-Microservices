# FoodFund (bản viết lại) — Requirements

> **Trạng thái:** v1.6 — 2026-10-11. Lịch sử phiên bản xem `git log`.
> **Nguồn:** dựng ngược từ hệ thống cũ (`origin/master` @ `84fed04`), có BA review đối chiếu code (`file:line`) và thực tế ở Việt Nam.
> **Quy ước:** `FR-*` chức năng · `BR-*` quy tắc nghiệp vụ · `NFR-*` phi chức năng · **[M]** Must / **[S]** Should / **[C]** Could (giai đoạn 2) · *(chưa kiểm chứng)* = chưa đối chiếu được nguồn.

Tài liệu này **chỉ mô tả hệ thống phải làm gì**. Ranh giới service ở `02-decomposition.md`, công nghệ ở `03-tech-stack.md`.

---

## 1. Tầm nhìn & mục tiêu

FoodFund là nền tảng gây quỹ từ thiện về thực phẩm: kết nối donor, tổ chức gây quỹ, bếp và đội giao hàng, và cho phép **truy vết từng đồng tiền** từ lúc quyên góp đến khi suất ăn được giao.

- **G-1:** Feature parity với hệ thống cũ ở các nhóm Must/Should, **sửa các lỗi nghiệp vụ đã biết** (mục 8).
- **G-2:** Thêm tối thiểu một tính năng AI gắn trực tiếp với minh bạch (AI-01).
- **G-3:** Chất lượng kỹ thuật đủ làm portfolio SE I: có test, CI thật, chạy local được, quyết định thiết kế được ghi lại.

**Ràng buộc:** làm solo, 5–6 tháng; microservices nhưng thiết kế lại ranh giới.

**Giả định pháp lý:** đây là dự án portfolio, không vận hành gây quỹ thật. Tuy vậy, hệ thống được thiết kế để **có thể tuân thủ** các nghĩa vụ minh bạch của Nghị định 93/2021/NĐ-CP (mục 7.2). Tài liệu này không phải tư vấn pháp lý.

---

## 2. Tác nhân

| Mã | Vai trò | Mục đích chính |
|---|---|---|
| A-1 | **Donor** | Quyên góp (có thể ẩn danh), theo dõi tiền, nhận biên nhận, nhận huy hiệu |
| A-2 | **Fundraiser / Người đại diện tổ chức** | Lập tổ chức, tạo/quản lý campaign và phase, **duyệt thành viên**, **giao việc giao hàng**, **nhận giải ngân** và chịu trách nhiệm chi tiêu |
| A-3 | **Kitchen staff** | Gửi yêu cầu nguyên liệu và chi phí nấu, nộp chứng từ, quản lý mẻ ăn |
| A-4 | **Delivery staff** | Nhận/từ chối và thực hiện nhiệm vụ giao hàng, gửi yêu cầu chi phí giao |
| A-5 | **Admin nền tảng** | Xác minh tổ chức, duyệt campaign, duyệt yêu cầu chi và chứng từ, giải ngân, đối soát, hoàn tiền, cấu hình hệ thống |
| A-6 | **Khách** | Xem campaign, sao kê công khai; quyên góp không cần tài khoản |
| S-0 | **Bộ lập lịch hệ thống** | Tự chuyển trạng thái campaign theo thời gian, huỷ link thanh toán treo, nhắc hạn công khai |
| S-1 | PayOS | Cổng thanh toán (link/QR, webhook có chữ ký) |
| S-2 | SePay | Thông báo biến động số dư ngân hàng (tiền vào/ra) |
| S-3 | Dịch vụ email | Email giao dịch |
| S-4 | Nhà cung cấp danh tính | Đăng ký/đăng nhập, đăng nhập Google (OIDC) |

---

## 3. Luồng giá trị chính

1. Donor lập tổ chức → nộp hồ sơ pháp lý và tài khoản nhận tiền → admin **xác minh (KYC)** → người lập trở thành **fundraiser/người đại diện**. Người khác xin gia nhập tổ chức với vai trò kitchen/delivery → **người đại diện duyệt**.
2. Fundraiser tạo **campaign** gồm ≥ 1 **phase** (địa điểm, ngày mua – nấu – giao, % ngân sách nguyên liệu/nấu/giao, món và nguyên liệu dự kiến) và **cam kết phương án xử lý tiền dư** (BR-12).
3. Admin **duyệt** → campaign tự chuyển ACTIVE vào ngày bắt đầu.
4. Donor **quyên góp** qua PayOS/QR; giao dịch được đối soát (thiếu, bổ sung, dư, không khớp nội dung). Donor nhận **biên nhận điện tử**.
5. Hết hạn gây quỹ: đạt ≥ % tối thiểu → PROCESSING; không đạt → UNDERFUNDED → xử lý tiền theo BR-12. Hệ thống phát hành **báo cáo tiếp nhận** (FR-TRN-02).
6. Từng phase: kitchen gửi **yêu cầu nguyên liệu** → admin duyệt → **giải ngân cho fundraiser** (kèm bằng chứng chuyển khoản) → fundraiser xác nhận đã nhận → kitchen nộp **chứng từ chi tiêu** → admin duyệt (có AI-01 hỗ trợ đối chiếu).
7. **Chi phí nấu** → duyệt → giải ngân → tạo **mẻ ăn**. **Chi phí giao** → duyệt → giải ngân → fundraiser giao **nhiệm vụ giao hàng** cho delivery staff cùng tổ chức.
8. Mọi phase kết thúc → campaign COMPLETED → phát hành **báo cáo phân phối** công khai; tiền dư xử lý theo BR-12.

---

## 4. Yêu cầu chức năng

### 4.1 Danh tính & tài khoản

- **FR-ID-01 [M]** Đăng ký, xác thực email, đăng nhập, làm mới phiên, đăng xuất, quên mật khẩu.
- **FR-ID-02 [M]** Phân quyền theo vai trò; vai trò **thay đổi theo tổ chức**: được duyệt vào tổ chức → FUNDRAISER/KITCHEN/DELIVERY; rời tổ chức → DONOR.
- **FR-ID-03 [M]** Xem/sửa hồ sơ cá nhân.
- **FR-ID-05 [S]** Đăng nhập Google theo **luồng OIDC chuẩn** của nhà cung cấp danh tính; **không bao giờ** thay đổi mật khẩu của người dùng trong luồng đăng nhập.
- **FR-ID-06 [M]** Admin xem danh sách người dùng, khoá/mở khoá tài khoản.
- ~~FR-ID-04~~ *Đã bỏ: hệ thống cũ không có tính năng admin tạo staff; staff vào hệ thống qua yêu cầu gia nhập tổ chức.*
- **FR-ID-07 [C]** Trạng thái sẵn sàng làm việc của staff (AVAILABLE/UNAVAILABLE) — *tính năng mới; code cũ chỉ có DTO, chưa từng hoạt động.*

### 4.2 Tổ chức

- **FR-ORG-01 [M]** Donor gửi/huỷ yêu cầu lập tổ chức; mỗi người lập tối đa **1** tổ chức; admin xác minh (PENDING → VERIFIED / REJECTED / CANCELLED / INACTIVE). Khi được xác minh, người lập trở thành fundraiser.
- **FR-ORG-02 [M]** Người dùng (đang là donor) xin gia nhập **một** tổ chức với vai trò KITCHEN hoặc DELIVERY; **người đại diện tổ chức** duyệt/từ chối; ghi nhận ngày vào/rời.
- **FR-ORG-03 [M]** Staff rời tổ chức; người đại diện xoá staff; xem danh sách thành viên theo vai trò.
- **FR-ORG-04 [M]** **KYC tổ chức:** nộp giấy tờ pháp lý; tài khoản nhận tiền phải đứng tên tổ chức hoặc người đại diện đã xác minh; admin duyệt theo checklist; lưu lịch sử xác minh. *(Code cũ chỉ so tên chủ tài khoản với tên người đại diện.)*

### 4.3 Campaign & phase

- **FR-CMP-01 [M]** Chủ campaign tạo/sửa campaign: tiêu đề ≤ 200 ký tự, mô tả, ảnh bìa (upload qua URL ký sẵn), danh mục, mục tiêu tiền, thời gian; slug duy nhất.
- **FR-CMP-02 [M]** Tạo/sửa phase: tên ≥ 5 ký tự, địa điểm, ngày mua – nấu – giao (giao ≤ 24h sau nấu), % ngân sách, món và nguyên liệu dự kiến; campaign phải có ≥ 1 phase.
- **FR-CMP-03 [M]** Admin duyệt/từ chối kèm lý do (≤ 500 ký tự).
- **FR-CMP-04 [S]** Gia hạn: chỉ chủ campaign, chỉ khi ACTIVE và còn ≤ 7 ngày, **tối đa 1 lần**, 1–30 ngày.
- **FR-CMP-05 [M]** Admin huỷ campaign (bắt buộc lý do) → tiền xử lý theo BR-12. Chủ campaign chỉ **rút lại** (không xoá cứng) khi PENDING/APPROVED/REJECTED.
- **FR-CMP-06 [M]** Admin quản lý danh mục.
- **FR-CMP-07 [C]** Thống kê campaign và nền tảng (tổng tiền, số donor, tiến độ phase).
- **FR-CMP-08 [S]** **Chia sẻ trang campaign lên mạng xã hội** (Facebook, Zalo) với ảnh xem trước, tiêu đề, mô tả (thẻ Open Graph render phía server) và nút chia sẻ/sao chép link.
- **FR-CFG-01 [M]** Admin cấu hình tham số hệ thống: % gây quỹ tối thiểu (`MIN_FUNDING_PERCENTAGE`), thời gian huỷ link treo, ngưỡng duyệt hai người (BR-13).

### 4.4 Quyên góp & thanh toán

- **FR-PAY-01 [M]** Donor (hoặc khách) tạo khoản quyên góp → nhận link/QR với mã đơn hàng duy nhất.
- **FR-PAY-02 [M]** Nhận webhook PayOS **đã xác thực chữ ký** → cập nhật giao dịch thành công/thất bại.
- **FR-PAY-03 [M]** Nhận thông báo SePay **đã xác thực** về tiền vào; khớp theo mã đơn hàng; xử lý chuyển thiếu (PARTIAL), bổ sung, dư (OVERPAID).
- **FR-PAY-04 [M]** Nhận thông báo SePay về tiền ra; mỗi khoản tiền ra phải **gắn với** một giải ngân hoặc hoàn tiền cụ thể.
- **FR-PAY-05 [M]** Bộ lập lịch huỷ link thanh toán treo quá N giờ (mặc định 24h).
- **FR-PAY-06 [M]** Quyên góp ẩn danh, hai chế độ tách biệt: (a) khách không tài khoản; (b) có tài khoản nhưng ẩn tên công khai. Email tuỳ chọn để nhận biên nhận.
- **FR-PAY-07 [M]** Donor xem lịch sử quyên góp của mình.
- **FR-PAY-08 [S]** **Hoàn tiền tối thiểu:** admin ghi nhận hoàn tiền kèm bằng chứng chuyển khoản, khớp với giao dịch tiền ra (FR-PAY-04); áp dụng khi campaign bị huỷ/không đạt mục tiêu hoặc donor từ chối phương án tiền dư.
- **FR-PAY-09 [S]** Donor tải **biên nhận điện tử** cho mỗi khoản quyên góp.
- **FR-PAY-10 [M]** **Hàng chờ đối soát:** giao dịch không khớp nội dung/mã đơn **không** được tự ghi vào bất kỳ quỹ nào; admin gán vào donation hoặc hoàn tiền; có thời hạn xử lý.
- **FR-PAY-11 [M]** Admin duyệt thủ công một khoản quyên góp (ví dụ khi webhook thất bại) — mọi lần duyệt thủ công phải ghi lý do và audit.

### 4.5 Sổ cái & dòng tiền

*Thay cho khái niệm "ví fundraiser" của hệ thống cũ (một quỹ ảo tự nhận tiền từ 3 nguồn và tự chuyển sang campaign kế tiếp).*

- **FR-LED-01 [M]** Mọi biến động tiền (quyên góp, giải ngân, hoàn tiền, chuyển tiền dư, điều chỉnh) được ghi thành **bút toán** có tài khoản nợ/có, số tiền, tham chiếu nghiệp vụ, người thực hiện.
- **FR-LED-02 [M]** Số dư của campaign, phase/hạng mục và tài khoản nền tảng **tính được từ bút toán**; không có số dư "tự cập nhật" ở nơi khác.
- **FR-LED-03 [M]** Admin điều chỉnh sổ cái có giao diện, bắt buộc lý do, qua duyệt hai người (BR-13).
- **FR-LED-04 [M]** Tra cứu lịch sử bút toán theo campaign, tổ chức, khoảng thời gian.

### 4.6 Giải ngân & chứng từ

- **FR-DSB-01 [M]** Kitchen staff **hoặc fundraiser** gửi yêu cầu nguyên liệu cho phase (danh sách món hàng, chi phí); campaign phải đang PROCESSING; mỗi phase chỉ có **1 yêu cầu đang mở** cho mỗi loại.
- **FR-DSB-02 [M]** Gửi yêu cầu chi phí vận hành loại COOKING/DELIVERY (cùng ràng buộc như trên).
- **FR-DSB-03 [M]** Admin duyệt/từ chối kèm ghi chú.
- **FR-DSB-04 [M]** Admin giải ngân yêu cầu đã duyệt cho **fundraiser của campaign**, kèm bằng chứng chuyển khoản; số tiền bằng chi phí đã duyệt; yêu cầu chỉ chuyển DISBURSED **sau khi** fundraiser xác nhận đã nhận (FR-DSB-07).
- **FR-DSB-05 [M]** Nộp chứng từ chi tiêu theo luồng **"chụp và gửi"** cho **mọi loại** chi phí đã giải ngân (người nộp có thể không rành công nghệ):
  - Một chứng từ gồm **một hoặc nhiều ảnh**, chọn loại: phiếu siêu thị/cửa hàng · giấy viết tay hoặc bảng kê · ảnh chụp màn hình chuyển khoản · ảnh hàng hoá · video (lưu để admin xem, không phân tích tự động).
  - Người nộp **chỉ bắt buộc nhập một con số: tổng tiền đã chi**; không bắt nhập từng món.
  - Không có giấy tờ → dùng **bảng kê nhanh trong app** (tên món, số lượng, đơn giá; app tự tính thành tiền), **kèm ít nhất một ảnh** hàng hoá hoặc ảnh chuyển khoản.
  - Kitchen staff **hoặc fundraiser** (nộp thay) được nộp.
  - Admin duyệt/từ chối; hệ thống **so sánh tổng chứng từ với số đã giải ngân** và gắn cờ chênh lệch.
  - *Bằng chứng từ hệ thống cũ:* toàn bộ chứng từ đã nộp là ảnh JPEG (có một video), nơi mua là siêu thị và chợ đầu mối; có chứng từ bị từ chối vì "Bị lặp"; dữ liệu nhập tay có lỗi đơn giá × số lượng ≠ thành tiền (`seed_data/operations_db.sql`).
- **FR-DSB-06 [S]** Thống kê yêu cầu (đã duyệt, đã giải ngân, đang chờ, chênh lệch chứng từ).
- **FR-DSB-07 [M]** Fundraiser xác nhận đã nhận giải ngân (COMPLETED) hoặc báo lỗi (FAILED).
- **FR-DSB-08 [M]** **Phát hiện ảnh nộp trùng bằng code** (băm ảnh theo cảm nhận — perceptual hash), so với mọi chứng từ của cùng tổ chức; trùng → gắn cờ cho admin, không tự từ chối.
- **FR-DSB-09 [S]** Giao diện nộp chứng từ **ưu tiên điện thoại**: chữ to, tiếng Việt đơn giản, ảnh mẫu hướng dẫn cách chụp, tự nén ảnh trước khi tải lên, tải lại được khi mạng chập chờn.

### 4.7 Bếp

- **FR-KIT-01 [M]** Tạo mẻ ăn cho phase (PREPARING → READY → DELIVERED), có ảnh.
- **FR-KIT-02 [S]** Ghi nguyên liệu thực tế đã dùng cho từng mẻ.

### 4.8 Giao hàng

- **FR-DLV-01 [M]** **Fundraiser** giao nhiệm vụ giao hàng cho delivery staff **cùng tổ chức**; mẻ ăn phải READY.
- **FR-DLV-02 [M]** Delivery staff chấp nhận/từ chối; cập nhật OUT_FOR_DELIVERY → COMPLETED/FAILED.
- **FR-DLV-03 [M]** Mọi thay đổi trạng thái được ghi log (thời gian, người thực hiện).

### 4.9 Cộng đồng [C]

- **FR-COM-01 [C]** **Chỉ chủ campaign** (và thành viên tổ chức được cấp quyền) đăng bài cập nhật cho campaign của mình.
- **FR-COM-02 [C]** Like, comment, trả lời, sửa/xoá comment của chính mình.

### 4.10 Thông báo

- **FR-NTF-01 [M]** Email cho các sự kiện cốt lõi: campaign được duyệt/từ chối, quyên góp thành công (kèm biên nhận), giải ngân, phương án tiền dư cần donor phản hồi, nhắc hạn công khai.
- **FR-NTF-02 [C]** Thông báo trong ứng dụng cho toàn bộ ~30 loại sự kiện của hệ thống cũ; đánh dấu đã đọc, xoá.

### 4.11 Huy hiệu [C]

- **FR-BDG-01 [C]** Trao huy hiệu theo tổng tiền đã góp: First Donation, Bronze ≥ 100K, Silver ≥ 1M, Gold ≥ 10M, Platinum ≥ 100M, Diamond ≥ 500M VND; mỗi người một huy hiệu, chỉ nâng bậc. Admin quản lý danh mục huy hiệu.

### 4.12 Điều phối lại & tiền dư

- **FR-RSG-01 [C]** Admin đề xuất chuyển một campaign **đã huỷ** sang tổ chức khác (đã xác minh, không có campaign đang chạy, khác tổ chức gốc); tổ chức nhận chấp nhận trong **7 ngày**, quá hạn → EXPIRED; chuyển quyền sở hữu khi chấp nhận.
- **FR-SUR-01 [M]** Xử lý tiền dư theo **BR-12** (thay cho cơ chế tự chuyển sang campaign kế tiếp của hệ thống cũ).

### 4.13 Tìm kiếm & minh bạch

- **FR-SRC-01 [M]** Tìm/lọc campaign theo từ khoá, danh mục, trạng thái, địa điểm (lọc trong cơ sở dữ liệu là đủ).
- **FR-SRC-02 [M]** Tìm quyên góp theo campaign, số tiền, thời gian; **tìm theo email/định danh donor chỉ dành cho admin**.
- **FR-SRC-03 [C]** Tìm kiếm toàn văn (full-text).
- **FR-TRN-01 [M]** **Sao kê công khai** theo campaign: tiền vào, tiền ra (giải ngân, hoàn tiền, chuyển dư) kèm chứng từ; che số tài khoản và thông tin cá nhân.
- **FR-TRN-02 [M]** Tự phát hành **Báo cáo tiếp nhận** ≤ 15 ngày sau khi kết thúc gây quỹ và **Báo cáo phân phối** ≤ 30 ngày sau khi phase cuối kết thúc; báo cáo bất biến, có phiên bản, tải được (PDF/CSV); cảnh báo khi sắp trễ hạn. Báo cáo có **phần tóm tắt bằng lời sinh từ template** (không dùng AI): mọi số liệu lấy từ sổ cái; có biến thể cho các trường hợp còn/không còn tiền dư, hoàn thành/bị huỷ.
- **FR-TRN-03 [S]** Xuất mẫu báo cáo để tổ chức nộp chính quyền địa phương.

### 4.14 Upload tệp

- **FR-UPL-01 [M]** Upload ảnh/tệp (ảnh bìa, bài đăng, mẻ ăn, chứng từ, bằng chứng chuyển khoản) qua URL ký sẵn có giới hạn loại tệp và dung lượng.

### 4.15 Tính năng mới

| Mã | Ưu tiên | Tính năng | Ghi chú |
|---|---|---|---|
| AI-01 | **[M]** | **Xác minh chứng từ chi tiêu**: trích xuất món, đơn giá, tổng tiền, ngày, người bán từ **ảnh phiếu siêu thị/cửa hàng, giấy viết tay/bảng kê, ảnh chụp màn hình chuyển khoản** (không gồm video); đối chiếu với yêu cầu đã duyệt, tổng tiền người nộp khai và số đã giải ngân; gắn cờ sai lệch. Phát hiện trùng ảnh do FR-DSB-08 (code) đảm nhận. Admin quyết định cuối | Gắn với FR-DSB-05; có bộ eval |
| AI-04 | [C] | Viết lại tóm tắt báo cáo (bản template của FR-TRN-02) cho tự nhiên hơn | Giai đoạn 2. Luật bắt buộc: AI chỉ viết lại câu chữ từ bản template, không tự tính; code kiểm tra mọi con số khớp bản template, lệch → dùng bản template; hiển thị nhãn "tóm tắt do AI viết lại, số liệu đã được đối chiếu" |
| AI-02 | [C] | Chatbot minh bạch cho donor (chỉ đọc dữ liệu công khai qua API, **không** NL→SQL) | Spec cũ chỉ tồn tại ở máy local và hiện không còn |
| AI-03 | [C] | Tìm kiếm campaign theo ngữ nghĩa | |
| AI-05 | [C] | Trợ lý soạn campaign, kiểm duyệt nội dung | |
| NEW-01 | [S] | **Duyệt hai người** cho giải ngân/điều chỉnh trên ngưỡng (thay cho "fund committee multi-signature") | Xem BR-13 |
| NEW-02 | [C] | Phiếu ăn điện tử | Ngoài phạm vi giai đoạn 1 |
| NEW-03 | [C] | Nhận file hoá đơn điện tử (XML) và đối chiếu bằng code, không dùng AI | Người dùng thực tế hầu như chỉ có ảnh chụp; chỉ làm khi có nhu cầu thật |

---

## 5. Quy tắc nghiệp vụ & vòng đời trạng thái

- **BR-01 Campaign:**
  - PENDING → APPROVED/REJECTED (admin); PENDING quá hạn → REJECTED (tự động).
  - APPROVED → ACTIVE (tự động vào ngày bắt đầu, hoặc ngay khi duyệt nếu ngày bắt đầu là hôm nay); APPROVED quá hạn → CANCELLED.
  - ACTIVE → PROCESSING khi hết hạn và đạt ≥ `MIN_FUNDING_PERCENTAGE`, **hoặc** ngay khi vượt mục tiêu.
  - ACTIVE → **UNDERFUNDED** (tên cũ: ENDED) khi hết hạn mà không đạt % tối thiểu → bắt buộc xử lý tiền theo BR-12.
  - PROCESSING → COMPLETED khi mọi phase ở trạng thái kết thúc (COMPLETED, FAILED **hoặc CANCELLED**).
  - Bất kỳ trạng thái chưa kết thúc → CANCELLED (admin, có lý do).
- **BR-02 Phase:** PLANNING → AWAITING_INGREDIENT_DISBURSEMENT (khi tạo yêu cầu) → INGREDIENT_PURCHASE (khi giải ngân) → AWAITING_COOKING_DISBURSEMENT → COOKING → AWAITING_DELIVERY_DISBURSEMENT → DELIVERY → COMPLETED; có thể CANCELLED/FAILED.
- **BR-03 Yêu cầu chi:** PENDING → APPROVED/REJECTED; APPROVED → DISBURSED chỉ sau khi fundraiser xác nhận nhận tiền.
- **BR-04 Chứng từ:** PENDING → APPROVED/REJECTED.
- **BR-05 Thanh toán:** trạng thái giao dịch PENDING/SUCCESS/FAILED/REFUNDED; trạng thái số tiền PENDING/PARTIAL/COMPLETED/OVERPAID.
- **BR-06 Ngân sách:** tổng % (nguyên liệu + nấu + giao) **của tất cả phase** = 100% (sai số 0,01). Ngân sách mỗi hạng mục = min(tiền đã nhận, mục tiêu) × %.
- **BR-07 Giới hạn giải ngân:** chi phí yêu cầu không vượt ngân sách còn lại của hạng mục; số giải ngân bằng chi phí đã duyệt.
- **BR-08 Idempotent:** một webhook/giao dịch ngân hàng (theo mã định danh của nhà cung cấp) chỉ được ghi nhận một lần; **không** coi hai khoản cùng số tiền là trùng.
- **BR-09 Thời hạn:** điều phối lại hết hạn sau 7 ngày; gia hạn campaign tối đa 1 lần, 1–30 ngày.
- **BR-10 Huy hiệu:** chỉ nâng bậc.
- **BR-11 Tài khoản nhận tiền:** mỗi campaign có một **định danh nhận tiền riêng** (tài khoản hoặc tài khoản ảo); sao kê lập theo đúng định danh đó. *(Mức khả thi với PayOS/SePay chưa kiểm chứng — Q-13.)*
- **BR-12 Tiền dư / tiền không dùng hết:**
  - Phương án được **cam kết khi tạo campaign** (ví dụ: chuyển sang campaign cùng mục đích của tổ chức, hoặc hoàn lại).
  - Khi phát sinh: admin duyệt → **thông báo donor** với thời hạn phản đối → donor phản đối được hoàn tiền (FR-PAY-08) → phần còn lại chuyển theo phương án.
  - Mọi lần chuyển là bút toán hai chiều trong sổ cái; **không có** chuyển tiền tự động khi duyệt campaign mới.
- **BR-13 Duyệt hai người:** giải ngân và điều chỉnh sổ cái vượt ngưỡng cấu hình cần một admin tạo và **một admin khác** duyệt.
- **BR-14 Không xoá dữ liệu tiền:** dữ liệu tiền, chứng từ, campaign đã có giao dịch chỉ được đánh dấu huỷ/lưu trữ, không xoá cứng.

---

## 6. Yêu cầu phi chức năng

| Mã | Yêu cầu | Đo bằng |
|---|---|---|
| NFR-01 | **Tiền đúng tuyệt đối**: webhook xác thực chữ ký/khoá (PayOS signature; SePay HMAC/API key); idempotent; webhook lỗi tạm thời trả mã lỗi để nhà cung cấp gửi lại; **job đối soát hằng ngày** so sổ cái với giao dịch ngân hàng | Test tự động cho webhook giả mạo, gửi lặp, chuyển thiếu/dư/không khớp; báo cáo đối soát = 0 chênh lệch |
| NFR-02 | **Audit trail chỉ thêm** cho mọi thao tác tiền và phê duyệt; lưu trữ dài hạn (đề xuất ≥ 10 năm — *chưa kiểm chứng căn cứ*) | Không có thao tác cập nhật/xoá trên bảng audit |
| NFR-03 | **Minh bạch**: mọi khoản tiền vào/ra truy được tới quyên góp gốc hoặc chứng từ | Sao kê khớp sổ cái 100% |
| NFR-04 | **Phân quyền ở mọi API**, kiểm tra quyền sở hữu tài nguyên (không chỉ "đã đăng nhập") | Test phân quyền cho từng mutation |
| NFR-05 | **Chạy local ≤ 10 phút** từ clone sạch bằng **một lệnh `make up`** (cần cài sẵn Docker, kind, kubectl, helm), không cần credential cloud thật (dùng sandbox/giả lập) | Job smoke trong CI; đo thực tế ở spike S-4 |
| NFR-06 | **Chất lượng**: coverage ≥ 85% cho thanh toán, sổ cái, giải ngân và các state machine; ≥ 60% toàn hệ thống; CI chặn merge khi lint/test fail | Báo cáo coverage trong CI |
| NFR-07 | **Chịu lỗi**: thông báo, tìm kiếm, AI hỏng không chặn quyên góp và giải ngân | Test kịch bản dịch vụ phụ ngừng |
| NFR-08 | **Quan sát được**: log có cấu trúc, trace xuyên service, cảnh báo lỗi thanh toán và hàng chờ đối soát quá hạn | |
| NFR-09 | **Chi phí vận hành** ≤ ~25 USD/tháng cho môi trường demo *(con số mục tiêu, chưa tra giá)* | Ước tính chi phí trong `03-tech-stack.md` |
| NFR-10 | **AI có trách nhiệm**: AI chỉ gợi ý, con người quyết định ở luồng tiền; bộ eval có nhãn chạy trong CI; ẩn thông tin cá nhân trước khi gửi mô hình; giới hạn chi phí; lưu log đầu vào/đầu ra/người duyệt | Eval pass ngưỡng; audit log |
| NFR-11 | Nội dung tiếng Việt; tiền tệ VND, lưu số nguyên | |
| NFR-12 | *(Tham khảo, không bắt buộc với bản demo)* README ghi rõ đây là dự án demo, không vận hành gây quỹ thật; khung pháp lý ở mục 7.2 chỉ để hiểu bối cảnh | README |
| NFR-13 | **Bảo vệ dữ liệu cá nhân**: API công khai không trả email, số điện thoại, số tài khoản; không log dữ liệu nhạy cảm | Test hợp đồng API công khai |
| NFR-14 | **Sẵn sàng cho Kubernetes**: cấu hình qua biến môi trường, `/healthz` và `/readyz`, tắt êm khi nhận SIGTERM, log JSON ra stdout, không lưu trạng thái trên đĩa cục bộ, khai báo `requests`/`limits` | Kiểm tra trong CI (probe, test tắt êm) |

---

## 7. Phạm vi

### 7.1 Phạm vi giai đoạn 1

**Trong:** backend + **web tối thiểu** cho các luồng demo (trang campaign, quyên góp bằng QR, sao kê/báo cáo, màn admin duyệt – giải ngân – đối soát, màn nộp chứng từ); Kubernetes **kind** ở local/CI và **kubeadm một node** cho demo ([ADR-004](./03-tech-stack.md#adr-004-kubernetes-từ-ngày-đầu)).

**Ngoài:**
- Ứng dụng mobile; đa tiền tệ; thanh toán quốc tế.
- Các mục **[C]**: cộng đồng, huy hiệu, điều phối lại, thông báo trong ứng dụng đầy đủ, tìm kiếm toàn văn, thống kê, AI-02/03/05, phiếu ăn điện tử.
- GitOps (ArgoCD/Flux), Kubernetes nhiều node, service mesh, autoscaling.

### 7.2 Đối chiếu pháp lý (Việt Nam) — chỉ để tham khảo

> **Quyết định của chủ dự án (2026-10-10):** bản viết lại là demo/portfolio, **không phải tuân thủ pháp lý**. Mục này giữ lại để hiểu bối cảnh khi trình bày (phỏng vấn, báo cáo). Các yêu cầu bên trên có nguồn gốc pháp lý (FR-TRN-02, BR-11, BR-12, FR-ORG-04, FR-PAY-09) vẫn giữ **vì chúng là giá trị minh bạch của sản phẩm**, không phải vì nghĩa vụ pháp lý.

*Thông tin lấy từ bài báo và tóm tắt pháp luật; **chưa đối chiếu nguyên văn** Nghị định 93/2021/NĐ-CP — cần kiểm tra lại trước khi coi là căn cứ.*

| Nghĩa vụ (theo nguồn thứ cấp) | Yêu cầu tương ứng | Nguồn |
|---|---|---|
| Phạm vi NĐ 93/2021: thiên tai, dịch bệnh, sự cố, bệnh hiểm nghèo; mô hình gom quỹ nhiều campaign gần với quỹ từ thiện (NĐ 93/2019, sửa bởi NĐ 136/2024) | NFR-12 | [luatvietnam](https://luatvietnam.vn/tin-van-ban-moi/cong-khai-so-tien-keu-goi-tu-thien-tren-truyen-thong-186-33712-article.html), [caselaw](https://caselaw.vn/van-ban-phap-luat/411932-nghi-dinh-so-136-2024-nd-cp-ngay-23-10-2024-cua-chinh-phu-sua-doi-nghi-dinh-93-2019-nd-cp-ve-to-chuc-hoat-dong-cua-quy-xa-hoi-quy-tu-thien?en=true) |
| Tài khoản riêng cho từng cuộc vận động | BR-11 | [tapchitoaan](https://tapchitoaan.vn/ca-nhan-lam-tu-thien-va-quy-dinh-moi-cua-chinh-phu), [nhandan](https://nhandan.vn/quy-dinh-moi-ve-ca-nhan-van-dong-tu-thien-cong-khai-minh-bach-va-co-thoi-han-post671412.html) |
| Công khai tổng tiếp nhận ≤ 15 ngày sau khi kết thúc tiếp nhận; công khai phân phối ≤ 30 ngày sau khi kết thúc phân phối | FR-TRN-02, FR-TRN-03 | [lsvn](https://lsvn.vn/mot-so-quy-dinh-moi-dang-chu-y-ve-ca-nhan-van-dong-tu-thien-tu-ngay-111220211635346782.html) |
| Tiền dư: thống nhất với người đóng góp hoặc chuyển cho MTTQ | BR-12, FR-PAY-08 | [tapchitoaan](https://tapchitoaan.vn/ca-nhan-lam-tu-thien-va-quy-dinh-moi-cua-chinh-phu) |
| Sổ ghi nhận tiếp nhận/phân phối; biên nhận khi donor yêu cầu | FR-LED-*, FR-PAY-09 | [nhandan](https://nhandan.vn/quy-dinh-moi-ve-ca-nhan-van-dong-tu-thien-cong-khai-minh-bach-va-co-thoi-han-post671412.html) |
| SePay: xác thực HMAC-SHA256/API key/OAuth2; gửi lại tối đa 7 lần trong 5 giờ; phản hồi trong 30 giây; chống trùng theo `id` | NFR-01, BR-08 | [docs.sepay.vn](https://docs.sepay.vn/tich-hop-webhooks.html) |
| PayOS: webhook có chữ ký | NFR-01 | [payos.vn](https://payos.vn/docs/du-lieu-tra-ve/webhook/) |
| *(Tham khảo)* Luật Bảo vệ dữ liệu cá nhân hiệu lực 01/01/2026 (Nghị định 356/2025): xử lý dữ liệu thu thập ở Việt Nam trên nền tảng nước ngoài được tính là chuyển dữ liệu ra nước ngoài (đánh giá tác động, đồng ý của chủ thể). Liên quan khi gửi ảnh chứng từ tới HF ZeroGPU/Modal (T-11) | Không thành yêu cầu — demo chỉ dùng ảnh tự tạo | [Tilleke](https://www.tilleke.com/insights/vietnam-issues-personal-data-protection-law/13/), [PwC](https://legal.pwc.de/en/news/articles/pwc-vietnam-new-personal-data-protection-law) |

---

## 8. Lỗi đã biết của hệ thống cũ (không mang sang bản viết lại)

| Lỗi | Bằng chứng | Yêu cầu khắc phục |
|---|---|---|
| Webhook PayOS/SePay không xác thực chữ ký; PayOS lỗi vẫn trả "success" nên không được gửi lại | `donation-webhook.controller.ts:42-65`, `sepay-webhook.controller.ts:47-51` | NFR-01 |
| Hai khoản chuyển cùng số tiền bị coi là trùng → có thể bỏ sót tiền thật | `sepay-webhook.service.ts:133-137` | BR-08 |
| Giao dịch không khớp được ghi thẳng vào ví admin | `sepay-webhook.service.ts:71-80` | FR-PAY-10 |
| Đăng nhập Google (nhánh dự phòng) đổi mật khẩu người dùng thành `TempPass!<timestamp>` | `libs/aws-cognito/aws-cognito.service.ts:851-853` | FR-ID-05 |
| Tiền dư tự chuyển sang campaign kế tiếp mà không hỏi donor; email thông báo tiền dư có điều kiện lọc bị đảo nên không ai nhận được | `campaign.service.ts:1329-1386`, `:1474` | BR-12 |
| Campaign không đạt mục tiêu → toàn bộ tiền dồn vào ví fundraiser | `campaign-scheduler.service.ts:313-323` | BR-01, BR-12 |
| Phase bị huỷ không được tính là kết thúc → campaign treo mãi | `campaign-phase.service.ts:239-244` | BR-01 |
| Yêu cầu chuyển DISBURSED trước khi fundraiser xác nhận đã nhận | `inflow-transaction.service.ts:136-155` | BR-03 |
| Chứng từ không được so với số đã giải ngân; chi phí nấu/giao không cần chứng từ | `expense-proof.service.ts:154,183` | FR-DSB-05 |
| Bất kỳ ai đăng nhập cũng đăng bài được lên mọi campaign | `post-mutation.resolver.ts:14-15`, `post.service.ts:33-63` | FR-COM-01, NFR-04 |
| API công khai cho tìm quyên góp theo email donor | `donation-search.resolver.ts` (không có guard), `search-donation.input.ts:52` | FR-SRC-02, NFR-13 |
| `received_amount` cập nhật hai lần, không nguyên tử | `user-grpc.controller.ts:1129-1137` | FR-LED-02 |
| Xoá cứng campaign, `onDelete: Cascade` trên dữ liệu tiền | các `schema.prisma` | BR-14 |
| Sự kiện hoàn tiền được phát nhưng không có nơi xử lý | `campaign-reassignment.service.ts:485` | FR-PAY-08 |

---

## 9. Quyết định phạm vi (Q-01…Q-14, chốt 2026-10-09)

Chủ dự án đồng ý mọi đề xuất; các mục 1–7 đã viết theo đó.

| # | Câu hỏi | Quyết định |
|---|---|---|
| Q-01 | Tác nhân, luồng chính | Thêm "người đại diện tổ chức" (gộp với fundraiser) và "bộ lập lịch"; người nhận giải ngân là fundraiser |
| Q-02 | "Fund committee" nhiều chữ ký | Không tạo vai trò riêng; thay bằng duyệt hai người BR-13 [S] |
| Q-03 | Phiếu ăn điện tử | Ngoài giai đoạn 1 [C] |
| Q-04 | ENDED / COMPLETED / PROCESSING | ENDED đổi tên UNDERFUNDED, bắt buộc xử lý theo BR-12; quy tắc chuyển trạng thái ở BR-01 |
| Q-05 | Hoàn tiền | Có, mức tối thiểu [S] (FR-PAY-08) |
| Q-06 | Tổng % ngân sách phase | Tổng của **tất cả phase** = 100% (BR-06); phần chưa dùng theo BR-12 |
| Q-07 | Đăng nhập Google | Giữ [S], luồng OIDC chuẩn (FR-ID-05) |
| Q-08 | Quyên góp ẩn danh | Có [M], hai chế độ; định danh donor để trống (FR-PAY-06) |
| Q-09 | Frontend | Web tối thiểu cho luồng demo; không mobile |
| Q-10 | Tính năng mới | AI-01 [M]; AI-04 [C] (tóm tắt dùng template); AI-02 để giai đoạn 2 |
| Q-11 | Coverage | ≥ 85% luồng tiền và state machine; ≥ 60% toàn hệ thống; webhook có test tích hợp (NFR-06) |
| Q-12 | Hạ tầng | Bắt buộc có demo online; trần ~25 USD/tháng; sandbox PayOS/SePay |
| Q-13 | Định danh nhận tiền riêng mỗi campaign | Có trong mô hình dữ liệu và sao kê (BR-11); cách hiện thực theo nhà cung cấp |
| Q-14 | "Ví fundraiser" | Bỏ; thay bằng sổ cái (mục 4.5) |

---

## 10. Rủi ro phạm vi

1. **Sổ cái tiền** — thiết kế bút toán kép và thay thế 3 nguồn số liệu lệch nhau của hệ thống cũ là phần tốn công nhất.
2. **Tích hợp PayOS/SePay và đối soát** — phụ thuộc sandbox; các ca thiếu/dư/không khớp khó tái hiện.
3. **Microservices làm một mình** — giao dịch xuyên service (outbox/saga) nhân đôi công sức; cần ranh giới giảm thiểu luồng tiền xuyên service.
4. **Độ rộng tính năng** — đã giảm bằng cách xếp cộng đồng, huy hiệu, điều phối lại, thông báo đầy đủ, tìm kiếm toàn văn vào [C].
5. **AI-01 kèm bộ eval** — cần khoanh phạm vi (một loại hoá đơn, tập ảnh có nhãn nhỏ) để không tốn quá một tháng.
