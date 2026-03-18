# Excel Parser — ID Extraction & Deduplication Specs

*OpenSpec: Các trường hợp xử lý ID và deduplication trong `lib/parsers/spss/parser.ts`*

---

## 1. Tổng quan

| Thành phần | Mục đích |
|------------|----------|
| `extractStrictBaseId()` | Trích baseId từ label, không lấy trailing underscores |
| `parseGridPrefixPattern()` | Nhận diện pattern `Prefix_RowCode` (A1a_1, A2_1) |
| `resolveQuestionId()` | Deduplication: khi hai câu khác nhau cùng baseId → suffix _2, _3 |
| `gridVarAccumulator` | Gom biến theo prefix cho SA_Grid (A1a_1..A1a_37) |

---

## 2. Các case KHÔNG dùng resolveQuestionId

*Nhiều raw vars = options/rows của CÙNG một câu hỏi.*

### 2.1 Case 1: var{id} với 2 segments → SA_Grid

**Input:** Nhiều biến cùng format `Label:QuestionID`

| Variable | Label | Kết quả |
|----------|-------|---------|
| var200 | Annual leave:Q18 | Q18_1 |
| var201 | Maternity/Paternity leave:Q18 | Q18_2 |
| var299 | Ghi rõ số ngày phép thai sản:Q18 | Q18_3 |
| ... | ... | ... |
| var206 | [question(option value)...]:Q18 | Q18_11 |

**Output:** Một SA_Grid Q18 với 11 rows → merge thành Q18, Clean Label: Q18_1..Q18_11.

```
Rename Variables var200 = Q18_1.
Rename Variables var201 = Q18_2.
...
Var lab Q18_1"Q18. Annual leave".
```

---

### 2.2 Case 2: Rank — tất cả options cùng questionId

**Input:** var{id}O{n} với [Rank] trong label

| Variable | Label | Kết quả |
|----------|-------|---------|
| var199O1 | Option A [Rank]:Q15 | Q15 |
| var199O2 | Option B [Rank]:Q15 | Q15 |
| var199O3 | Option C [Rank]:Q15 | Q15 |

**Output:** Một Rank question Q15 với 3 options.

---

### 2.3 Case 3: Sum — tất cả options cùng questionId

**Input:** var{id}O{n} với [Sum] trong label

| Variable | Label | Kết quả |
|----------|-------|---------|
| var199O1 | Option A [Sum]:Q16 | Q16 |
| var199O2 | Option B [Sum]:Q16 | Q16 |

**Output:** Một Sum question Q16.

---

### 2.4 Case 6: MA (Multiple Answer) — tất cả options cùng questionId

**Input:** var{id}O{n} với format `OptionLabel:QuestionID`

| Variable | Label | Kết quả |
|----------|-------|---------|
| var199O793 | Annual leave:Q17 | Q17 |
| var199O794 | Maternity/Paternity leave:Q17 | Q17 |
| ... | ... | ... |
| var199O799 | Other (please specify …):Q17 | Q17 |
| var199O799Othr | Other (please specify …):Q17 | Q17R10_O |
| var199O800 | None of above:Q17 | Q17 |

**Output:** Một MA question Q17 với Q17R1..Q17R11.

```
Rename Variables var199O793 = Q17R1.
Rename Variables var199O794 = Q17R2.
...
Rename Variables var199O799Othr = Q17R10_O.
Rename Variables var199O800 = Q17R11.
Val lab Q17R1 to Q17R11
1"Annual leave"
2"Maternity/Paternity leave"
...
11"None of above"
.
```

---

## 3. Case dùng resolveQuestionId

*Hai câu KHÁC NHAU cùng baseId trong label → suffix _2, _3.*

### 3.1 Trường hợp S5/var380 (gốc)

| Variable | Label | Kết quả |
|----------|-------|---------|
| var194 | Something:S5 | Q17 = S5 |
| var380 | Other thing:S5 | Q17_2 = S5_2 |

*Hai câu riêng biệt, không phải options của cùng câu.*

### 3.2 Các case vẫn dùng resolveQuestionId

| Case | Mô tả |
|------|-------|
| Case 4 | var{id} đơn (SA, 1 segment) – `var484` với label `Q0` |
| Case 5 | Grid MA (3 segments) – `Label:Subgroup:Q8` |
| Case 7 | MA trong Loop (PN) |
| Case 8 | SA trong Loop (PN) |
| Case 9 | SA trong Loop (QN) |
| Case 10 | MA trong Loop (QN) |

---

## 4. Smart Grid Prefix Detection

### 4.1 Pattern A1a_1..A1a_37 → SA_Grid A1a

**Input:** `var{id}` với label `A1a_1`, `A1a_2`, ... `A1a_37`

| Variable | Label | Kết quả |
|----------|-------|---------|
| var1 | Label1:A1a_1 | A1a (row 1) |
| var2 | Label2:A1a_2 | A1a (row 2) |
| ... | ... | ... |
| var37 | Label37:A1a_37 | A1a (row 37) |

**Output:** Một SA_Grid A1a với 37 rows.

---

### 4.2 Multi-variable rows: A2_1 với var262 + var263

**Input:** Cùng row code, nhiều biến

| Variable | Label | Kết quả |
|----------|-------|---------|
| var262 | Price:A2_1 | A2_1_1 |
| var263 | Words:A2_1 | A2_1_2 |

**Output:** SA_Grid A2, row 1 có 2 sub-vars → A2_1_1, A2_1_2. Clean Label dùng `rawVariables`.

---

## 5. extractStrictBaseId — Regex

```regex
/^([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)/
```

- `S5` → S5
- `S5 _______`: chỉ lấy S5 (không lấy trailing underscores)
- `A1a_1` → A1a_1
- `Q17` → Q17

---

## 6. parseGridPrefixPattern — Pattern

```regex
/^([A-Za-z0-9]+)_(\d+)$/
```

- `A1a_1` → { prefix: "A1a", rowCode: "1" }
- `A2_1` → { prefix: "A2", rowCode: "1" }
- `Q18` → null (không match)

---

## 7. Tóm tắt

| Scenario | Logic | Ví dụ |
|----------|-------|-------|
| MA options | baseId trực tiếp | Q17R1..R11 |
| Rank/Sum options | baseId trực tiếp | Q15, Q16 |
| SA_Grid (var :Q18) | baseId + "_" + index | Q18_1..Q18_11 |
| Grid prefix (A1a_1) | gridVarAccumulator | A1a (37 rows) |
| Multi-var row (A2_1) | rawVariables | A2_1_1, A2_1_2 |
| Hai câu khác nhau cùng baseId | resolveQuestionId | S5, S5_2 |
