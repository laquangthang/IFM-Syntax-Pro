# Phân tích lỗi Q8 Brands — R15→R16 & 2 nhãn "None of the above"

## 1. Triệu chứng

```
Rename Variables var397O1344 = Q8_1R15.   ← var397O1344 = "None of the above" (Q8_1A)
Rename Variables var398O1347 = Q8_1R16.   ← var398O1347 = "BPI Sports" (Q8_1B) — SAI!
```

- **R15→R16:** Biến đầu tiên của Q8_1B (BPI Sports) bị gán nhầm vào Q8_1R16 (ô thuộc cột Q8_1A).
- **2 nhãn "None of the above":** Trong Val lab, cả mã 15 và 16 đều là "None of the above".

---

## 2. Nguyên nhân gốc

### 2.1. Dữ liệu gốc không phải một grid đồng nhất

| Câu hỏi | Số lựa chọn | Danh sách |
|---------|-------------|-----------|
| Q8_1A   | 15          | Optimum Nutrition … None of the above |
| Q8_1B   | 16          | BPI Sports, Webber Naturals … None of the above |
| Q8_1C   | 16          | Z Nutrition, Allmax … Other, MyVitamin, None of the above |
| Q8_1D   | 2           | Other (specify), None of the above |

Mỗi câu hỏi có danh sách thương hiệu khác nhau, không phải cùng một bảng ma trận.

### 2.2. Parser gộp thành MA_Grid

Trong `parser.ts` (khoảng dòng 765–850), logic merge:

1. Nhận diện Q8_1A, Q8_1B, Q8_1C, Q8_1D theo pattern `Q8_<số><chữ>`.
2. Gộp tất cả thành một MA_Grid Q8 với:
   - **Cột:** 1, 2, 3, 4 (từ 1A, 1B, 1C, 1D).
   - **Hàng:** hợp (union) tất cả mã đáp án → 1–16.

3. Với mỗi hàng, lấy nhãn từ lần xuất hiện đầu tiên:
   - Hàng 15: "None of the above" (từ Q8_1A).
   - Hàng 16: "None of the above" (từ Q8_1B).

→ Kết quả: có 2 hàng (15 và 16) cùng nhãn "None of the above".

### 2.3. Cách xây `oldVariableMapping`

`oldVariableMapping[Q8]` được tạo theo thứ tự biến trong `variables`:

```
[Q8_1A: 15 biến] + [Q8_1B: 16 biến] + [Q8_1C: 16 biến] + [Q8_1D: 2 biến]
```

Tổng: 15 + 16 + 16 + 2 = 49 biến (không tính Othr).

### 2.4. Cách `generateMAGridSyntax` dùng biến

`generateMAGridSyntax` giả định grid chữ nhật 4×16:

```javascript
columns.forEach((col) => {
  rows.forEach((row) => {
    baseVar = oldVariables[varIndex++]  // varIndex chạy 0..63
  })
})
```

Thứ tự: cột 1 (16 ô) → cột 2 (16 ô) → cột 3 (16 ô) → cột 4 (16 ô).

- Cột 1, hàng 1–15: dùng `oldVariables[0..14]` → đúng (15 biến Q8_1A).
- Cột 1, hàng 16: cần biến thứ 16 của cột 1, nhưng Q8_1A chỉ có 15 biến.
- `varIndex = 15` → lấy `oldVariables[15]` = `var398O1347` (BPI Sports, biến đầu tiên của Q8_1B).

→ Đây là nguồn gốc lỗi gán BPI Sports vào Q8_1R16.

---

## 3. Tóm tắt

| Vấn đề | Nguyên nhân |
|--------|-------------|
| R15→R16 sai | Merge giả định mọi cột có cùng số hàng; Q8_1A chỉ có 15 biến nhưng grid yêu cầu 16 ô cho cột 1. |
| 2 nhãn "None of the above" | Hợp mã đáp án tạo hàng 15 và 16; cả hai đều có nhãn "None of the above" từ Q8_1A và Q8_1B. |

---

## 4. Hướng xử lý

1. **Không merge khi cấu trúc khác nhau:** Chỉ merge khi tất cả cột có cùng số hàng và cùng nhãn hàng.
2. **Giữ Q8_1A, Q8_1B, Q8_1C, Q8_1D là MA riêng:** Nếu danh sách thương hiệu khác nhau, không gộp thành MA_Grid.
3. **Điều chỉnh merge:** Thêm điều kiện (ví dụ: cùng số options, cùng label) trước khi merge.

---

*Phân tích dựa trên `lib/parsers/spss/parser.ts` và `lib/syntaxGenerator.ts`*
