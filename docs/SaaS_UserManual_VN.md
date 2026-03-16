# IFM Syntax Pro — Hướng dẫn sử dụng (SaaS User Manual)

*Phiên bản chuyên nghiệp — Viết bằng Tiếng Việt, thuật ngữ kỹ thuật giữ nguyên tiếng Anh.*

---

## 1. Tổng quan hệ thống

**IFM Syntax Pro** là công cụ xây dựng logic QC (Quality Control) dạng Node-based trực quan, phục vụ tự động hóa kiểm tra chất lượng dữ liệu khảo sát trên IBM SPSS.

**Giá trị cốt lõi:** Biến các từ điển biến phức tạp (Excel Dictionary) thành file `.sps` sẵn sàng chạy production mà không cần gõ thủ công.

---

## 2. Quy trình làm việc

| Bước | Mô tả |
|------|-------|
| **1. Import Data** | Import file Excel định dạng SPSS-Excel. Parser trích xuất câu hỏi, biến, nhãn giá trị. |
| **2. Kiểm tra Dictionary** | Xác thực Variables, Rows, Columns tại Questions hoặc Data Dictionary. |
| **3. Ánh xạ Logic trên Canvas** | Vào QC Logic, kéo thả Edge (Piping, Ask If) từ Option Node sang câu hỏi đích. |
| **4. Xem trước & Xuất** | Bấm "Show QC Logic" xem syntax real-time. Bấm Export tải file `.sps`. |

---

## 3. Canvas & tương tác

### Nodes
- **Parent Node:** Đại diện câu hỏi. Double-click mở editor (Columns, Rows, Type, Logic).
- **Child/Option Node:** Đáp án (Q7R1, Q7R2). Piping phải xuất phát từ Option Node.

### Bi-directional Sync
- Xóa cột trong Properties → Edge Piping tương ứng biến mất trên Canvas.
- Xóa Edge trên Canvas → Chỉ dây đó bị loại (1-to-1 binding).

### Edges

| Loại | Quy tắc | Tạo syntax? |
|------|---------|--------------|
| **F0** (xám) | Parent-to-Parent. Một dây giữa hai câu liên tiếp. | Không |
| **Piping / Ask If** (xanh) | Option-to-Target. Kích hoạt engine tạo Forward/Backward check. | Có |

### Thao tác phím
- **Delete/Backspace trên Edge:** Xóa dây. Piping: chỉ dây đó. F0: ẩn khỏi Canvas và syntax.
- **Delete/Backspace trên Node:** Xóa câu hỏi khỏi dự án.

---

## 4. Cỗ máy tạo QC Syntax

### COUNT statements
- MA: `count count_Q7 = Q7R1 to Q7Rn (1 thru n).`
- MA_Grid: `count count_Q8_1 = Q8_1R1 to Q8_1R11 (1 thru 11).` — phạm vi lấy từ rows thực tế.

### Standalone Fallback
`if count_Q8_1 = 0 check_mis_Q8_1 = 1.`

### Piping Cross-checks
- **Forward Check:** Nguồn chọn, đích trống. `if Q7R1 = 1 and count_Q8_1 = 0 check_...`
- **Backward Check:** Đích có, nguồn thiếu. `if count_Q8_1 > 0 and mis(Q7R1) check_...`

Thứ tự output: Forward → Backward → Fallback → Other Specify.

### Exclusive / None
Option "Không có / None of the above" (codeType: Exclusive): nếu chọn đồng thời option khác → flag lỗi.
`if Q7R99 = 99 and count_Q7 > 1 check_Q7R99_excl = 1.`

### Other Specify
`if Q8_1R99 = 99 and Q8_1R99_O = "" check_Q8_1R99_O = 1.`

---

## 5. Xuất bản

- **Xem trước:** "Show QC Logic" — khối syntax 1500+ ký tự, real-time.
- **Export:** Tải `.sps` UTF-8, chạy trực tiếp trong IBM SPSS.
