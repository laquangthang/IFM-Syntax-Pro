# Smart Grid Detection — Minimum Rows Rule

*Prevent single-variable `Prefix_N` IDs from being incorrectly merged into SA_Grid.*

---

## 1. Problem

`parseGridPrefixPattern` matches any `Prefix_Number` pattern (e.g. `S14_1`).
When only **one** variable matches a prefix, the grid merge **overwrites** any existing
standalone question with that prefix.

### Example

| Raw Var | Label | Parser outcome (BEFORE fix) |
|---------|-------|---------------------------|
| `var419` | `S14  You'll receive...` | SA question `S14` created |
| `var559` | `S14_1 Anh/chị/em...` | Accumulated → grid merge **overwrites** `S14` |

Result: `S14` becomes `SA_Grid` with 1 row. Original SA question lost.

### Expected

| Raw Var | Expected |
|---------|----------|
| `var419` | `S14` (SA) — standalone |
| `var559` | `S14_1` (SA) — standalone (independent question) |

---

## 2. Root Cause

Two grid merge phases, different safeguards:

| Phase | Location | Row count check |
|-------|----------|-----------------|
| `gridVarAccumulator` merge | Line ~987 | **NONE** (bug) |
| `saGridCandidates` merge | Line ~1058 | `>= 2` (correct) |

---

## 3. Fix: Minimum 2-Rows Rule

### Rule
A `gridVarAccumulator` prefix is only converted to `SA_Grid` when it has **>= 2 distinct row codes**.

### Single-row rescue
When a prefix has only 1 row code, the accumulated variable(s) are "rescued" back as:
- **SA question** in `questionMap` with ID = `Prefix_RowCode` (e.g. `S14_1`)
- **Entry in `variables` array** so `oldVariableMapping` is correctly populated

### Why >= 2 is safe for genuine grids
Real grids always have multiple sub-questions:
- `A2_1`, `A2_2`, `A2_3` → 3 rows → grid ✓
- `Q18_1`, `Q18_2`, ..., `Q18_10` → 10 rows → grid ✓
- `S14_1` alone → 1 row → **not** a grid

---

## 4. Affected Code

| File | Section | Change |
|------|---------|--------|
| `lib/parsers/spss/parser.ts` | gridVarAccumulator merge (~line 987) | Add `rowMap.size >= 2` check |
| Same file | After check | Rescue single-row entries as SA + add to `variables` |

---

## 5. Test Matrix

| # | Input | Expected | Why |
|---|-------|----------|-----|
| 1 | `var419:S14`, `var559:S14_1` (only 1 row) | `S14` (SA) + `S14_1` (SA) separate | Single row → not grid |
| 2 | `var200:Q18_1`, `var201:Q18_2`, `var202:Q18_3` | `Q18` (SA_Grid, 3 rows) | Multiple rows → grid |
| 3 | `A2_1` + `A2_2` with multi-var rows | `A2` (SA_Grid, 2 rows, rawVariables) | Multiple rows → grid |
| 4 | `var100:S14`, `var200:S14_1`, `var300:S14_2` | `S14` (SA) + `S14` (SA_Grid, 2 rows) | 2 grid rows → merge; but `S14` SA exists → check `existingBase` |
| 5 | `X_1` alone (no `X` standalone) | `X_1` (SA) | Single row, no base → standalone |

### Test #4 edge case
If `S14` already exists as SA and grid accumulator has `S14` prefix with >= 2 rows,
the grid merge currently **overwrites**. This is by design — the grid takes precedence
when there are genuine multiple rows. The existing SA's raw variable is preserved
because it was added to `variables` before the grid merge.
