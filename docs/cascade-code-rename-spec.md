# Cascade Code Rename & Question ID Rename — OpenSpec

*Khi user đổi option/row code hoặc question ID trong UI, tất cả downstream references phải đồng bộ.*

---

## 1. Vấn đề

### 1A. Option/Row code rename
User đổi `option.code` (11 → 99) hoặc `row.code` trong QuestionCard / EditQuestionModal.
Code mới lưu vào `parsedQuestions`, nhưng code cũ có thể còn nằm trong logic strings và cached graph.

### 1B. Question ID rename
User đổi `question.id` (H27 → H10000) trong EditQuestionModal.
Tất cả syntax output phụ thuộc `question.id`: header, Rename, Var lab, Recode, Val lab.
Ngoài ra, các câu khác có thể reference question ID cũ trong logic.

---

## 2. Bản đồ phụ thuộc

### Tự động sync (đọc `question.id` / `option.code` runtime)

| Component | Cách dùng | File |
|-----------|-----------|------|
| Clean Label Syntax | `*{id}.`, `{id}R{code}`, `{id}_{code}`, Val lab, Recode | `syntaxGenerator.ts` |
| `terminate_if` | Rebuild bởi `autoConvertTerminateOptions` khi `setParsedQuestions` | `surveyStore.ts` |
| QC Graph nodes | Regenerate khi navigate Canvas | `qcGraphConverter.ts` |
| Processing helpers | Đọc code runtime | `processingHelpers.ts` |

### CẦN cascade — Option/Row code

| Component | Ví dụ chứa code cũ | File |
|-----------|-------------------|------|
| `piping_excluded_codes` | `[11, 12]` → `[99, 12]` | `lib/types.ts` |
| `ask_if_condition` | `"IF (Q5R11 = 11)"` → `"IF (Q5R99 = 99)"` | `lib/types.ts` |
| `qcLogicGraph` (cached) | Node IDs stale | `surveyStore` |

### CẦN cascade — Question ID

| Component | Ví dụ chứa ID cũ | File |
|-----------|------------------|------|
| `piping_source` | `"H27"` → `"H10000"` | `lib/types.ts` |
| `ask_if_condition` | `"IF (H27R5 = 5)"` → `"IF (H10000R5 = 5)"` | `lib/types.ts` |
| `terminate_if` | `"IF (H27R15 = 15)"` → `"IF (H10000R15 = 15)"` | `lib/types.ts` |
| `oldVariableMapping` key | `{"H27": [...]}` → `{"H10000": [...]}` | `surveyStore` |
| `questionsMap` key | Old key deleted, new key inserted | `surveyStore` |
| `qcLogicGraph` (cached) | Invalidated | `surveyStore` |

---

## 3. Giải pháp

### 3.1 Hàm `cascadeCodeRename`

```typescript
function cascadeCodeRename(questions, targetQuestionId, oldCode, newCode): ParsedQuestion[]
```

### 3.2 Hàm `cascadeQuestionIdRename`

```typescript
function cascadeQuestionIdRename(
  questions: ParsedQuestion[],
  oldId: string,
  newId: string,
  oldVariableMapping: OldVariableMapping
): { questions: ParsedQuestion[]; oldVariableMapping: OldVariableMapping }
```

**Logic:**
1. Duyệt tất cả câu hỏi, regex replace `\boldId\b` → `newId` trong:
   - `ask_if_condition`
   - `terminate_if`
   - `piping_source` (exact match)
2. Migrate `oldVariableMapping[oldId]` → `oldVariableMapping[newId]`
3. Return immutable

### 3.3 Store `updateQuestion` enhanced

1. Detect `updated.id !== id` → question ID changed
2. Delete old key from `questionsMap`, insert new key
3. Call `cascadeQuestionIdRename` → update all logic + migrate mapping
4. Detect option/row code renames → call `cascadeCodeRename`
5. Set `qcLogicGraph: null`

### 3.4 MainLayout fix

`onSave` passes `editingQuestionId` (OLD id) to `updateQuestion`, not `updatedQuestion.id`.

### 3.5 EditQuestionModal fix

`setQuestionOldVariables` uses `question.id` (original prop), not `finalQuestion.id`.

---

## 4. Regex patterns

### Option/Row code
```
{questionId}R{oldCode}\b  → {questionId}R{newCode}
{questionId}_{oldCode}\b  → {questionId}_{newCode}
{questionId}\s*=\s*{oldCode}\b → {questionId} = {newCode}
```

### Question ID
```
\b{oldId}\b → {newId}
```

---

## 5. Test Matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Đổi MA option code 11→99 | Syntax: Q17R99. Recode: (1=99). Val lab: 99"label" |
| 2 | Đổi SA_Grid row code 11→99 | Syntax: Q18_99 |
| 3 | Đổi code khi có terminate_if | terminate_if tự rebuild |
| 4 | Câu khác có ask_if chứa code cũ | ask_if_condition updated |
| 5 | Câu khác piping_excluded_codes chứa code cũ | Array updated |
| 6 | **Đổi question ID H27→H10000** | Syntax: *H10000. Rename: H10000R1. Var lab: H10000R1"H10000..." |
| 7 | **Đổi question ID khi câu khác ask_if chứa H27** | ask_if_condition: H10000R5 = 5 |
| 8 | **Đổi question ID khi câu khác piping_source = H27** | piping_source: H10000 |
| 9 | **Đổi question ID — oldVariableMapping** | Key migrated: {H10000: [var666O1943, ...]} |
| 10 | Đổi code/ID rồi mở Canvas | Graph regenerate |
| 11 | Đổi code/ID, đóng app, mở lại | Auto-save persisted |
