# Code Flow Summary - PDF Extraction Pipeline

## 📋 Tổng quan luồng xử lý

### 1. **Client Side** (`components/pages/DataImport.tsx`)
- User upload PDF file
- Gọi `parseSurveyPDFStructured()` từ `lib/geminiParser.ts`
- Hiển thị progress và kết quả

### 2. **API Route** (`app/api/parse-survey-structured/route.ts`)
- Nhận PDF file từ FormData
- Xử lý qua 4 bước chính:

#### **Step 1: PDF Text Extraction** (`lib/pdfExtractor.ts`)
```
PDF File → ConvertAPI Upload → PDF → HTML → Markdown
                                    ↓
                                 Plain Text (fallback)
```
- Upload PDF lên ConvertAPI
- Convert PDF → HTML (giữ structure, tables)
- Convert HTML → Markdown (tables thành markdown format)
- Extract plain text (fallback)
- Split thành pages

#### **Step 2: Structure Detection** (`lib/structureDetector.ts`)
```
Extracted Pages → Detect Question Boundaries → QuestionBoundary[]
```
- Tìm question IDs (Q1, Q2, Q3A, etc.)
- Tạo boundaries cho mỗi question
- Deduplicate (chỉ giữ match đầu tiên)
- Detect grids và logic patterns

#### **Step 3: Question Parsing** (`parseQuestionRuleBased()`)
```
QuestionBoundary → ParsedQuestion
```
- Detect question type (SA, MA, Grid, Rank, OE)
- Extract instruction và label
- Extract options từ text
- Detect logic (Ask All, Piping, Ask If, Terminate)
- Extract rows/columns cho Grid questions

#### **Step 4: Post-Processing** (`lib/postProcessor.ts`)
```
ParsedQuestions → Sorted → Resolve Dependencies → Validated
```
- Sort questions theo ID
- Resolve piping dependencies (copy options từ source)
- Validate consistency
- Return final questions với validation results

### 3. **Response**
```json
{
  "success": true,
  "questions": ParsedQuestion[],
  "totalQuestions": number,
  "validation": {
    "valid": boolean,
    "errors": string[],
    "warnings": string[]
  }
}
```

## 🔑 Key Files

| File | Chức năng |
|------|-----------|
| `lib/pdfExtractor.ts` | Extract PDF text using ConvertAPI |
| `lib/structureDetector.ts` | Detect question boundaries và extract options |
| `app/api/parse-survey-structured/route.ts` | Main API handler |
| `lib/postProcessor.ts` | Post-process và validate questions |
| `lib/geminiParser.ts` | Client-side parser (types + API call) |

## ✅ Checklist trước khi test

- [x] `.env.local` có `CONVERTAPI_SECRET`
- [x] Port 3000 đã free
- [x] Không có linter errors
- [x] Tất cả dependencies đã install

## 🚀 Để test

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Mở browser:** `http://localhost:3000`

3. **Upload PDF** và xem server logs để debug

## 📊 Expected Server Logs

```
📦 PDF EXTRACTION - Starting...
📄 Step 1: Extracting text from PDF using ConvertAPI...
📤 Uploading PDF to ConvertAPI...
✅ PDF uploaded
📄 Converting PDF to HTML...
✅ HTML conversion complete
📝 Converting HTML to Markdown...
✅ Markdown conversion complete
📄 Extracting plain text...
✅ Text extraction complete
✅ Extracted X pages

🔍 Step 2: Detecting question structure...
🔍 Found X potential question matches
✅ Structure detection complete
📊 Questions detected: X

⚙️ Step 3: Parsing X questions...
✅ Q1: SA (X options)
✅ Q2: MA (X options)
...

🔧 Step 4: Post-processing...
✅ Post-processing complete

✅ Extraction complete!
```

## ⚠️ Common Issues

1. **CONVERTAPI_SECRET not set**: Kiểm tra `.env.local` và restart server
2. **No questions detected**: Kiểm tra PDF có question IDs (Q1, Q2, etc.)
3. **ConvertAPI errors**: Kiểm tra API key và quota
