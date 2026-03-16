# Code Flow Summary — SPSS Excel Import

## Overview

Data ingestion is **SPSS-Excel only**. PDF import has been removed.

### Data Import Flow

1. **Client** (`components/pages/DataImport.tsx`)
   - User uploads Excel file (.xlsx, .xls)
   - File read via `file.arrayBuffer()` → `XLSX.read()`
   - `parseSPSSExcel(workbook)` from `lib/parsers/excelParser.ts`
   - Results → `surveyStore` (parsedQuestions, oldVariableMapping)
   - Auto-saved to `projectStore` (localStorage)

2. **Parser** (`lib/parsers/spss/`)
   - `parser.ts` — Main `parseSPSSExcel()` logic
   - `utils.ts` — splitByColonSegments, classifyVariable, compareQuestionIds
   - `syntaxGenerator.ts` — generateSPSSSyntaxFromResult
   - Input: 2 columns (variable name, label)
   - Output: ParsedQuestion[], oldVariableMapping, syntax arrays

3. **Question Manager** (`components/pages/QuestionManager.tsx`)
   - Excel import uses same `parseSPSSExcel` (SPSS format only)

### Key Files

| File | Purpose |
|------|---------|
| `lib/parsers/excelParser.ts` | Single entry point for SPSS-Excel parsing |
| `lib/parsers/spss/parser.ts` | Main parse logic |
| `lib/parsers/spss/syntaxGenerator.ts` | SPSS syntax output |
| `store/surveyStore.ts` | In-memory state |
| `store/projectStore.ts` | Persisted projects (localStorage) |
