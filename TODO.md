# TODO

## Completed

### Upgraded Auto-mode Question Selection to Data Dictionary Popup Modal - 2025-03-15

- **QuestionSelectorModal** (`components/processing/QuestionSelectorModal.tsx`)
  - Centered fixed modal with dark overlay (z-[9999])
  - Sticky search bar to filter by Variable (ID) or Label
  - Scrollable table: Variable (ID) | Type | Label
  - Multi-select (checkboxes) or single-select (click to select)
  - Cancel and Confirm Selection buttons
- **Replaced dropdowns** in TopboxForm, NetcodeForm, RerankForm, ReloopForm (2), RestructForm, RecodeMeansForm, CTablesForm, CTablesV2Form (per-formula)
  - Sleek "Select Question..." button with Search icon
  - Displays selected question ID and label when chosen

### Advanced Prefix-Based Other Pairing (SA/MA Fix) - 2025-03-11

- **Step 1: getBaseVarFromTextCompanion** (`lib/parsers/spss/utils.ts`)
  - Refactored to use prefix-based matching when `knownVariables` is provided
  - Returns the longest existing variable name that is a prefix of the text companion
  - Example: `var522O1635Othr` with known vars `[var522]` → returns `var522`
  - Example: `var522O1635Othr` with known vars `[var522, var522O1635]` → returns `var522O1635`

- **Step 2: Parser Logic** (`lib/parsers/spss/parser.ts`)
  - Build `knownVarSet` from Sheet 1 col1 + Sheet 2 codeLookupMap keys (before main loop)
  - Pass `knownVarSet` to `getBaseVarFromTextCompanion` in main loop and second pass
  - SA Case 1: When text companion (e.g. `var522O1635Othr`) pairs with base `var522`, store `textCompanionVar` on question
  - Post-merge: Mark option with "Khác"/"Other"/"ghi rõ" label as `codeType: 'Other'` and attach `openEndedRawVariable`

- **Step 3: Dictionary & Syntax Sync**
  - `getChildVariables` (processingHelpers.ts): SA with Other now returns `[H5, H5_O]` for New Variables column
  - `generateSAOESyntax` (syntaxGenerator.ts): Rename logic handles SA case: `var522 = H5`, `var522O1635Othr = H5_O`

### Display Paired Other Variables in Question Manager UI - 2025-03-11

- **Step 1: Question Card** (`components/questions/QuestionCard.tsx`)
  - Other badge now shows output variable names: `Other: 1 (Q1R14_O)` or `Other: 2 (14_O, 15_O)`
  - Uses `getOtherOutputVariableNames()` from `lib/utils/mrHelpers.ts`

- **Step 2: Edit Question Modal** (`components/questions/EditQuestionModal.tsx`)
  - For options with `codeType === 'Other'`: shows `Output: [ID]R[code]_O` below Code input (updates when code changes)
  - For rows with `codeType === 'Other'` (MA_Grid): shows `Output: Q8_1R5_O, Q8_2R5_O` (per column)
  - For SA_Grid Other rows: shows `Output: Q24_1_O`

- **Helper** (`lib/utils/mrHelpers.ts`)
  - Added `getOtherOutputVariableNames(question)`: returns predicted _O variable names for SA, MA, SA_Grid, MA_Grid
