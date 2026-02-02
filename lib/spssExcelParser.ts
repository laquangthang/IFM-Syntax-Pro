/**
 * SPSS Excel Parser - Parse SPSS variable labels from Excel
 * Input: Excel file with 2 columns (variable name, label)
 * Output: ParsedQuestion[] + generated SPSS syntax
 */

import * as XLSX from 'xlsx'
import { ParsedQuestion, QuestionOption } from './types'

export interface SPSSVariable {
  originalVar: string       // e.g., var1, var2O1, var3PN1
  label: string             // e.g., "Tên sản phẩm:ProductName" or "Option 1:Q1"
  questionId: string        // Extracted question ID (e.g., Q1, ProductName)
  variableType: 'SA' | 'MA' | 'Grid' | 'Loop' | 'Rank' | 'Sum' | 'Unknown'
  optionCode?: number       // For MA: option number (O1 -> 1)
  subIndex?: number         // For Loop/Grid: PN1 -> 1, QN1 -> 1
  optionLabel?: string      // Text before the colon (option description)
}

export interface SPSSParseResult {
  questions: ParsedQuestion[]
  variables: SPSSVariable[]
  oldVariableMapping: Record<string, string[]> // questionId -> original variable names
  syntax: {
    rename: string[]
    varLab: string[]
    valLab: string[]
    recode: string[]
  }
}

/**
 * Split text by colon segments where colon is followed by non-space character
 * Port from Python: split_by_colon_segments
 */
function splitByColonSegments(text: string): string[] {
  const positions: number[] = []
  
  // Find all colons followed by non-space character
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ':') {
      if (i + 1 < text.length && !/\s/.test(text[i + 1])) {
        positions.push(i)
      }
    }
  }
  
  const segments: string[] = []
  
  if (positions.length === 0) {
    return [text.trim()]
  }
  
  // First segment (before first colon)
  segments.push(text.substring(0, positions[0]).trim())
  
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i] + 1 // Skip colon
    const end = i + 1 < positions.length ? positions[i + 1] : text.length
    let segment = text.substring(start, end).trim()
    
    // If last segment, only take first word before space
    if (i === positions.length - 1) {
      const spaceIndex = segment.indexOf(' ')
      if (spaceIndex > 0) {
        segment = segment.substring(0, spaceIndex)
      }
    }
    
    segments.push(segment)
  }
  
  return segments
}

/**
 * Extract last number from path like "text/123"
 */
function extractLastNumber(text: string): string | null {
  const match = text.trim().match(/\/(\d+)$/)
  return match ? match[1] : null
}

/**
 * Remove trailing /number from text
 */
function removeTrailingNumberGroup(text: string): string {
  return text.replace(/\/\d+$/, '')
}

/**
 * Determine variable type from variable name and label
 */
function classifyVariable(varName: string, label: string): SPSSVariable['variableType'] {
  const upperLabel = label.toUpperCase()
  
  // Check for Rank
  if (upperLabel.includes('[RANK]')) return 'Rank'
  
  // Check for Sum
  if (upperLabel.includes('[SUM]')) return 'Sum'
  
  // Check patterns in variable name
  // varXOY = MA (Multiple Answer option)
  // varXOYPN/QN = Grid/Loop with MA
  // varXPN/QN = Loop/Grid
  
  if (/var\d+O\d+(?:Othr)?(?:PN|QN)\d+/i.test(varName)) {
    return 'Loop' // MA in Loop
  }
  
  if (/var\d+(?:PN|QN)\d+/i.test(varName)) {
    return 'Loop' // SA in Loop
  }
  
  if (/var\d+O\d+/i.test(varName)) {
    return 'MA' // Multiple Answer
  }
  
  if (/var\d+$/i.test(varName)) {
    return 'SA' // Single Answer
  }
  
  return 'Unknown'
}

/**
 * Parse variable name to extract components
 */
function parseVariableName(varName: string): {
  varId: string
  optionId?: string
  isOther?: boolean
  loopId?: string
  loopType?: 'PN' | 'QN'
} {
  // Pattern: var{id}O{optionId}Othr?{PN|QN}{loopId}
  const match = varName.match(/^(var\d+)(O\d+)?(Othr)?((PN|QN)([\d_]+))?$/i)
  
  if (!match) {
    return { varId: varName }
  }
  
  return {
    varId: match[1],
    optionId: match[2] || undefined,
    isOther: !!match[3],
    loopId: match[6] || undefined,
    loopType: (match[5] as 'PN' | 'QN') || undefined,
  }
}

/**
 * Parse SPSS Excel file to extract variables and questions
 */
export function parseSPSSExcel(workbook: XLSX.WorkBook): SPSSParseResult {
  const variables: SPSSVariable[] = []
  const questionMap = new Map<string, {
    id: string
    type: ParsedQuestion['type']
    label: string
    options: QuestionOption[]
    rows?: QuestionOption[]
    columns?: QuestionOption[]
    rowOptionsMap?: Record<string, QuestionOption[]>
  }>()
  
  // Counters for generating syntax
  const groupCounts: Record<string, number> = {}
  const qrMapping: Record<string, number> = {}
  const subgroupItemCounts: Record<string, Record<number, number>> = {}
  const rValueMapping: Record<string, Record<string, number>> = {}
  const rankMapping: Record<string, number> = {}
  const sumMapping: Record<string, number> = {}
  const answerOrderMap: Record<string, number> = {}
  const pnMapping: Record<string, number> = {}
  
  // Syntax arrays
  const renameSyntax: string[] = []
  const varLabSyntax: string[] = []
  const valLabSyntax: string[] = []
  const recodeSyntax: string[] = []
  
  // Temporary val lab collection for grouping
  let recodeMA: string[] = []
  let recodeMAVal: string[] = []
  let previousQuestion: string | null = null
  
  // Map to store codes from sheet 2: oldVarName -> [{code, label}, ...]
  const codeLookupMap = new Map<string, Array<{ code: string | number; label: string }>>()
  
  // Read sheet 2 if available (for code lookup)
  if (workbook.SheetNames.length > 1) {
    const sheet2Name = workbook.SheetNames[1]
    const sheet2 = workbook.Sheets[sheet2Name]
    const sheet2Data = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' }) as any[][]
    
    // Process from row 3 (index 2, skip first 2 rows)
    let currentVarName = '' // Track current variable name for merged cells
    for (let i = 2; i < sheet2Data.length; i++) {
      const row = sheet2Data[i]
      if (!row || row.length < 3) continue
      
      let oldVarName = String(row[0] || '').trim()
      const code = String(row[1] || '').trim()
      const label = String(row[2] || '').trim()
      
      // If oldVarName is empty (merged cell), use the last known variable name
      if (!oldVarName && currentVarName) {
        oldVarName = currentVarName
      }
      
      // If we have code and label but no oldVarName, skip this row
      if (!oldVarName || !code || !label) {
        // If we have oldVarName but no code/label, update currentVarName for next rows
        if (oldVarName && oldVarName.toLowerCase() !== 'variable' && oldVarName.toLowerCase() !== 'var') {
          currentVarName = oldVarName
        }
        continue
      }
      
      // Skip header row
      if (oldVarName.toLowerCase() === 'variable' || oldVarName.toLowerCase() === 'var') continue
      
      // Update current variable name
      currentVarName = oldVarName
      
      // Check if this is MA with code 0,1 and labels "Unchecked"/"Checked" - skip these
      const codeNum = parseInt(code)
      const isUncheckedChecked = (
        (codeNum === 0 || codeNum === 1) &&
        (label.toLowerCase() === 'unchecked' || label.toLowerCase() === 'checked')
      )
      
      // Determine if this is MA variable (check if oldVarName matches MA pattern)
      const isMA = /^var\d+O\d+$/.test(oldVarName)
      
      // Skip MA variables with 0,1 Unchecked/Checked codes
      if (isMA && isUncheckedChecked) {
        continue
      }
      
      // Add to lookup map
      if (!codeLookupMap.has(oldVarName)) {
        codeLookupMap.set(oldVarName, [])
      }
      
      const codes = codeLookupMap.get(oldVarName)!
      // Convert code to number if possible, otherwise keep as string
      const codeValue = isNaN(parseInt(code)) ? code : parseInt(code)
      codes.push({ code: codeValue, label })
    }
  }
  
  /**
   * Transform val lab lines to grouped syntax
   */
  function transformTextGeneral(lines: string[]): string[] {
    if (lines.length === 0) return ['']
    
    // Extract first and last question from val lab lines
    const firstMatch = lines[0].match(/Val lab (\S+)/)
    const lastMatch = lines[lines.length - 1].match(/Val lab (\S+)/)
    
    if (!firstMatch || !lastMatch) return lines
    
    const firstQ = firstMatch[1]
    const lastQ = lastMatch[1]
    
    const result = [`Val lab ${firstQ} to ${lastQ}`]
    
    for (const line of lines) {
      const match = line.match(/Val lab \S+ (\d+)"(.+)"/)
      if (match) {
        result.push(`${match[1]}"${match[2]}"`)
      }
    }
    
    if (result.length > 1) {
      result[result.length - 1] += '.'
    }
    
    return result
  }
  
  // Process first sheet
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
  
  // Process each row
  for (let index = 0; index < data.length; index++) {
    const row = data[index]
    if (!row || row.length < 2) continue
    
    const col1 = String(row[0] || '').trim()
    const col2 = String(row[1] || '').trim()
    
    if (!col1 || !col2) continue
    
    // Skip header row
    if (col1.toLowerCase() === 'variable' || col1.toLowerCase() === 'var') continue
    
    const segments = splitByColonSegments(col2)
    const parsed = parseVariableName(col1)
    const varType = classifyVariable(col1, col2)
    
    // Check for Rank pattern
    const matchRank = /\[Rank\]/i.test(col2) ? col2.match(/:(\S+)/) : null
    const matchSum = /\[Sum\]/i.test(col2) ? col2.match(/:(\S+)/) : null
    
    // Case 1: var{id} with 2 segments (SA with question ID)
    if (/^var\d+$/.test(col1) && segments.length === 2) {
      const questionId = segments[1]
      
      if (!groupCounts[questionId]) {
        groupCounts[questionId] = 1
      } else {
        groupCounts[questionId]++
      }
      
      const result = `${questionId}_${groupCounts[questionId]}`
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      
      // Track question
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          id: questionId,
          type: 'SA',
          label: segments[0] || questionId,
          options: [],
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'SA',
        optionLabel: segments[0],
      })
    }
    // Case 2: var{id}O{n} with Rank
    else if (/^var\d+O\d+$/.test(col1) && matchRank && !matchSum) {
      const firstWord = matchRank[1]
      const text = col2.substring(0, col2.indexOf(':' + firstWord))
      
      if (!rankMapping[firstWord]) {
        rankMapping[firstWord] = 1
      } else {
        rankMapping[firstWord]++
      }
      
      const result = `${firstWord}_${rankMapping[firstWord]}`
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      varLabSyntax.push(`Var lab ${result}"${firstWord}. ${text}".`)
      
      // Val lab for ranking
      recodeMAVal.push(`Val lab ${result} ${rankMapping[firstWord]}"Rank ${rankMapping[firstWord]}".`)
      
      const stayQuestion = firstWord
      if (previousQuestion !== stayQuestion) {
        if (recodeMAVal.length > 1) {
          recodeMAVal.pop()
          const transformed = transformTextGeneral(recodeMAVal)
          recodeSyntax.push(...transformed)
        }
        recodeMAVal = []
        previousQuestion = stayQuestion
        recodeMAVal.push(`Val lab ${result} ${rankMapping[firstWord]}"Rank ${rankMapping[firstWord]}".`)
      }
      
      // Track question
      if (!questionMap.has(firstWord)) {
        questionMap.set(firstWord, {
          id: firstWord,
          type: 'Rank_Fixed',
          label: firstWord,
          options: [],
        })
      }
      
      const q = questionMap.get(firstWord)!
      q.options.push({
        code: rankMapping[firstWord],
        label: text || `Rank ${rankMapping[firstWord]}`,
      })
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId: firstWord,
        variableType: 'Rank',
        optionCode: rankMapping[firstWord],
        optionLabel: text,
      })
    }
    // Case 3: var{id}O{n} with Sum
    else if (/^var\d+O\d+$/.test(col1) && matchSum && !matchRank) {
      const firstWord = matchSum[1]
      const text = col2.substring(0, col2.indexOf(':' + firstWord))
      
      if (!sumMapping[firstWord]) {
        sumMapping[firstWord] = 1
      } else {
        sumMapping[firstWord]++
      }
      
      const result = `${firstWord}_${sumMapping[firstWord]}`
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      varLabSyntax.push(`Var lab ${result}"${firstWord}. ${text}".`)
      
      // Track question
      if (!questionMap.has(firstWord)) {
        questionMap.set(firstWord, {
          id: firstWord,
          type: 'Numeric',
          label: firstWord,
          options: [],
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId: firstWord,
        variableType: 'Sum',
        optionCode: sumMapping[firstWord],
        optionLabel: text,
      })
    }
    // Case 4: var{id} simple (SA without suffix)
    else if (/^var\d+$/.test(col1) && segments.length === 1) {
      const firstWordMatch = col2.match(/\S+/)
      const firstWord = firstWordMatch ? firstWordMatch[0] : 'Unknown'
      
      renameSyntax.push(`Rename Variables ${col1} = ${firstWord}.`)
      
      // Track question
      if (!questionMap.has(firstWord)) {
        questionMap.set(firstWord, {
          id: firstWord,
          type: 'SA',
          label: col2,
          options: [],
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId: firstWord,
        variableType: 'SA',
      })
    }
    // Case 5: var{id}O{n} with 3 segments (Grid MA)
    else if (/^var\d+O\d+$/.test(col1) && segments.length === 3) {
      const subgroup = segments[1]
      const questionId = segments[2]
      
      if (!rValueMapping[questionId]) {
        rValueMapping[questionId] = {}
      }
      if (!rValueMapping[questionId][subgroup]) {
        rValueMapping[questionId][subgroup] = Object.keys(rValueMapping[questionId]).length + 1
      }
      
      const rValue = rValueMapping[questionId][subgroup]
      
      if (!subgroupItemCounts[questionId]) {
        subgroupItemCounts[questionId] = {}
      }
      if (!subgroupItemCounts[questionId][rValue]) {
        subgroupItemCounts[questionId][rValue] = 1
      } else {
        subgroupItemCounts[questionId][rValue]++
      }
      
      const itemCount = subgroupItemCounts[questionId][rValue]
      const result = `${questionId}_${rValue}R${itemCount}`
      
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      
      const colonParts = col2.split(/:(?=\S)/)
      const text = colonParts[0] || ''
      const text2 = colonParts[1]?.split(':')[0] || subgroup
      
      varLabSyntax.push(`Var lab ${result}"${questionId}_${rValue}. ${text2}_${text}".`)
      recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${itemCount}) into ${result}.`)
      recodeMAVal.push(`Val lab ${result} ${itemCount}"${text2}_${text}".`)
      
      const stayQuestion = `${questionId}_${rValue}`
      if (previousQuestion !== stayQuestion) {
        if (recodeSyntax.length > 1 && recodeMAVal.length > 1) {
          recodeSyntax.pop()
          recodeMAVal.pop()
          const transformed = transformTextGeneral(recodeMAVal)
          recodeSyntax.push(...transformed)
        }
        recodeMAVal = []
        previousQuestion = stayQuestion
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${itemCount}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${itemCount}"${text2}_${text}".`)
      }
      
      // Track question as MA_Grid
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          id: questionId,
          type: 'MA_Grid',
          label: questionId,
          options: [],
          rows: [],
          columns: [],
        })
      }
      
      const q = questionMap.get(questionId)!
      // Add column if not exists
      if (!q.columns?.some(c => c.code === rValue)) {
        q.columns?.push({
          code: rValue,
          label: subgroup,
        })
      }
      // Add row
      if (!q.rows?.some(r => r.label === text)) {
        q.rows?.push({
          code: itemCount,
          label: text,
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'Grid',
        subIndex: rValue,
        optionCode: itemCount,
        optionLabel: text,
      })
    }
    // Case 6: var{id}O{n} with 2 segments (MA)
    else if (/^var\d+O\d+$/.test(col1) && segments.length === 2 && !matchSum && !matchRank) {
      const questionId = segments[1]
      
      if (!qrMapping[questionId]) {
        qrMapping[questionId] = 1
      } else {
        qrMapping[questionId]++
      }
      
      const optionNum = qrMapping[questionId]
      const result = `${questionId}R${optionNum}`
      
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      
      const text = segments[0]
      varLabSyntax.push(`Var lab ${result}"${questionId}. ${text}".`)
      
      recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${optionNum}) into ${result}.`)
      recodeMAVal.push(`Val lab ${result} ${optionNum}"${text}".`)
      
      const stayQuestion = questionId
      if (previousQuestion !== stayQuestion) {
        if (recodeSyntax.length > 1 && recodeMAVal.length > 1) {
          recodeSyntax.pop()
          recodeMAVal.pop()
          const transformed = transformTextGeneral(recodeMAVal)
          recodeSyntax.push(...transformed)
        }
        recodeMAVal = []
        previousQuestion = stayQuestion
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${optionNum}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${optionNum}"${text}".`)
      }
      
      // Track question as MA
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          id: questionId,
          type: 'MA',
          label: questionId,
          options: [],
        })
      }
      
      const q = questionMap.get(questionId)!
      q.options.push({
        code: optionNum,
        label: text,
      })
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'MA',
        optionCode: optionNum,
        optionLabel: text,
      })
    }
    // Case 7: var{id}O{n}Othr?PN{loopId} (MA in Loop)
    else if (/^var\d+O\d+(Othr)?PN[\d_]+$/.test(col1)) {
      const match = col1.match(/^(var\d+)(O\d+)(Othr)?(PN[\d_]+)$/)
      if (!match) continue
      
      const [, varId, optionId, othrFlag, pnRaw] = match
      const matchQuestion = col2.match(/:(\S+)/)
      const questionId = matchQuestion ? matchQuestion[1] : 'Unknown'
      
      // Extract PN number
      const pnNumbers = col1.match(/PN(\d+(?:_\d+)*)/)
      const subQuestion = pnNumbers ? '_' + pnNumbers[1].split('_').pop() : '_'
      
      const key = `${questionId},${subQuestion},${optionId}`
      if (answerOrderMap[key] !== undefined) {
        // Already processed
      } else {
        const qsKey = `${questionId},${subQuestion}`
        if (!qrMapping[qsKey]) {
          qrMapping[qsKey] = 1
        } else {
          qrMapping[qsKey]++
        }
        answerOrderMap[key] = qrMapping[qsKey]
      }
      
      const answerOrder = answerOrderMap[key]
      const colonParts = col2.split(/:(?=\S)/)
      const text = colonParts[0] || ''
      
      let result: string
      if (othrFlag) {
        result = `${questionId}${subQuestion}R${answerOrder}_99`
        varLabSyntax.push(`Var lab ${result}"${questionId}. ??_${text}".`)
      } else {
        result = `${questionId}${subQuestion}R${answerOrder}`
        varLabSyntax.push(`Var lab ${result}"${questionId}. ??_${text}".`)
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${answerOrder}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${answerOrder}"${text}".`)
      }
      
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      
      const stayQuestion = `${questionId}${subQuestion}`
      if (previousQuestion !== stayQuestion && !othrFlag) {
        if (recodeSyntax.length > 1 && recodeMAVal.length > 1) {
          recodeSyntax.pop()
          recodeMAVal.pop()
          const transformed = transformTextGeneral(recodeMAVal)
          recodeSyntax.push(...transformed)
        }
        recodeMAVal = []
        previousQuestion = stayQuestion
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${answerOrder}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${answerOrder}"${text}".`)
      }
      
      // Track question as MA_Grid (Loop)
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          id: questionId,
          type: 'MA_Grid',
          label: questionId,
          options: [],
          rows: [],
          columns: [],
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'Loop',
        subIndex: parseInt(subQuestion.replace('_', '') || '1'),
        optionCode: answerOrder,
        optionLabel: text,
      })
    }
    // Case 8: var{id}PN{loopId} (SA in Loop)
    else if (/^var\d+PN\d+$/.test(col1)) {
      const temp = splitByColonSegments(col2)
      
      if (temp.length === 1) {
        const matchPN = col1.match(/var(\d+)PN(\d+)/)
        if (!matchPN) continue
        
        const [, varId, pnId] = matchPN
        const matchQuestion = col2.match(/^(\S+)/)
        const questionId = matchQuestion ? matchQuestion[1] : 'Unknown'
        
        const result = `${questionId}_${pnId}`
        renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
        
        // Track question
        if (!questionMap.has(questionId)) {
          questionMap.set(questionId, {
            id: questionId,
            type: 'SA_Grid',
            label: col2,
            options: [],
            rows: [],
            columns: [],
          })
        }
        
        variables.push({
          originalVar: col1,
          label: col2,
          questionId,
          variableType: 'Loop',
          subIndex: parseInt(pnId),
        })
      } else if (temp.length === 2) {
        const matchPN = col1.match(/var(\d+)(PN[\d_]+)$/)
        if (!matchPN) continue
        
        const questionId = temp[1]
        const subQuestion = removeTrailingNumberGroup(temp[0])
        const pnNow = extractLastNumber(temp[0])
        
        const stayQuestion = questionId
        if (previousQuestion !== stayQuestion) {
          previousQuestion = questionId
          // Reset mappings for new question - clear all entries
          Object.keys(pnMapping).forEach(k => delete pnMapping[k])
          Object.keys(qrMapping).forEach(k => delete qrMapping[k])
        }
        
        if (!pnMapping[subQuestion]) {
          pnMapping[subQuestion] = Object.keys(pnMapping).length + 1
        }
        if (!qrMapping[subQuestion]) {
          qrMapping[subQuestion] = 1
        } else {
          qrMapping[subQuestion]++
        }
        
        const answerOrder = qrMapping[subQuestion]
        const answerOrder2 = pnMapping[subQuestion]
        
        const result = `${questionId}_${answerOrder2}_${answerOrder}`
        renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
        varLabSyntax.push(`Var lab ${result}"${questionId}. ??_${temp[0]}".`)
        
        // Track question
        if (!questionMap.has(questionId)) {
          questionMap.set(questionId, {
            id: questionId,
            type: 'SA_Grid',
            label: questionId,
            options: [],
            rows: [],
            columns: [],
          })
        }
        
        variables.push({
          originalVar: col1,
          label: col2,
          questionId,
          variableType: 'Loop',
          subIndex: answerOrder2,
          optionCode: answerOrder,
          optionLabel: temp[0],
        })
      }
    }
    // Case 9: var{id}QN{loopId} (SA in Loop - QN variant)
    else if (/^var\d+QN\d+$/.test(col1) && col2.includes(':')) {
      const temp = splitByColonSegments(col2)
      
      if (temp.length === 2) {
        const recordId = temp[0]
        const questionId = temp[1]
        const result = `${questionId}_${recordId}`
        
        renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
        varLabSyntax.push(`Var lab ${result}"${col2}".`)
        
        // Track question
        if (!questionMap.has(questionId)) {
          questionMap.set(questionId, {
            id: questionId,
            type: 'SA_Grid',
            label: questionId,
            options: [],
            rows: [],
            columns: [],
          })
        }
        
        variables.push({
          originalVar: col1,
          label: col2,
          questionId,
          variableType: 'Loop',
          optionLabel: recordId,
        })
      } else if (temp.length === 3) {
        const recordId = temp[0]
        const questionId = temp[2]
        const result = `${questionId}_${recordId}`
        
        renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
        varLabSyntax.push(`Var lab ${result}"${col2}".`)
        
        // Track question
        if (!questionMap.has(questionId)) {
          questionMap.set(questionId, {
            id: questionId,
            type: 'SA_Grid',
            label: questionId,
            options: [],
            rows: [],
            columns: [],
          })
        }
        
        variables.push({
          originalVar: col1,
          label: col2,
          questionId,
          variableType: 'Loop',
          optionLabel: recordId,
        })
      }
    }
    // Case 10: var{id}O{n}QN{loopId} (MA in Loop - QN variant)
    else if (/^var\d+O\d+(Othr)?QN\d+$/.test(col1)) {
      const match = col1.match(/^(var\d+)(O\d+)(Othr)?(QN[\d_]+)$/)
      if (!match) continue
      
      const [, varId, optionId, othrFlag, qnRaw] = match
      const segments3 = splitByColonSegments(col2)
      const questionId = segments3.length >= 3 ? segments3[2] : 'Unknown'
      
      // Extract QN number
      const qnNumbers = col1.match(/QN(\d+(?:_\d+)*)/)
      const subQuestion = qnNumbers ? '_' + qnNumbers[1].split('_').pop() : '_'
      
      const key = `${questionId},${subQuestion},${optionId}`
      if (answerOrderMap[key] === undefined) {
        const qsKey = `${questionId},${subQuestion}`
        if (!qrMapping[qsKey]) {
          qrMapping[qsKey] = 1
        } else {
          qrMapping[qsKey]++
        }
        answerOrderMap[key] = qrMapping[qsKey]
      }
      
      const answerOrder = answerOrderMap[key]
      const colonParts = col2.split(/:(?=\S)/)
      const text = colonParts[0] || ''
      
      let result: string
      if (othrFlag) {
        result = `${questionId}${subQuestion}R${answerOrder}_99`
        varLabSyntax.push(`Var lab ${result}"${questionId}. ??_${text}".`)
      } else {
        result = `${questionId}${subQuestion}R${answerOrder}`
        varLabSyntax.push(`Var lab ${result}"${questionId}. ??_${text}".`)
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${answerOrder}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${answerOrder}"${text}".`)
      }
      
      renameSyntax.push(`Rename Variables ${col1} = ${result}.`)
      
      const stayQuestion = `${questionId}${subQuestion}`
      if (previousQuestion !== stayQuestion && !othrFlag) {
        if (recodeSyntax.length > 1 && recodeMAVal.length > 1) {
          recodeSyntax.pop()
          recodeMAVal.pop()
          const transformed = transformTextGeneral(recodeMAVal)
          recodeSyntax.push(...transformed)
        }
        recodeMAVal = []
        previousQuestion = stayQuestion
        recodeSyntax.push(`Recode ${result}(0=sysmis)(1=${answerOrder}) into ${result}.`)
        recodeMAVal.push(`Val lab ${result} ${answerOrder}"${text}".`)
      }
      
      // Track question as MA_Grid (Loop)
      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          id: questionId,
          type: 'MA_Grid',
          label: questionId,
          options: [],
          rows: [],
          columns: [],
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'Loop',
        subIndex: parseInt(subQuestion.replace('_', '') || '1'),
        optionCode: answerOrder,
        optionLabel: text,
      })
    }
  }
  
  // Final transform for remaining val lab
  if (recodeMAVal.length > 0) {
    const transformed = transformTextGeneral(recodeMAVal)
    recodeSyntax.push(...transformed)
  }
  
  // Process Other (Othr) variables in second pass
  for (let index = 0; index < data.length; index++) {
    const row = data[index]
    if (!row || row.length < 2) continue
    
    const varName = String(row[0] || '').trim()
    const label = String(row[1] || '').trim()
    
    // Check for Othr pattern: var{id}O{n}Othr
    const othrMatch = varName.match(/^(var\d+O\d+)Othr$/)
    if (!othrMatch) continue
    
    const baseVar = othrMatch[1]
    const colonParts = label.split(/:(?=\S)/)
    const text = colonParts[0] || ''
    const matchFirst = colonParts[1]?.match(/^(\S+)/)
    const firstWord = matchFirst ? matchFirst[1].replace(/:$/, '') : 'Unknown'
    
    // Find the base variable in rename syntax
    const baseIndex = renameSyntax.findIndex(line => line.includes(baseVar + ' ='))
    if (baseIndex >= 0) {
      // Extract the renamed base variable name
      const baseMatch = renameSyntax[baseIndex].match(/= (\S+)\./)
      if (baseMatch) {
        const baseResult = baseMatch[1]
        const othrResult = `${baseResult}_99`
        
        // Insert after base variable
        renameSyntax.splice(baseIndex + 1, 0, `Rename Variables ${varName} = ${othrResult}.`)
        varLabSyntax.push(`Var lab ${othrResult}"${firstWord}. ${text}".`)
      }
    } else {
      // Fallback: find any matching rename for this var prefix
      const varPrefix = varName.match(/^var\d+/)?.[0]
      if (varPrefix) {
        const indices = renameSyntax
          .map((line, i) => (line.includes(varPrefix) ? i : -1))
          .filter(i => i >= 0)
        
        if (indices.length > 0) {
          const lastIndex = indices[indices.length - 1]
          const othrResult = `${firstWord}_99_${indices.length}`
          
          renameSyntax.splice(lastIndex + 1, 0, `Rename Variables ${varName} = ${othrResult}.`)
          varLabSyntax.push(`Var lab ${othrResult}"${firstWord}. ${text}".`)
        }
      }
    }
  }
  
  // Post-process: Merge MA variables with _XRY pattern into MA_Grid
  // Pattern: Q8_1R1, Q8_1R2, Q8_2R1, Q8_2R2 → Q8 (MA_Grid) with columns [1, 2] and rows [1, 2]
  const maGridCandidates = new Map<string, {
    columns: Set<string>
    rows: Map<string, string> // row code → row label
    labels: Map<string, string> // column code → column label (from first occurrence)
    baseLabel: string
  }>()
  
  // Scan questionMap for MA_Grid pattern
  for (const [qId, qData] of questionMap.entries()) {
    // Check if this looks like a MA_Grid sub-variable: Q8_1, Q8_2 (where options are R1, R2...)
    const subMatch = qId.match(/^([A-Za-z]+\d+)_(\d+[a-z]?)$/i)
    if (subMatch && qData.type === 'MA' && qData.options && qData.options.length > 0) {
      const baseQId = subMatch[1] // Q8
      const colCode = subMatch[2] // 1, 2, 1a, 1b...
      
      if (!maGridCandidates.has(baseQId)) {
        maGridCandidates.set(baseQId, {
          columns: new Set(),
          rows: new Map(),
          labels: new Map(),
          baseLabel: qData.label,
        })
      }
      
      const candidate = maGridCandidates.get(baseQId)!
      candidate.columns.add(colCode)
      candidate.labels.set(colCode, qData.label)
      
      // Extract rows from options (R1, R2, ...)
      for (const opt of qData.options) {
        const rowCode = String(opt.code)
        if (!candidate.rows.has(rowCode)) {
          candidate.rows.set(rowCode, opt.label)
        }
      }
    }
  }
  
  // Merge MA_Grid candidates
  for (const [baseQId, candidate] of maGridCandidates.entries()) {
    // Only merge if we have multiple columns (otherwise it's just MA)
    if (candidate.columns.size >= 2) {
      // Remove individual sub-questions
      for (const colCode of candidate.columns) {
        const subQId = `${baseQId}_${colCode}`
        questionMap.delete(subQId)
      }
      
      // Create merged MA_Grid question
      const sortedColumns = Array.from(candidate.columns).sort((a, b) => {
        // Sort: 1, 1a, 1b, 2, 2a, 2b...
        const aNum = parseInt(a) || 0
        const bNum = parseInt(b) || 0
        if (aNum !== bNum) return aNum - bNum
        return a.localeCompare(b)
      })
      
      const sortedRows = Array.from(candidate.rows.entries()).sort((a, b) => {
        const aNum = parseInt(a[0]) || 0
        const bNum = parseInt(b[0]) || 0
        return aNum - bNum
      })
      
      questionMap.set(baseQId, {
        id: baseQId,
        type: 'MA_Grid',
        label: candidate.baseLabel,
        options: [],
        columns: sortedColumns.map((code, idx) => ({
          code: idx + 1,
          label: candidate.labels.get(code) || `Column ${code}`,
        })),
        rows: sortedRows.map(([code, label]) => ({
          code: parseInt(code) || code,
          label: label,
        })),
      })
    }
  }
  
  // Lookup codes from sheet 2 for SA questions that don't have options
  // This should happen BEFORE merging SA_Grid, so we lookup for individual sub-questions first
  // Map oldVarName to questionId for lookup
  const oldVarToQuestionIdMap = new Map<string, string>()
  for (const v of variables) {
    if (!oldVarToQuestionIdMap.has(v.originalVar)) {
      oldVarToQuestionIdMap.set(v.originalVar, v.questionId)
    }
  }
  
  // For each SA question without options, try to find codes from sheet 2
  // Do this BEFORE merging SA_Grid
  for (const [qId, qData] of questionMap.entries()) {
    if (qData.type === 'SA' && qData.options.length === 0) {
      // Find all oldVarNames that map to this questionId
      const oldVarNames: string[] = []
      for (const [oldVar, mappedQId] of oldVarToQuestionIdMap.entries()) {
        if (mappedQId === qId) {
          oldVarNames.push(oldVar)
        }
      }
      
      // Lookup codes from sheet 2 for any of these oldVarNames
      const foundCodes = new Map<string | number, string>() // code -> label
      for (const oldVarName of oldVarNames) {
        const codes = codeLookupMap.get(oldVarName)
        if (codes) {
          for (const { code, label } of codes) {
            // Avoid duplicates
            if (!foundCodes.has(code)) {
              foundCodes.set(code, label)
            }
          }
        }
      }
      
      // Add found codes to question options
      if (foundCodes.size > 0) {
        const sortedCodes = Array.from(foundCodes.entries()).sort((a, b) => {
          const aNum = typeof a[0] === 'number' ? a[0] : parseInt(String(a[0])) || 0
          const bNum = typeof b[0] === 'number' ? b[0] : parseInt(String(b[0])) || 0
          return aNum - bNum
        })
        
        qData.options = sortedCodes.map(([code, label]) => ({
          code: code,
          label: label,
        }))
      }
    }
  }
  
  // Post-process: Merge SA variables with _X pattern into SA_Grid
  // Pattern: Q24_1, Q24_2, Q24_3, ..., Q24_8 → Q24 (SA_Grid) with rows [1, 2, 3, ..., 8]
  // Each row (sub-question) has its own options from sheet 2
  const saGridCandidates = new Map<string, {
    rows: Map<string, string> // row index → row label (from question label)
    baseLabel: string
    rowOptions: Map<string, QuestionOption[]> // row index → options for that row
  }>()
  
  // Scan questionMap for SA_Grid pattern
  for (const [qId, qData] of questionMap.entries()) {
    // Check if this looks like a SA_Grid sub-variable: Q24_1, Q24_2, Q24_3, ... (SA type with _number pattern)
    const subMatch = qId.match(/^([A-Za-z]+\d+)_(\d+)$/i)
    if (subMatch && qData.type === 'SA') {
      const baseQId = subMatch[1] // Q24
      const rowIndex = subMatch[2] // 1, 2, 3, ...
      
      if (!saGridCandidates.has(baseQId)) {
        saGridCandidates.set(baseQId, {
          rows: new Map(),
          baseLabel: qData.label, // Use first label as base label
          rowOptions: new Map(),
        })
      }
      
      const candidate = saGridCandidates.get(baseQId)!
      // Store row with index as key, label as value
      candidate.rows.set(rowIndex, qData.label)
      
      // Store options for this specific row (sub-question)
      if (qData.options && qData.options.length > 0) {
        candidate.rowOptions.set(rowIndex, [...qData.options])
      }
    }
  }
  
  // Merge SA_Grid candidates (only if we have multiple rows)
  for (const [baseQId, candidate] of saGridCandidates.entries()) {
    // Only merge if we have multiple rows (at least 2)
    if (candidate.rows.size >= 2) {
      // Remove individual sub-questions
      for (const rowIndex of candidate.rows.keys()) {
        const subQId = `${baseQId}_${rowIndex}`
        questionMap.delete(subQId)
      }
      
      // Sort rows by index (numeric)
      const sortedRows = Array.from(candidate.rows.entries()).sort((a, b) => {
        const aNum = parseInt(a[0]) || 0
        const bNum = parseInt(b[0]) || 0
        return aNum - bNum
      })
      
      // Convert rowOptions Map to Record<string, QuestionOption[]>
      const rowOptionsMap: Record<string, QuestionOption[]> = {}
      for (const [rowIndex, options] of candidate.rowOptions.entries()) {
        rowOptionsMap[rowIndex] = options
      }
      
      // Create merged SA_Grid question
      questionMap.set(baseQId, {
        id: baseQId,
        type: 'SA_Grid',
        label: candidate.baseLabel,
        options: [], // SA_Grid doesn't use common options, each row has its own
        rows: sortedRows.map(([index, label]) => ({
          code: parseInt(index) || index,
          label: label,
        })),
        rowOptionsMap: Object.keys(rowOptionsMap).length > 0 ? rowOptionsMap : undefined,
      })
    }
  }
  
  // Convert questionMap to ParsedQuestion[]
  const questions: ParsedQuestion[] = Array.from(questionMap.values()).map(q => ({
    id: q.id,
    type: q.type,
    label: q.label,
    options: q.options.length > 0 ? q.options : undefined,
    rows: q.rows && q.rows.length > 0 ? q.rows : undefined,
    columns: q.columns && q.columns.length > 0 ? q.columns : undefined,
    rowOptionsMap: q.rowOptionsMap,
    // Initialize logic object to ensure it exists for editing
    logic: {
      type: 'Normal',
      piping_source: null,
      terminate_if: null,
      ask_if_condition: null,
    },
  }))
  
  // Sort questions by ID with proper handling of sub-questions
  // Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
  questions.sort((a, b) => {
    return compareQuestionIds(a.id, b.id)
  })
  
  // Build oldVariableMapping from variables
  // This maps questionId -> array of original variable names
  // Also handle merged MA_Grid questions (H8_1, H8_2 → H8)
  const oldVariableMapping: Record<string, string[]> = {}
  
  // Build a map of sub-question IDs to base question IDs (for merged MA_Grid and SA_Grid)
  const subToBaseMap = new Map<string, string>()
  for (const [baseQId, candidate] of maGridCandidates.entries()) {
    if (candidate.columns.size >= 2) {
      // This was merged
      for (const colCode of candidate.columns) {
        const subQId = `${baseQId}_${colCode}`
        subToBaseMap.set(subQId, baseQId)
      }
    }
  }
  
  // Also map SA_Grid sub-questions to base question
  for (const [baseQId, candidate] of saGridCandidates.entries()) {
    if (candidate.rows.size >= 2) {
      // This was merged
      for (const rowIndex of candidate.rows.keys()) {
        const subQId = `${baseQId}_${rowIndex}`
        subToBaseMap.set(subQId, baseQId)
      }
    }
  }
  
  for (const v of variables) {
    // Check if this variable's questionId was merged into a base question
    const effectiveQId = subToBaseMap.get(v.questionId) || v.questionId
    
    if (!oldVariableMapping[effectiveQId]) {
      oldVariableMapping[effectiveQId] = []
    }
    // Only add if not already present
    if (!oldVariableMapping[effectiveQId].includes(v.originalVar)) {
      oldVariableMapping[effectiveQId].push(v.originalVar)
    }
  }
  
  return {
    questions,
    variables,
    oldVariableMapping,
    syntax: {
      rename: renameSyntax,
      varLab: varLabSyntax,
      valLab: valLabSyntax,
      recode: recodeSyntax,
    },
  }
}

/**
 * Compare two question IDs for sorting
 * Handles: Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
 */
function compareQuestionIds(a: string, b: string): number {
  // Parse question ID into parts: prefix, main number, sub-parts
  const parseQId = (id: string) => {
    // Match: (prefix)(number)(_sub1)(_sub2)?
    // Examples: Q1, Q8, Q8_1, Q8_1a, Q8_1_2, H1
    const match = id.match(/^([A-Za-z]+)(\d+)(?:_(\d+[a-z]?))?(?:_(\d+[a-z]?))?/i)
    if (!match) return { prefix: id, num: 0, sub1: '', sub2: '' }
    
    return {
      prefix: match[1].toUpperCase(),
      num: parseInt(match[2]) || 0,
      sub1: match[3] || '',
      sub2: match[4] || '',
    }
  }
  
  const aParts = parseQId(a)
  const bParts = parseQId(b)
  
  // Sort by prefix first (A-Z)
  if (aParts.prefix !== bParts.prefix) {
    return aParts.prefix.localeCompare(bParts.prefix)
  }
  
  // Then by main number
  if (aParts.num !== bParts.num) {
    return aParts.num - bParts.num
  }
  
  // Then by sub1 (if both have sub1)
  if (aParts.sub1 || bParts.sub1) {
    // No sub1 comes before having sub1
    if (!aParts.sub1) return -1
    if (!bParts.sub1) return 1
    
    // Compare sub1 numerically first, then alphabetically
    const aSub1Num = parseInt(aParts.sub1) || 0
    const bSub1Num = parseInt(bParts.sub1) || 0
    if (aSub1Num !== bSub1Num) return aSub1Num - bSub1Num
    
    // Same number, compare full string (for 1a, 1b)
    if (aParts.sub1 !== bParts.sub1) {
      return aParts.sub1.localeCompare(bParts.sub1)
    }
  }
  
  // Then by sub2
  if (aParts.sub2 || bParts.sub2) {
    if (!aParts.sub2) return -1
    if (!bParts.sub2) return 1
    
    const aSub2Num = parseInt(aParts.sub2) || 0
    const bSub2Num = parseInt(bParts.sub2) || 0
    if (aSub2Num !== bSub2Num) return aSub2Num - bSub2Num
    
    return aParts.sub2.localeCompare(bParts.sub2)
  }
  
  return 0
}

/**
 * Extract base question ID from variable name
 * Examples:
 * - "Q1_1" -> "Q1"
 * - "Q1_1R2" -> "Q1"  (MA_Grid: Q1 with column _1 and row R2)
 * - "Q1R1" -> "Q1"    (MA: Q1 with row R1)
 * - "Q8_1a" -> "Q8"   (sub-question)
 * - "H1_2R3" -> "H1"
 */
function extractBaseQuestionId(varName: string): string | null {
  // Pattern: (prefix)(number) optionally followed by _X, _XRY, RY, etc.
  // We want to extract just the base: prefix + first number
  const match = varName.match(/^([A-Za-z]+\d+)/)
  return match ? match[1] : null
}

/**
 * Extract question ID from a syntax line
 * Examples:
 * - "Rename Variables var1 = Q1_1." -> "Q1"
 * - "Rename Variables var1 = Q8_1R2." -> "Q8"
 * - "Var lab Q1R1..." -> "Q1"
 * - "Recode Q1R1..." -> "Q1"
 * - "Val lab Q1R1..." -> "Q1"
 */
function extractQuestionIdFromSyntax(line: string): string | null {
  // Skip comment lines and empty lines
  if (!line || line.startsWith('*') || line.trim() === '') return null
  
  // Pattern: extract the first question-like identifier after = or after command keyword
  // For rename: "Rename Variables var1 = Q1_1." -> Q1
  const renameMatch = line.match(/Rename Variables \S+ = ([A-Za-z]+[\dA-Za-z_]+)/i)
  if (renameMatch) {
    return extractBaseQuestionId(renameMatch[1])
  }
  
  // For Var lab: "Var lab Q1R1..." -> Q1
  const varLabMatch = line.match(/Var lab ([A-Za-z]+[\dA-Za-z_]+)/i)
  if (varLabMatch) {
    return extractBaseQuestionId(varLabMatch[1])
  }
  
  // For Recode: "Recode Q1R1..." -> Q1
  const recodeMatch = line.match(/Recode ([A-Za-z]+[\dA-Za-z_]+)/i)
  if (recodeMatch) {
    return extractBaseQuestionId(recodeMatch[1])
  }
  
  // For Val lab: "Val lab Q1R1..." or "Val lab Q1R1 to Q1R5" -> Q1
  const valLabMatch = line.match(/Val lab ([A-Za-z]+[\dA-Za-z_]+)/i)
  if (valLabMatch) {
    return extractBaseQuestionId(valLabMatch[1])
  }
  
  // For value labels continuation (1"text".) - associate with previous question
  if (line.match(/^\d+["']/) || line.match(/^\d+\s*["']/)) {
    return null // Will be associated with previous question
  }
  
  return null
}

/**
 * Sort question IDs with proper handling of sub-questions
 * Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
 */
function sortQuestionIds(ids: string[]): string[] {
  return ids.sort((a, b) => compareQuestionIds(a, b))
}

/**
 * Group syntax lines by question ID
 */
function groupSyntaxByQuestion(
  rename: string[],
  varLab: string[],
  recode: string[]
): Map<string, { rename: string[]; varLab: string[]; recode: string[] }> {
  const groups = new Map<string, { rename: string[]; varLab: string[]; recode: string[] }>()
  
  // Helper to ensure group exists
  const ensureGroup = (qId: string) => {
    if (!groups.has(qId)) {
      groups.set(qId, { rename: [], varLab: [], recode: [] })
    }
    return groups.get(qId)!
  }
  
  // Process rename syntax
  for (const line of rename) {
    const qId = extractQuestionIdFromSyntax(line)
    if (qId) {
      ensureGroup(qId).rename.push(line)
    }
  }
  
  // Process var lab syntax
  for (const line of varLab) {
    const qId = extractQuestionIdFromSyntax(line)
    if (qId) {
      ensureGroup(qId).varLab.push(line)
    }
  }
  
  // Process recode syntax (includes val lab)
  let lastQuestionId: string | null = null
  for (const line of recode) {
    const qId = extractQuestionIdFromSyntax(line)
    if (qId) {
      lastQuestionId = qId
      ensureGroup(qId).recode.push(line)
    } else if (lastQuestionId && line.trim()) {
      // Continuation line (like value labels: 1"text".)
      ensureGroup(lastQuestionId).recode.push(line)
    }
  }
  
  return groups
}

/**
 * Generate combined SPSS syntax from parse result - organized by question
 */
export function generateSPSSSyntaxFromResult(result: SPSSParseResult): string {
  const lines: string[] = []
  
  // Group syntax by question
  const groups = groupSyntaxByQuestion(
    result.syntax.rename,
    result.syntax.varLab,
    result.syntax.recode
  )
  
  // Get sorted question IDs
  const questionIds = sortQuestionIds(Array.from(groups.keys()))
  
  lines.push('* ====================================.')
  lines.push('* SPSS SYNTAX - Organized by Question.')
  lines.push('* ====================================.')
  lines.push('')
  
  // Generate syntax for each question
  for (const qId of questionIds) {
    const group = groups.get(qId)!
    
    // Skip if no syntax for this question
    if (group.rename.length === 0 && group.varLab.length === 0 && group.recode.length === 0) {
      continue
    }
    
    // Question header comment
    lines.push(`*${qId}.`)
    
    // Rename syntax
    if (group.rename.length > 0) {
      lines.push(...group.rename)
    }
    
    // Var lab syntax
    if (group.varLab.length > 0) {
      lines.push(...group.varLab)
    }
    
    // Recode & Val lab syntax
    if (group.recode.length > 0) {
      lines.push(...group.recode)
    }
    
    // Empty line between questions
    lines.push('')
  }
  
  return lines.join('\n')
}

/**
 * Generate SPSS syntax in traditional format (grouped by type)
 */
export function generateSPSSSyntaxByType(result: SPSSParseResult): string {
  const lines: string[] = []
  
  lines.push('* ====================================.')
  lines.push('* RENAME VARIABLES.')
  lines.push('* ====================================.')
  lines.push('')
  lines.push(...result.syntax.rename)
  
  if (result.syntax.varLab.length > 0) {
    lines.push('')
    lines.push('* ====================================.')
    lines.push('* VARIABLE LABELS.')
    lines.push('* ====================================.')
    lines.push('')
    lines.push(...result.syntax.varLab)
  }
  
  if (result.syntax.recode.length > 0) {
    lines.push('')
    lines.push('* ====================================.')
    lines.push('* RECODE & VALUE LABELS.')
    lines.push('* ====================================.')
    lines.push('')
    lines.push(...result.syntax.recode)
  }
  
  return lines.join('\n')
}
