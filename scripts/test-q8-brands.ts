/**
 * Test Clean Label Syntax - Q8 Brands (MA questions)
 * Data: var397/398/399/914 - Q8_1A, Q8_1B, Q8_1C, Q8_1D
 */

import * as XLSX from 'xlsx'
import { parseSPSSExcel } from '../lib/parsers/spss/parser'
import { generateCompleteSyntax } from '../lib/syntaxGenerator'
import * as fs from 'fs'
import * as path from 'path'

const rawData: [string, string][] = [
  ['var397O1330', 'Optimum Nutrition:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1331', 'Rule 1:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1332', 'Mutant:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1333', 'MyProtein:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1334', 'Dymatize:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1335', 'BiotechUSA:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1336', 'Labrada:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1337', 'OstroVit:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1338', 'Nutricost:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1339', 'Applied Nutrition:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1340', 'Amix Nutrition:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1341', 'Nutrex:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1342', 'MuscleTech:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1343', 'Evlution Nutrition:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var397O1344', 'None of the above:Q8_1A Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1347', 'BPI Sports:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1348', 'Webber Naturals:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1349', 'Now Foods/Sports:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1350', 'Blackmores:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1351', 'DHC:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1352', 'ADA Pharma:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1353', 'Doppelherz:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1354', 'Fresheen Health:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1355', 'Ecopex Natural:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1356', 'Nuta Superfoods:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1357', 'Afit:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1358', 'VitaXtrong:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1359', 'PVL:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1360', 'Orihiro:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1361', 'Scitec Nutrition:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var398O1362', 'None of the above:Q8_1B Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1365', 'Z Nutrition:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1366', 'Allmax Nutrition:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1367', 'Nutrabolics:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1368', 'NutraBio:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1369', 'Perfect Sports:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1370', 'Sports Research:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1371', 'Thorne:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1372', "Bronson Vitamin:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?"],
  ['var399O1373', 'Codeage:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1374', "Doctor's Best:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?"],
  ['var399O1375', 'Healthy Care:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1376', 'Natrol:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1377', 'Orgain:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1378', 'Other (specify …):Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O6801', 'MyVitamin:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1379', 'None of the above:Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var399O1378Othr', 'Other (specify …):Q8_1C Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var914O6797', 'Other (specify):Q8_1D Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var914O6798', 'None of the above:Q8_1D Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
  ['var914O6797Othr', 'Other (specify):Q8_1D Which of the following brands have you ever seen for sale in Vietnam (e g at stores, websites, gyms, or online platforms,   )?'],
]

// Build workbook
const workbook = XLSX.utils.book_new()
const sheet = XLSX.utils.aoa_to_sheet([['Variable', 'Label'], ...rawData])
XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')

// Save Excel for reference
const excelPath = path.join(__dirname, '../test-data/q8-brands-input.xlsx')
fs.mkdirSync(path.dirname(excelPath), { recursive: true })
XLSX.writeFile(workbook, excelPath)
console.log('Saved Excel:', excelPath)

// Parse
const { questions, oldVariableMapping } = parseSPSSExcel(workbook)
console.log('\nParsed questions:', questions.map((q) => ({ id: q.id, type: q.type, options: q.options?.length })))

// Generate Clean Label Syntax
const syntax = generateCompleteSyntax(questions, oldVariableMapping)

// Save output
const outputPath = path.join(__dirname, '../test-data/q8-brands-clean-label.sps')
fs.writeFileSync(outputPath, syntax, 'utf-8')
console.log('\nSaved Clean Label Syntax:', outputPath)

// Also print to console
console.log('\n=== Clean Label Syntax Output ===\n')
console.log(syntax)
console.log('\n=== End ===')
