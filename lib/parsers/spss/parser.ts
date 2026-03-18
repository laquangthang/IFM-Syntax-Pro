/**
 * SPSS Excel Parser - Main parsing logic
 * Input: Excel file with 2 columns (variable name, label)
 * Output: { questions, variables, oldVariableMapping } - no syntax
 */

import * as XLSX from 'xlsx'
import { ParsedQuestion, QuestionOption } from '@/lib/types'
import type { SPSSVariable, SPSSParseResult } from './types'
import {
  splitByColonSegments,
  extractLastNumber,
  removeTrailingNumberGroup,
  parseVariableName,
  classifyVariable,
  compareQuestionIds,
  isTextCompanion,
  getBaseVarFromTextCompanion,
  getSABaseVarFromTextCompanion,
  extractStrictBaseId,
  resolveQuestionId,
  parseGridPrefixPattern,
  type IdRegistry,
} from './utils'

const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripIdFromLabel = (id: string, label: string) => {
  const regex = new RegExp('^' + escapeRegExp(id) + '\\s*[:.-]?\\s*', 'i')
  return label.replace(regex, '')
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
    textCompanionVar?: string
    saTextCompanions?: string[]
    rawVariables?: Array<{ rawVar: string; generatedId: string; label: string }>
  }>()
  
  // Strict prefix extraction & deduplication for duplicate IDs
  const assignedIds: Record<string, string> = {}
  const idCounters: Record<string, number> = {}
  const idRegistry: IdRegistry = { assignedIds, idCounters }

  // Grid prefix accumulation: prefix -> rowCode -> [{ rawVar, label }] (multi-var rows supported)
  const gridVarAccumulator = new Map<string, Map<string, Array<{ rawVar: string; label: string }>>>()

  // Counters for variable structure (optionCode, subIndex, etc.)
  const groupCounts: Record<string, number> = {}
  const qrMapping: Record<string, number> = {}
  const subgroupItemCounts: Record<string, Record<number, number>> = {}
  const rValueMapping: Record<string, Record<string, number>> = {}
  const gridRowLabelToCode: Record<string, Record<string, number>> = {} // questionId -> rowLabel -> rowCode (global, consistent across columns)
  const rankMapping: Record<string, number> = {}
  const sumMapping: Record<string, number> = {}
  const answerOrderMap: Record<string, number> = {}
  const lastMAQuestionIdByVarId: Record<string, string> = {}
  const pnMapping: Record<string, number> = {}
  let lastPnQuestionId: string | null = null
  
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
  
  // Process first sheet
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
  
  // Build known variables set for prefix-based Other pairing (Sheet 1 col1 + Sheet 2 keys)
  const knownVarSet = new Set<string>()
  for (const row of data) {
    if (row && row.length >= 1) {
      const col1 = String(row[0] || '').trim()
      if (col1 && col1.toLowerCase() !== 'variable' && col1.toLowerCase() !== 'var') {
        knownVarSet.add(col1)
      }
    }
  }
  for (const key of codeLookupMap.keys()) {
    knownVarSet.add(key)
  }
  
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
    
    // Handle text companions (Othr, _OTHER, _TEXT, _O): pair with base using exact or SA prefix matching
    if (isTextCompanion(col1)) {
      let baseVar = getBaseVarFromTextCompanion(col1, knownVarSet)
      if (!baseVar) baseVar = getSABaseVarFromTextCompanion(col1, knownVarSet)
      if (baseVar) {
        const baseVariable = variables.find(v => v.originalVar === baseVar)
        const colonParts = col2.split(/:(?=\S)/)
        const text = colonParts[0] || ''
        const matchFirst = colonParts[1]?.match(/^(\S+)/)
        const firstWord = matchFirst ? matchFirst[1].replace(/:$/, '') : 'Unknown'

        if (baseVariable && baseVariable.questionId) {
          const questionId = baseVariable.questionId
          const q = questionMap.get(questionId)
          // MA/Grid: base has optionCode, update that option
          if (baseVariable.optionCode != null) {
            const opt = q?.options?.find(o => o.code === baseVariable.optionCode) ?? q?.rows?.find(r => r.code === baseVariable.optionCode)
            if (opt) {
              opt.codeType = 'Other'
              opt.openEndedRawVariable = col1
            }
            variables.push({
              originalVar: col1,
              label: col2,
              questionId,
              variableType: (baseVariable.variableType === 'Grid' || (baseVariable.variableType === 'Loop' && baseVariable.subIndex != null)) ? 'Grid' : 'MA',
              optionCode: baseVariable.optionCode,
              optionLabel: baseVariable.optionLabel ?? '',
            })
          } else {
            if (q) {
              if (!q.saTextCompanions) q.saTextCompanions = []
              if (!q.saTextCompanions.includes(col1)) q.saTextCompanions.push(col1)
            }
            variables.push({
              originalVar: col1,
              label: col2,
              questionId,
              variableType: 'SA',
              optionLabel: text,
            })
          }
          continue
        }
        // STRICT: Do NOT fallback to firstWord/options[0] if base not found. Skip; second pass will pair when base exists.
        continue
      }
    }
    
    // Check for Rank pattern
    const matchRank = /\[Rank\]/i.test(col2) ? col2.match(/:(\S+)/) : null
    const matchSum = /\[Sum\]/i.test(col2) ? col2.match(/:(\S+)/) : null
    
    // Case 1: var{id} with 2 segments (SA with question ID)
    // Multiple vars with same baseId (e.g. var200..var206 all :Q18) = SA_Grid rows. Assign Q18_1, Q18_2, ...
    if (/^var\d+$/.test(col1) && segments.length === 2) {
      const baseId = extractStrictBaseId(segments[1])
      const gridMatch = parseGridPrefixPattern(baseId)
      if (gridMatch) {
        const { prefix, rowCode } = gridMatch
        if (!gridVarAccumulator.has(prefix)) {
          gridVarAccumulator.set(prefix, new Map())
        }
        const rowMap = gridVarAccumulator.get(prefix)!
        if (!rowMap.has(rowCode)) rowMap.set(rowCode, [])
        rowMap.get(rowCode)!.push({ rawVar: col1, label: segments[0] || baseId })
        continue
      }
      if (!groupCounts[baseId]) groupCounts[baseId] = 0
      groupCounts[baseId]++
      const questionId = `${baseId}_${groupCounts[baseId]}`
      
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
    // Case 2: var{id}O{n} with Rank - all options share same questionId
    else if (/^var\d+O\d+$/.test(col1) && matchRank && !matchSum) {
      const baseId = extractStrictBaseId(matchRank[1])
      const firstWord = baseId
      const text = col2.substring(0, col2.indexOf(':' + firstWord))
      
      if (!rankMapping[firstWord]) {
        rankMapping[firstWord] = 1
      } else {
        rankMapping[firstWord]++
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
    // Case 3: var{id}O{n} with Sum - all options share same questionId
    else if (/^var\d+O\d+$/.test(col1) && matchSum && !matchRank) {
      const baseId = extractStrictBaseId(matchSum[1])
      const firstWord = baseId
      const text = col2.substring(0, col2.indexOf(':' + firstWord))
      
      if (!sumMapping[firstWord]) {
        sumMapping[firstWord] = 1
      } else {
        sumMapping[firstWord]++
      }
      
      // Track question
      if (!questionMap.has(firstWord)) {
        questionMap.set(firstWord, {
          id: firstWord,
          type: 'Sum',
          label: firstWord,
          options: [],
        })
      }
      const q = questionMap.get(firstWord)!
      q.options.push({ code: sumMapping[firstWord], label: text })
      
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
      const rawFirst = firstWordMatch ? firstWordMatch[0] : ''
      const baseId = extractStrictBaseId(rawFirst)
      const gridMatch = parseGridPrefixPattern(baseId)
      if (gridMatch) {
        const { prefix, rowCode } = gridMatch
        if (!gridVarAccumulator.has(prefix)) {
          gridVarAccumulator.set(prefix, new Map())
        }
        const rowMap = gridVarAccumulator.get(prefix)!
        if (!rowMap.has(rowCode)) rowMap.set(rowCode, [])
        rowMap.get(rowCode)!.push({ rawVar: col1, label: col2 })
        continue
      }
      const firstWord = resolveQuestionId(baseId, col1, idRegistry)
      
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
      
      const colonParts = col2.split(/:(?=\S)/)
      const text = colonParts[0] || ''
      
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
      // Add column if not exists (columns = brands/categories)
      if (!q.columns?.some(c => c.code === rValue)) {
        q.columns?.push({
          code: rValue,
          label: subgroup,
        })
      }
      // Add row with globally consistent code (rows = attributes). Same row label must get same code across all columns.
      if (!gridRowLabelToCode[questionId]) {
        gridRowLabelToCode[questionId] = {}
      }
      let rowCode = gridRowLabelToCode[questionId][text]
      if (rowCode === undefined) {
        rowCode = Object.keys(gridRowLabelToCode[questionId]).length + 1
        gridRowLabelToCode[questionId][text] = rowCode
        q.rows?.push({
          code: rowCode,
          label: text,
        })
      }
      
      variables.push({
        originalVar: col1,
        label: col2,
        questionId,
        variableType: 'Grid',
        subIndex: rValue,
        optionCode: rowCode,
        optionLabel: text,
      })
    }
    // Case 6: var{id}O{n} (MA) - 2 segments (Label: QuestionID) or 1 segment (label only, use last questionId)
    // MA: All options share the SAME questionId (e.g. Q17). Do NOT use resolveQuestionId - different rawVars
    // are OPTIONS of the same question, not separate questions.
    else if (/^var\d+O\d+$/.test(col1) && !matchSum && !matchRank) {
      const varIdMatch = col1.match(/^(var\d+)/)
      const varId = varIdMatch ? varIdMatch[1] : ''
      let questionId: string
      if (segments.length >= 2) {
        const baseId = extractStrictBaseId(segments[1])
        questionId = baseId
      } else {
        questionId = lastMAQuestionIdByVarId[varId] || 'Unknown'
      }
      const text = segments[0] || col2.trim()

      if (!qrMapping[questionId]) {
        qrMapping[questionId] = 1
      } else {
        qrMapping[questionId]++
      }

      const optionNum = qrMapping[questionId]
      lastMAQuestionIdByVarId[varId] = questionId

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
      const rawId = matchQuestion ? matchQuestion[1] : ''
      const baseId = extractStrictBaseId(rawId)
      const questionId = resolveQuestionId(baseId, col1, idRegistry)
      
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
      if (othrFlag) {
        const q = questionMap.get(questionId)!
        if (q.rows && q.rows.length > 0) {
          q.rows = q.rows || []
          q.rows.push({ code: answerOrder, label: text, codeType: 'Other', openEndedRawVariable: col1 })
        } else {
          q.options = q.options || []
          q.options.push({ code: answerOrder, label: text, codeType: 'Other', openEndedRawVariable: col1 })
        }
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
        const rawId = matchQuestion ? matchQuestion[1] : ''
        const baseId = extractStrictBaseId(rawId)
        const questionId = resolveQuestionId(baseId, col1, idRegistry)
        
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
        
        const baseId = extractStrictBaseId(temp[1])
        const questionId = resolveQuestionId(baseId, col1, idRegistry)
        const subQuestion = removeTrailingNumberGroup(temp[0])
        const pnNow = extractLastNumber(temp[0])
        
        if (lastPnQuestionId !== questionId) {
          lastPnQuestionId = questionId
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
        const baseId = extractStrictBaseId(temp[1])
        const questionId = resolveQuestionId(baseId, col1, idRegistry)
        
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
        const baseId = extractStrictBaseId(temp[2])
        const questionId = resolveQuestionId(baseId, col1, idRegistry)
        
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
      const rawId = segments3.length >= 3 ? segments3[2] : ''
      const baseId = extractStrictBaseId(rawId)
      const questionId = resolveQuestionId(baseId, col1, idRegistry)
      
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
      if (othrFlag) {
        const q = questionMap.get(questionId)!
        if (q.rows && q.rows.length > 0) {
          q.rows = q.rows || []
          q.rows.push({ code: answerOrder, label: text, codeType: 'Other', openEndedRawVariable: col1 })
        } else {
          q.options = q.options || []
          q.options.push({ code: answerOrder, label: text, codeType: 'Other', openEndedRawVariable: col1 })
        }
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
  
  // Process Other (Othr, _OTHER, _TEXT, _O) variables in second pass - pair with base using exact or SA prefix matching
  for (let index = 0; index < data.length; index++) {
    const row = data[index]
    if (!row || row.length < 2) continue

    const varName = String(row[0] || '').trim()
    const label = String(row[1] || '').trim()

    if (!isTextCompanion(varName)) continue

    let baseVar = getBaseVarFromTextCompanion(varName, knownVarSet)
    if (!baseVar) {
      baseVar = getSABaseVarFromTextCompanion(varName, knownVarSet) ?? null
    }
    if (!baseVar) continue

    const colonParts = label.split(/:(?=\S)/)
    const text = colonParts[0] || ''
    const matchFirst = colonParts[1]?.match(/^(\S+)/)
    const firstWord = matchFirst ? matchFirst[1].replace(/:$/, '') : 'Unknown'

    const baseVariable = variables.find(v => v.originalVar === baseVar)
    if (baseVariable && baseVariable.questionId) {
      const questionId = baseVariable.questionId
      const q = questionMap.get(questionId)
      if (baseVariable.optionCode != null) {
        const opt = q?.options?.find(o => o.code === baseVariable.optionCode) ?? q?.rows?.find(r => r.code === baseVariable.optionCode)
        if (opt) {
          opt.codeType = 'Other'
          opt.openEndedRawVariable = varName
        }
        variables.push({
          originalVar: varName,
          label,
          questionId,
          variableType: (baseVariable.variableType === 'Grid' || (baseVariable.variableType === 'Loop' && baseVariable.subIndex != null)) ? 'Grid' : 'MA',
          optionCode: baseVariable.optionCode,
          optionLabel: text,
        })
      } else {
        if (q) {
          if (!q.saTextCompanions) q.saTextCompanions = []
          if (!q.saTextCompanions.includes(varName)) q.saTextCompanions.push(varName)
        }
        variables.push({
          originalVar: varName,
          label,
          questionId,
          variableType: 'SA',
          optionLabel: text,
        })
      }
    } else {
      // STRICT: Do NOT fallback to firstWord/options[0] if base not found. Skip to avoid wrong attachment.
    }
  }
  
  // Post-process: Merge MA variables with _XRY pattern into MA_Grid
  // Pattern: Q8_1R1, Q8_1R2, Q8_2R1, Q8_2R2 → Q8 (MA_Grid) with columns [1, 2] and rows [1, 2]
  const maGridCandidates = new Map<string, {
    columns: Set<string>
    rows: Map<string, string> // row code → row label
    labels: Map<string, string> // column code → column label (from first occurrence)
    baseLabel: string
    columnOptions: Map<string, QuestionOption[]> // colCode → options (for homogeneity check)
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
          columnOptions: new Map(),
        })
      }
      
      const candidate = maGridCandidates.get(baseQId)!
      candidate.columns.add(colCode)
      candidate.labels.set(colCode, qData.label)
      candidate.columnOptions.set(colCode, [...qData.options])
      
      // Extract rows from options (R1, R2, ...)
      for (const opt of qData.options) {
        const rowCode = String(opt.code)
        if (!candidate.rows.has(rowCode)) {
          candidate.rows.set(rowCode, opt.label)
        }
      }
    }
  }
  
  /** Only merge if all columns have same option labels (homogeneous matrix) */
  const isHomogeneousMAGrid = (candidate: { columnOptions: Map<string, QuestionOption[]> }): boolean => {
    const opts = Array.from(candidate.columnOptions.values())
    if (opts.length < 2) return true
    const first = opts[0].map(o => String(o.label).trim())
    for (let i = 1; i < opts.length; i++) {
      const curr = opts[i].map(o => String(o.label).trim())
      if (curr.length !== first.length) return false
      for (let j = 0; j < first.length; j++) {
        if (curr[j] !== first[j]) return false
      }
    }
    return true
  }
  
  // Merge MA_Grid candidates
  for (const [baseQId, candidate] of maGridCandidates.entries()) {
    // CRITICAL: Do NOT merge if baseQId already exists as Rank/Sum/Numeric - would destroy standalone question
    const existingBase = questionMap.get(baseQId)
    if (existingBase && ['Rank_Fixed', 'Rank_Upto', 'Sum', 'Numeric'].includes(existingBase.type)) {
      continue
    }

    // Only merge if we have multiple columns AND homogeneous (same option labels across columns)
    if (candidate.columns.size >= 2 && isHomogeneousMAGrid(candidate)) {
      // Remove individual sub-questions (Q15_1, Q15_2) - never touch baseQId if it exists as different type
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
  
  // Pair SA text companions: mark option with Khác/Other label and attach openEndedRawVariable
  const OTHER_KEYWORDS = /\b(khác|other|ghi rõ|ghi ro)\b/i
  for (const [, qData] of questionMap.entries()) {
    if (qData.type === 'SA' && qData.options?.length) {
      const companionVar = qData.textCompanionVar || qData.saTextCompanions?.[0]
      if (companionVar) {
        const opt = qData.options.find(o => OTHER_KEYWORDS.test(String(o.label).trim()))
        if (opt) {
          opt.codeType = 'Other'
          opt.openEndedRawVariable = companionVar
        }
      }
    }
  }
  
  // Convert gridVarAccumulator into SA_Grid questions (Smart Grid Prefix Detection)
  // Supports multi-variable rows (e.g. A2_1 with var262 + var263 → A2_1_1, A2_1_2)
  for (const [prefix, rowMap] of gridVarAccumulator.entries()) {
    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => {
      const aNum = parseInt(a[0]) || 0
      const bNum = parseInt(b[0]) || 0
      return aNum - bNum
    })
    const rawVariables: Array<{ rawVar: string; generatedId: string; label: string }> = []
    const rows: QuestionOption[] = []
    for (const [rowCode, vars] of sortedRows) {
      const rowLabel = vars[0]?.label || `${prefix}_${rowCode}`
      rows.push({ code: parseInt(rowCode) || rowCode, label: rowLabel })
      vars.forEach((v, subIdx) => {
        const subIndex = vars.length > 1 ? subIdx + 1 : null
        const generatedId = subIndex != null ? `${prefix}_${rowCode}_${subIndex}` : `${prefix}_${rowCode}`
        rawVariables.push({ rawVar: v.rawVar, generatedId, label: v.label })
      })
    }
    questionMap.set(prefix, {
      id: prefix,
      type: 'SA_Grid',
      label: prefix,
      options: [],
      rows,
      rowOptionsMap: undefined,
      rawVariables,
    })
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
    // Check if this looks like a SA_Grid sub-variable: Q24_1, A1a_1, etc. (SA type with prefix_row pattern)
    const subMatch = qId.match(/^([A-Za-z0-9]+)_(\d+)$/i)
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
    const existingBase = questionMap.get(baseQId)
    if (existingBase) {
      continue
    }
    if (candidate.rows.size >= 2) {
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
  // textCompanions will be attached after we build textCompanionsMap (see below)
  const questions: ParsedQuestion[] = Array.from(questionMap.values()).map(q => {
    const label = (q.type === 'SA' || q.type === 'OE') ? stripIdFromLabel(q.id, q.label) : q.label
    return {
    id: q.id,
    type: q.type,
    label,
    options: q.options.length > 0 ? q.options : undefined,
    rows: q.rows && q.rows.length > 0 ? q.rows : undefined,
    columns: q.columns && q.columns.length > 0 ? q.columns : undefined,
    rowOptionsMap: q.rowOptionsMap,
    saTextCompanions: q.saTextCompanions && q.saTextCompanions.length > 0 ? Array.from(new Set(q.saTextCompanions)) : undefined,
    rawVariables: q.rawVariables,
    logic: {
      type: 'Normal',
      piping_source: null,
      terminate_if: null,
      ask_if_condition: null,
    },
  }
  })
  
  // Sort questions by ID with proper handling of sub-questions
  // Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
  questions.sort((a, b) => {
    return compareQuestionIds(a.id, b.id)
  })
  
  // Build oldVariableMapping from variables (BASE VARIABLES ONLY - no text companions)
  // Text companions go into textCompanionsMap to prevent grid index shifting
  const oldVariableMapping: Record<string, string[]> = {}
  const textCompanionsMap: Record<string, Record<string, string>> = {}
  
  // Build a map of sub-question IDs to base question IDs (for merged MA_Grid and SA_Grid)
  // Only add when we actually merged (base exists as MA_Grid) - skip when kept as separate MA
  const subToBaseMap = new Map<string, string>()
  for (const [baseQId, candidate] of maGridCandidates.entries()) {
    if (candidate.columns.size >= 2) {
      const existingBase = questionMap.get(baseQId)
      if (existingBase?.type === 'MA_Grid') {
        for (const colCode of candidate.columns) {
          const subQId = `${baseQId}_${colCode}`
          subToBaseMap.set(subQId, baseQId)
        }
      }
    }
  }
  
  for (const [baseQId, candidate] of saGridCandidates.entries()) {
    if (candidate.rows.size >= 2) {
      const existingBase = questionMap.get(baseQId)
      if (existingBase) continue
      for (const rowIndex of candidate.rows.keys()) {
        const subQId = `${baseQId}_${rowIndex}`
        subToBaseMap.set(subQId, baseQId)
      }
    }
  }
  
  for (const v of variables) {
    const effectiveQId = subToBaseMap.get(v.questionId) || v.questionId
    
    // CRITICAL: ONLY filter out companions (Othr suffix). Base variables MUST remain in oldVariableMapping.
    if (isTextCompanion(v.originalVar)) {
      const baseVar = getBaseVarFromTextCompanion(v.originalVar, knownVarSet)
      if (baseVar) {
        if (!textCompanionsMap[effectiveQId]) textCompanionsMap[effectiveQId] = {}
        textCompanionsMap[effectiveQId][baseVar] = v.originalVar
      }
      continue
    }

    if (!oldVariableMapping[effectiveQId]) {
      oldVariableMapping[effectiveQId] = []
    }
    if (!oldVariableMapping[effectiveQId].includes(v.originalVar)) {
      oldVariableMapping[effectiveQId].push(v.originalVar)
    }
  }
  
  // Attach textCompanions to each question
  for (const q of questions) {
    if (textCompanionsMap[q.id] && Object.keys(textCompanionsMap[q.id]).length > 0) {
      q.textCompanions = textCompanionsMap[q.id]
    }
  }
  
  return {
    questions,
    variables,
    oldVariableMapping,
  }
}
