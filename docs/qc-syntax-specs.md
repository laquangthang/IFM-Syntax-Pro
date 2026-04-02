# QC Syntax Generator — Output Structure & Edge Rules

*Specification for the QC Logic syntax generator (`lib/generators/qcSyntaxGenerator.ts`) and Canvas edge behavior.*

---

## 1. MA_Grid Output Structure

MA_Grid questions with piping produce **grouped blocks** for readability. Output order:

| Block | Description | Example |
|-------|-------------|---------|
| **Forward checks** | Source selected, target missing (piping cross-check) | `if Q7R1 = 1 and count_Q8_1 = 0 check_Q7_Q8_code1 = 1.` |
| **Backward checks** | Target selected, source missing (reverse piping) | `if count_Q8_1 > 0 and mis(Q7R1) check_Q8_Q7_code1 = 1.` |
| **Fallback missing** | No piping edge: standalone count=0 check | `if count_Q8_1 = 0 check_mis_Q8_1 = 1.` |
| **Other Specify** | _O text companion empty when base selected | `if Q8_1R99 = 99 and Q8_1R99_O = "" check_Q8_1R99_O = 1.` |

Blocks are separated by blank lines. Forward and Backward are only generated when a piping edge exists for that column.

---

## 2. Edge Rules (Canvas → Syntax)

| Edge Type | Source | Target | Purpose |
|-----------|--------|--------|---------|
| **F0** | Parent Question Node | Next Parent Question Node | Structural/sequential flow; one per question pair |
| **PIPING** | Option Node (e.g. Q7R1, Q7_1R1) | Parent Question Node | Logic: piping from source option to target |
| **ASK_IF** | Option Node or Parent | Question Node | Logic: conditional routing |
| **F1/F2** | Parent → Child, Child → Child | — | Structural hierarchy (not used in logic checks) |

**F0 simplification:** Only parent-to-parent edges. No per-option F0 edges (reduces visual clutter).

**Piping/Ask If:** Always originate from Option Nodes (or parent for Grid/Numeric) — never from structural F0.

---

## 5. ASK_IF Condition Value Rule

When creating an ASK_IF edge from an MA option node, the condition value must match the **option code** (not 1).

| Source Node | Code | Correct Condition | Wrong |
|-------------|------|-------------------|-------|
| `H3AR5` | 5 | `IF H3AR5 = 5` | `IF H3AR5 = 1` |
| `H3AR7` | 7 | `IF H3AR7 = 7` | `IF H3AR7 = 1` |
| `Q5_3` (Grid) | 3 | `IF Q5_3 = 3` | `IF Q5_3 = 1` |
| `Q1` (SA parent) | — | `IF Q1 = 1` (placeholder) | — |

After Clean Label recode (`Recode H3AR5(0=sysmis)(1=5)`), the variable value is **the code**, not the binary 0/1.

**Accumulation:** Multiple ASK_IF edges from the same source question to the same target merge with OR:
`IF (H3AR5 = 5 OR H3AR7 = 7)`

---

## 3. Bi-directional Sync (MA_Grid Columns ↔ Piping Edges)

| Action | Effect |
|--------|--------|
| **Delete piping edge on Canvas** | Adds code to `piping_excluded_codes`; only that edge removed (1-to-1 binding) |
| **Delete column in Properties** | Removes piping edge for that column (logicModelConverter filters by target columns) |
| **Reconnect piping edge** | Removes code from `piping_excluded_codes` |

**Data model:** `QuestionLogic.piping_excluded_codes?: (string | number)[]` — codes excluded from piping per target question.

---

## 4. Column Matching (Piping Edge → MA_Grid Column)

Strict filter: only option-level edges (`source.includes('R')`) to avoid parent/intermediate hijack.

Match order: `endsWith(R${code})` → `includes(_${code}R)` → `endsWith(_${code})` → `source === code`.
