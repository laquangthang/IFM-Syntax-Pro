# Cascade Code Rename — OpenSpec

*Khi user đổi option/row code trong UI, tất cả downstream references phải đồng bộ.*

---

## 1. Vấn đề

User đổi `option.code` (11 → 99) hoặc `row.code` trong QuestionCard / EditQuestionModal.
Code mới lưu vào `parsedQuestions`, nhưng code cũ có thể còn nằm trong logic strings và cached graph.

---

## 2. Bản đồ phụ thuộc

### Tự động sync (đọc `option.code` runtime)

| Component | Cách dùng code | File |
|-----------|---------------|------|
| Clean Label Syntax | `Q17R{code}`, `Q18_{code}`, Val lab, Recode | `syntaxGenerator.ts` |
| `terminate_if` | Rebuild bởi `autoConvertTerminateOptions` khi `setParsedQuestions` | `surveyStore.ts` |
| QC Graph nodes | Regenerate khi navigate Canvas | `qcGraphConverter.ts` |
| Processing helpers | Đọc code runtime | `processingHelpers.ts` |

### CHƯA sync — cần cascade

| Component | Ví dụ chứa code cũ | File |
|-----------|-------------------|------|
| `piping_excluded_codes` | `[11, 12]` → phải thành `[99, 12]` | `lib/types.ts` (QuestionLogic) |
| `ask_if_condition` | `"IF (Q5R11 = 11)"` → `"IF (Q5R99 = 99)"` | `lib/types.ts` (QuestionLogic) |
| `qcLogicGraph` (cached) | Node IDs: `Q17R11` → stale | `surveyStore.qcLogicGraph` |

---

## 3. Giải pháp

### 3.1 Hàm `cascadeCodeRename`

```typescript
// lib/utils/cascadeCodeRename.ts
function cascadeCodeRename(
  questions: ParsedQuestion[],
  targetQuestionId: string,
  oldCode: string | number,
  newCode: string | number
): ParsedQuestion[]
```

**Logic:**
1. Duyệt tất cả câu hỏi
2. `ask_if_condition`: regex find-replace `{questionId}R{oldCode}`, `{questionId}_{oldCode}`, `{questionId} = {oldCode}`
3. `piping_excluded_codes`: replace oldCode → newCode nếu `piping_source === targetQuestionId`
4. Return mảng mới (immutable)

### 3.2 Invalidate graph

Sau cascade, gọi `setQCLogicGraph(null)` để buộc regenerate khi user mở Canvas.

### 3.3 Nơi gọi

| UI | Khi nào | File |
|----|---------|------|
| QuestionCard | User sửa option code / row code | `components/questions/QuestionCard.tsx` |
| EditQuestionModal | User sửa code trong modal | `components/questions/EditQuestionModal.tsx` |

---

## 4. Regex patterns

```
{questionId}R{oldCode}\b  → {questionId}R{newCode}     (MA: Q17R11)
{questionId}_{oldCode}\b  → {questionId}_{newCode}      (SA_Grid: Q18_11)
{questionId}\s*=\s*{oldCode}\b → {questionId} = {newCode} (SA: Q18 = 11)
```

`\b` (word boundary) tránh thay thế partial: Q17R11 không match Q17R110.

---

## 5. Test Matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Đổi MA option code 11→99 | Syntax: Q17R99. Recode: (1=99). Val lab: 99"label" |
| 2 | Đổi SA_Grid row code 11→99 | Syntax: Q18_99 |
| 3 | Đổi code khi có terminate_if | terminate_if tự rebuild → IF (Q17R99 = 99) |
| 4 | Câu khác có ask_if chứa code cũ | ask_if_condition: Q17R99 = 99 |
| 5 | Câu khác piping_excluded_codes chứa code cũ | Array: [99] thay vì [11] |
| 6 | Đổi code rồi mở Canvas | Graph regenerate với node IDs mới |
| 7 | Đổi code, đóng app, mở lại | Auto-save persisted |
