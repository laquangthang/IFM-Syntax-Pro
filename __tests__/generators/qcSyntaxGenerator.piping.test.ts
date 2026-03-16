/**
 * Unit tests for qcSyntaxGenerator MA → MA_Grid piping scenario.
 * Real-world metadata: Q7_1 (MA, 8 options) pipes to Q8 (MA_Grid, 8 columns × 11 rows).
 * Verifies: dynamic TO syntax, 2-way cross-checks, Other Specify checks, no hardcoded 99.
 */

import { ParsedQuestion } from '@/lib/types'
import { generateAllQCSyntax } from '@/lib/generators/qcSyntaxGenerator'

const mockQuestions: ParsedQuestion[] = [
  {
    id: 'Q7_1',
    questionText: 'Khu vực thi công',
    type: 'MA',
    label: 'Q7_1',
    options: Array.from({ length: 8 }, (_, i) => ({
      code: `${i + 1}`,
      label: `Khu vực ${i + 1}`,
    })),
  },
  {
    id: 'Q8',
    questionText: 'Vật liệu',
    type: 'MA_Grid',
    label: 'Q8',
    logic: { type: 'Piping', piping_source: 'Q7_1' },
    columns: Array.from({ length: 8 }, (_, i) => ({
      code: `${i + 1}`,
      label: `Khu vực ${i + 1}`,
    })),
    rows: Array.from({ length: 11 }, (_, i) => ({
      code: `${i + 1}`,
      label: `Vật liệu ${i + 1}`,
      codeType: i === 10 ? 'Other' : undefined,
    })),
  },
]

describe('qcSyntaxGenerator – MA to MA_Grid piping (Q7_1 → Q8)', () => {
  let output: string

  beforeAll(() => {
    output = generateAllQCSyntax(mockQuestions)
  })

  it('generates COUNT variables with dynamic TO (no hardcoded 99 in MA_Grid)', () => {
    // mainRows = rows 1–10 (row 11 is Other, excluded). Expect (1 thru 10).
    expect(output).toContain(
      'count count_Q8_1 = Q8_1R1 to Q8_1R10 (1 thru 10).'
    )
    // MA_Grid must use dynamic range; must NOT contain Grid count with 99
    expect(output).not.toMatch(/count_Q8_\d+.*thru 99/)
  })

  it('generates Forward Check: source selected but grid column empty', () => {
    expect(output).toContain(
      'if Q7_1R1 = 1 and count_Q8_1 = 0 check_Q7_1_Q8_code1 = 1.'
    )
  })

  it('generates Backward Check: grid column filled but source missing', () => {
    expect(output).toContain(
      'if count_Q8_1 > 0 and mis(Q7_1R1) check_Q8_Q7_1_code1 = 1.'
    )
  })

  it('generates Other Specify Check for row 11', () => {
    expect(output).toContain(
      'if Q8_1R11 = 11 and Q8_1R11_O = "" check_Q8_1R11_O = 1.'
    )
  })

  it('generates COUNT for all 8 columns', () => {
    for (let c = 1; c <= 8; c++) {
      expect(output).toContain(`count count_Q8_${c} = Q8_${c}R1 to Q8_${c}R10 (1 thru 10).`)
    }
  })

  it('generates Forward and Backward checks for each column', () => {
    for (let c = 1; c <= 8; c++) {
      expect(output).toContain(`check_Q7_1_Q8_code${c} = 1`)
      expect(output).toContain(`check_Q8_Q7_1_code${c} = 1`)
    }
  })
})
