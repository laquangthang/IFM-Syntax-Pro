/**
 * Q5 [SUM] Grid Integration Test
 * Verifies parser correctly groups [SUM] variables into one Numeric question
 * and syntax generator outputs sequential renames with clean labels.
 */

import * as XLSX from 'xlsx'
import { parseSPSSExcel } from '../lib/parsers/spss/parser'
import { generateQuestionSyntax } from '../lib/syntaxGenerator'

const rawData = [
  { varName: 'var307O1127', label: 'Nhà ở cao cấp / sang trọng (biệt thự, căn hộ cao cấp):Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1128', label: 'Nhà ở cấp trung (căn hộ phổ thông, nhà phố):Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1129', label: 'Văn phòng thương mại:Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1130', label: 'Khách sạn/resort:Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1131', label: 'Cửa hàng kinh doanh (showroom, nhà hàng,   ):Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1132', label: 'Công trình công cộng (bệnh viện, trường học,   ):Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
  { varName: 'var307O1133', label: 'Khác:Q5 Tỷ lệ các loại công trình anh/chị đã tư vấn/thi công trong 12 tháng qua (ghi 0 nếu không thực hiện)? [SUM]' },
]

// Build workbook from raw data
const rows: [string, string][] = rawData.map(({ varName, label }) => [varName, label])
const workbook = XLSX.utils.book_new()
const sheet = XLSX.utils.aoa_to_sheet([['Variable', 'Label'], ...rows])
XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')

// Parse
const { questions, oldVariableMapping } = parseSPSSExcel(workbook)

// Find Q5
const q5 = questions.find((q) => q.id === 'Q5')
if (!q5) {
  console.error('FAIL: Q5 not found. Parsed questions:', questions.map((q) => q.id))
  process.exit(1)
}

const oldVars = oldVariableMapping['Q5'] || []
if (oldVars.length !== 7) {
  console.error(`FAIL: Expected 7 variables for Q5, got ${oldVars.length}:`, oldVars)
  process.exit(1)
}

// Generate syntax
const output = generateQuestionSyntax(q5, oldVars)

// Combine and print
const allStatements = [
  ...output.renameStatements,
  ...output.varLabStatements,
].filter(Boolean)

console.log('=== Q5 [SUM] Grid Test Output ===\n')
console.log(allStatements.join('\n'))
console.log('\n=== End ===')
