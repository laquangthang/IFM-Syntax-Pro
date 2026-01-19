/**
 * XLSX Parser - Parse questions from XLSX structure
 * Extracts questions, options, rows, columns from Excel tables
 */

import * as XLSX from 'xlsx'
import { ParsedQuestion } from './types'

export interface XLSXQuestionData {
  questionId: string
  instruction?: string
  questionType?: string
  label?: string
  options?: Array<{ code: string | number; en?: string; vn?: string; logic?: string }>
  rows?: Array<{ code: string | number; en?: string; vn?: string }>
  columns?: Array<{ code: string | number; label: string }>
  logic?: {
    type?: string
    terminate?: string
    askIf?: string
  }
}

/**
 * Parse XLSX workbook to extract question structures
 */
export function parseXLSXToQuestions(workbook: XLSX.WorkBook): XLSXQuestionData[] {
  const questions: XLSXQuestionData[] = []
  const questionIdMap = new Map<string, XLSXQuestionData>() // Track by ID to avoid duplicates
  
  // Process each sheet
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    if (jsonData.length === 0) return
    
    
    // Convert all cells to strings to preserve "00" format
    const stringData = jsonData.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return ''
        return String(cell)
      })
    )
    
    // Find question blocks in the sheet
    const questionBlocks = findQuestionBlocks(stringData)
    
    questionBlocks.forEach((block, blockIndex) => {
      const questions = parseQuestionBlock(block)
      questions.forEach(question => {
        // Check for duplicates - keep the one with more data (options/rows/columns)
        const existing = questionIdMap.get(question.questionId)
        if (existing) {
          const existingDataCount = (existing.options?.length || 0) + (existing.rows?.length || 0) + (existing.columns?.length || 0)
          const newDataCount = (question.options?.length || 0) + (question.rows?.length || 0) + (question.columns?.length || 0)
          
          if (newDataCount > existingDataCount) {
            questionIdMap.set(question.questionId, question)
          }
        } else {
          questionIdMap.set(question.questionId, question)
        }
      })
    })
  })
  
  return Array.from(questionIdMap.values())
}

/**
 * Find question blocks in XLSX data
 * A question block starts with a row containing question ID (Q1, Q2, etc.)
 * Multiple questions (Q9, Q10.1, Q10.2) can share the same table
 */
function findQuestionBlocks(data: any[][]): any[][][] {
  const blocks: any[][][] = []
  let currentBlock: any[][] | null = null
  let currentQuestionIds: string[] = [] // Track multiple questions in same block
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const rowText = row.map(cell => String(cell || '')).join(' ')
    const rowTextUpper = rowText.toUpperCase()

    // Prefer matching question header from the first non-empty cell to avoid false positives
    // like "SHOW CODES IN Q7 ..." (reference, not a header).
    const firstCell = row.find(c => String(c || '').trim().length > 0)
    const firstCellText = String(firstCell || '').trim()
    
    // Check if this row starts a new question (Q9, Q10.1, Q10.2, etc.)
    // IMPORTANT: Only treat as a new question if it looks like a question header,
    // and it must be at the beginning of the first content cell:
    // e.g. "Q8 " / "Q8." / "Q8:" / "Q8.1 " / "Q8.1:" (NOT references like "IN Q7").
    const questionMatch = firstCellText.match(/^Q\s*(\d+(?:\.\d+)?[A-Z]?)\b(?:\s|[.\):])/i)
    if (questionMatch) {
      const questionId = 'Q' + questionMatch[1].replace(/\s+/g, '')
      
      // Check if previous row contains SCRIPT: or Note: (instruction row)
      const prevRowHasInstruction = i > 0 && (() => {
        const prevRowText = data[i - 1].map(cell => String(cell || '')).join(' ')
        return /SCRIPT:/i.test(prevRowText) || /NOTE:/i.test(prevRowText)
      })()
      
      // Check if we're starting a new block or adding to current
      // If current block has a table header, continue adding questions to same block
      const hasTableHeader = currentBlock && currentBlock.some(r => {
        const rText = r.map(cell => String(cell || '')).join(' ')
        const rTextUpper = rText.toUpperCase()
        // Header detection should work for:
        // - Options tables: Code + (EN/VN) [+ Logic option]
        // - Grid tables like Q8: Code + <label col> + many attribute columns (may NOT contain VN/EN explicitly)
        if (!(rTextUpper.includes('CODE') || rTextUpper.includes(' CODE '))) return false
        if (rTextUpper.includes('EN') || rTextUpper.includes('VN')) return true
        // Fallback: if it has 3+ non-empty cells on the row, it's likely a grid header
        const nonEmpty = r.filter(c => String(c || '').trim().length > 0).length
        return nonEmpty >= 3
      })

      // Lookahead: shared tables (e.g., Table 12) can have multiple question lines (Q10, Q11)
      // BEFORE the header row appears. In that case, when we see the next question row,
      // we should keep them in the same block instead of splitting.
      const lookaheadHasSharedHeader =
        currentBlock &&
        !hasTableHeader &&
        (() => {
          const maxLookahead = 8
          const ids = [...currentQuestionIds, questionId]

          const escapeId = (id: string) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

          for (let j = i; j < Math.min(data.length, i + maxLookahead); j++) {
            const r = data[j]
            const txt = r.map(c => String(c || '')).join(' ')
            const up = txt.toUpperCase()
            const nonEmpty = r.filter(c => String(c || '').trim().length > 0).length

            const isHeaderCandidate =
              (up.includes('CODE') && (up.includes('VN') || up.includes('EN'))) ||
              (up.includes('CODE') && nonEmpty >= 3)

            if (!isHeaderCandidate) continue

            // Must mention at least one of the question IDs (e.g., Q10/Q11 columns)
            const mentionsAny = ids.some((qid) => new RegExp(`\\b${escapeId(qid)}\\b`, 'i').test(txt))
            if (mentionsAny) return true
          }
          return false
        })()
      
      if (currentBlock && !hasTableHeader && currentQuestionIds.length > 0 && !lookaheadHasSharedHeader) {
        // Save previous block if it doesn't have shared table
        blocks.push(currentBlock)
        // Start new block, include previous row if it has instruction
        currentBlock = prevRowHasInstruction ? [data[i - 1], row] : [row]
        currentQuestionIds = [questionId]
      } else if (currentBlock && hasTableHeader) {
        // Add question to current block (shared table scenario)
        currentQuestionIds.push(questionId)
        currentBlock.push(row)
      } else if (currentBlock && !hasTableHeader && lookaheadHasSharedHeader) {
        // Shared table scenario where header appears after multiple questions (Q10/Q11)
        currentQuestionIds.push(questionId)
        currentBlock.push(row)
      } else {
        // Start new block
        if (currentBlock && currentQuestionIds.length > 0) {
          blocks.push(currentBlock)
        }
        // Include previous row if it has instruction (SCRIPT: or Note:)
        currentQuestionIds = [questionId]
        currentBlock = prevRowHasInstruction ? [data[i - 1], row] : [row]
      }
    } else if (currentBlock) {
      // Check if this row starts a new question (different pattern)
      const altQuestionMatch = rowTextUpper.match(/QUESTION\s*(\d+(?:\.\d+)?[A-Z]?)/i)
      if (altQuestionMatch) {
        const questionId = 'Q' + altQuestionMatch[1].replace(/\s+/g, '')
        if (!currentQuestionIds.includes(questionId)) {
          currentQuestionIds.push(questionId)
        }
        currentBlock.push(row)
      } else {
        // Continue current block
        currentBlock.push(row)
      }
    }
  }
  
  // Add last block
  if (currentBlock && currentQuestionIds.length > 0) {
    blocks.push(currentBlock)
  }
  
  return blocks
}

/**
 * Parse a question block to extract question data
 */
function parseQuestionBlock(block: any[][]): XLSXQuestionData[] {
  if (block.length === 0) return []
  
  // Find all question IDs in this block
  const questionIds: string[] = []
  const questionMetadata: Map<
    string,
    { instructionLines: Set<string>; questionType: string; label: string }
  > = new Map()

  const addInstructionLine = (meta: { instructionLines: Set<string> }, line: string) => {
    const trimmed = (line || '').trim()
    if (!trimmed) return
    meta.instructionLines.add(trimmed)
  }

  const appendInstructionFromRow = (
    meta: { instructionLines: Set<string>; questionType: string },
    rowText: string
  ) => {
    const text = (rowText || '').trim()
    if (!text) return

    // Extract SCRIPT part without duplicating NOTE if they appear on same line
    if (/SCRIPT:/i.test(text)) {
      const scriptPart = text.match(/SCRIPT:\s*([\s\S]*?)(?=NOTE:|$)/i)?.[0]?.trim()
      if (scriptPart) addInstructionLine(meta, scriptPart)
    }

    // Extract NOTE line (full)
    const noteMatch = text.match(/NOTE:\s*([^\n]+)/i)
    if (noteMatch) {
      const noteLine = noteMatch[0].trim()
      addInstructionLine(meta, noteLine)

      // Question type from Note:
      // - Any "MA PER ..." => MA_Grid
      // - Any "SA PER ..." => SA_Grid
      // - "OE" => OE (Open Ended)
      if (/NOTE:\s*MA/i.test(noteLine)) {
        meta.questionType = /MA\s+PER\b/i.test(noteLine) ? 'MA_Grid' : 'MA'
      } else if (/NOTE:\s*SA/i.test(noteLine)) {
        meta.questionType = /SA\s+PER\b/i.test(noteLine) ? 'SA_Grid' : 'SA'
      } else if (/NOTE:\s*OE\b/i.test(noteLine)) {
        meta.questionType = 'OE'
      }
    }
  }
  
  // Scan rows to find all question IDs and their metadata
  // First, check rows BEFORE question ID for instructions (like "Note: MA")
  for (let i = 0; i < Math.min(20, block.length); i++) {
    const row = block[i]
    const rowText = row.map(cell => String(cell || '')).join(' ')
    
    // Check for instruction rows (SCRIPT, Note) that come BEFORE question ID
    // These rows might not contain Q1 but contain "Note: MA" or "SCRIPT:"
    if (/NOTE:\s*MA/i.test(rowText) || /NOTE:\s*SA/i.test(rowText) || /SCRIPT:/i.test(rowText)) {
      // This might be an instruction row for a question that comes after
      // We'll associate it with the next question ID we find
    }
  }
  
  // Now scan for question IDs and associate with instructions
  for (let i = 0; i < Math.min(20, block.length); i++) {
    const row = block[i]
    const rowText = row.map(cell => String(cell || '')).join(' ')
    const firstCell = row.find(c => String(c || '').trim().length > 0)
    const firstCellText = String(firstCell || '').trim()
    
    // Find question IDs (Q9, Q10.1, Q10.2, etc.)
    // Only treat as question IDs if first content cell looks like a question header.
    // This avoids accidentally treating "IN Q7" (piping reference) as a separate question.
    const qMatches = firstCellText.matchAll(/^Q\s*(\d+(?:\.\d+)?[A-Z]?)\b(?:\s|[.\):])/gi)
    for (const match of qMatches) {
      const qId = 'Q' + match[1].replace(/\s+/g, '')
      if (!questionIds.includes(qId)) {
        questionIds.push(qId)
        questionMetadata.set(qId, { instructionLines: new Set<string>(), questionType: '', label: '' })
      }
      
      const meta = questionMetadata.get(qId)!
      
      // Check previous row for instructions (Note / Script may be on same line)
      if (i > 0) {
        const prevRowText = block[i - 1].map(cell => String(cell || '')).join(' ')
        appendInstructionFromRow(meta, prevRowText)
      }
      
      // Find instruction (SCRIPT, Note) in same row (rare but possible)
      appendInstructionFromRow(meta, rowText)
      
      // Find question label (text after Q9, Q10.1, etc.)
      if (!meta.label) {
        const escapedQId = qId.replace(/\./g, '\\.')
        // IMPORTANT: question text in XLSX often contains newlines inside a single cell.
        // Use [\\s\\S]+ to capture across newlines, then normalize whitespace.
        const labelMatch = rowText.match(new RegExp(`${escapedQId}\\s*[\\.:\\)]?\\s*([\\s\\S]+)`, 'i'))
        if (labelMatch) {
          const normalized = String(labelMatch[1] || '').replace(/\s+/g, ' ').trim()
          if (normalized.length > 5) meta.label = normalized
        }
      }
    }
  }
  
  if (questionIds.length === 0) return []
  
  // Find shared table structure
  const tableInfo = findTableStructure(block, questionIds)
  
  // Create question data for each question ID
  const questions: XLSXQuestionData[] = []
  
  for (const qId of questionIds) {
    const meta = questionMetadata.get(qId)!
    
    // Determine if this question uses the shared table as options or rows/columns
    let options = tableInfo.options
    let rows = tableInfo.rows
    let columns = tableInfo.columns
    
    // Check if table has columns for this specific question (e.g., "Q9", "10.1 In-store", "10.2. Online")
    const hasQuestionColumn = tableInfo.questionColumns?.has(qId) || false
    const questionCols = tableInfo.questionColumns?.get(qId) || []
    
    // Check if question column is just "Q9" (options question) or "10.1 In-store" (grid question)
    const isOptionsColumn = questionCols.some(col => String(col.label).match(/^Q\d+$/i))
    const isGridColumn = questionCols.some(col => /\d+\.\d+\s+(In-store|Online)/i.test(String(col.label)))
    
    if (hasQuestionColumn && isGridColumn) {
      // This is a Grid question with specific columns (Q10.1, Q10.2)
      rows = tableInfo.rows
      columns = questionCols.filter(col => /\d+\.\d+\s+(In-store|Online)/i.test(String(col.label)))
      options = undefined
    } else if (hasQuestionColumn && isOptionsColumn) {
      // This is an options question (Q9) - use shared table rows as options
      options = tableInfo.rows?.map(row => ({
        code: row.code,
        en: row.en,
        vn: row.vn,
        logic: undefined,
      }))
      rows = undefined
      columns = undefined
    } else if (tableInfo.rows && tableInfo.columns && tableInfo.columns.length > 0) {
      // Grid question: has both rows and columns
      // Check if this is really a grid (has 2+ columns) or just mis-detected
      if (tableInfo.columns.length >= 2) {
        // This is a grid question (e.g., Q7 with "Trần chìm" and "Trần nổi/thả" columns)
        rows = tableInfo.rows
        columns = tableInfo.columns
        options = undefined
      } else if (tableInfo.options && tableInfo.options.length > 0) {
        // Prefer options if available (might be mis-detected as grid)
        options = tableInfo.options
        rows = undefined
        columns = undefined
      } else {
        // Single column - treat as options question
        options = tableInfo.rows?.map(row => ({
          code: row.code,
          en: row.en,
          vn: row.vn,
          logic: undefined,
        }))
        rows = undefined
        columns = undefined
      }
    } else if (tableInfo.options && tableInfo.options.length > 0) {
      // Regular question with options (most common case for Q1, Q2, etc.)
      options = tableInfo.options
      rows = undefined
      columns = undefined
    } else if (tableInfo.rows && !tableInfo.columns) {
      // Only rows, no columns - treat rows as options
      options = tableInfo.rows.map(row => ({
        code: row.code,
        en: row.en,
        vn: row.vn,
        logic: undefined,
      }))
      rows = undefined
      columns = undefined
    } else {
      console.warn(`      ⚠️  ${qId}: Could not determine question structure`)
    }
    
    questions.push({
      questionId: qId,
      instruction: (Array.from(meta.instructionLines).join('\n') || '').trim() || undefined,
      questionType: meta.questionType || undefined,
      label: meta.label || undefined,
      options,
      rows,
      columns,
      logic: tableInfo.logic,
    })
  }
  
  return questions
}

/**
 * Find table structure in question block
 * Can detect shared tables for multiple questions (Q9, Q10.1, Q10.2)
 */
function findTableStructure(block: any[][], questionIds: string[] = []): {
  options?: Array<{ code: string | number; en?: string; vn?: string; logic?: string }>
  rows?: Array<{ code: string | number; en?: string; vn?: string }>
  columns?: Array<{ code: string | number; label: string }>
  questionColumns?: Map<string, Array<{ code: string | number; label: string }>> // Columns per question (Q9, Q10.1, Q10.2)
  logic?: { type?: string; terminate?: string; askIf?: string }
} {
  // Find header row (contains Code, EN, VN, etc.)
  let headerRowIndex = -1
  let codeColIndex = -1
  let enColIndex = -1
  let vnColIndex = -1
  let logicColIndex = -1
  
  // First pass: find header row
  // Log all rows in block for debugging
  for (let i = 0; i < Math.min(10, block.length); i++) {
    const row = block[i]
    const rowText = row.map(cell => String(cell || '').toUpperCase()).join(' ')
    
    
    // Check individual cells for header patterns
    let hasCodeCell = false
    let hasEnVnCell = false
    let codeCellIndex = -1
    let vnCellIndex = -1
    
    row.forEach((cell, colIdx) => {
      const cellStr = String(cell || '').trim()
      const cellUpper = cellStr.toUpperCase().replace(/\s+/g, '') // Normalize spaces
      const cellOriginal = cellStr
      
      // Check for "Code" (exact match) or "CODE" (all caps)
      // Handle cases like "Code\n" or "Code " with line breaks or trailing spaces
      if (cellUpper === 'CODE' || 
          cellOriginal === 'Code' || 
          cellOriginal.toUpperCase() === 'CODE' ||
          (cellUpper.includes('CODE') && cellUpper.length <= 15 && !cellUpper.includes('CODE123'))) {
        hasCodeCell = true
        if (codeCellIndex === -1) codeCellIndex = colIdx
      }
      
      // Check for VN or EN
      if (cellUpper === 'VN' || cellUpper === 'EN' || 
          cellOriginal === 'VN' || cellOriginal === 'EN' ||
          cellUpper === 'VIETNAMESE' || 
          cellUpper.includes('VIỆT')) {
        hasEnVnCell = true
        if (vnCellIndex === -1) vnCellIndex = colIdx
      }
    })
    
    // Check if this is a header row.
    // Cases:
    // - Options: CODE + (EN/VN) [+ Logic]
    // - Grid (Q7): CODE + VN + 2+ descriptive columns
    // - Grid (Q8): CODE + <label col (may be blank header)> + 2+ descriptive columns (no VN/EN on header)
    const hasCode = rowText.includes('CODE') || hasCodeCell
    const hasEnVn = rowText.includes('EN') || rowText.includes('VN') || hasEnVnCell
    const hasGridColumns = /\d+\.\d+\s+(In-store|Online|INSTORE|ONLINE)/i.test(rowText)
    const nonEmptyCells = row.filter(c => String(c || '').trim().length > 0).length
    const hasManyColumns = nonEmptyCells >= 3 // CODE + (label col) + >=1 attribute col
    
    if (hasCode && (hasEnVn || hasGridColumns || hasManyColumns)) {
      headerRowIndex = i
      break
    }
  }
  
  // Second pass: find column indices from header row
  if (headerRowIndex >= 0) {
    const headerRow = block[headerRowIndex]
    
    // Find column indices - check each cell individually
    headerRow.forEach((cell, colIndex) => {
      const cellStr = String(cell || '').trim()
      const cellUpper = cellStr.toUpperCase()
      const cellNormalized = cellUpper.replace(/\s+/g, '') // Remove all spaces for comparison
      
      // Check for CODE column (exact match first, then contains)
      // Handle both "Code" and "CODE"
      if (codeColIndex === -1) {
        // Exact matches (case-insensitive)
        if (cellUpper === 'CODE' || cellNormalized === 'CODE' || cellStr === 'Code') {
          codeColIndex = colIndex
        } 
        // Contains CODE (but not too long)
        else if (cellUpper.includes('CODE') && cellUpper.length <= 15 && !cellUpper.includes('CODE123')) {
          codeColIndex = colIndex
        }
      }
      
      // Check for EN column
      if (enColIndex === -1) {
        if (cellUpper === 'EN' || cellNormalized === 'EN' || cellStr === 'EN' || 
            cellUpper === 'ENGLISH' || cellUpper.startsWith('EN ')) {
          enColIndex = colIndex
        }
      }
      
      // Check for VN column
      if (vnColIndex === -1) {
        if (cellUpper === 'VN' || cellNormalized === 'VN' || cellStr === 'VN' ||
            cellUpper === 'VIETNAMESE' || 
            cellUpper.includes('VIỆT') || 
            cellUpper.startsWith('VN ')) {
          vnColIndex = colIndex
        }
      }
      
      // Check for LOGIC column
      if (logicColIndex === -1) {
        if (cellUpper.includes('LOGIC')) {
          logicColIndex = colIndex
        } else if (cellUpper.includes('OPTION') && cellUpper.length <= 25) {
          logicColIndex = colIndex
        }
      }
    })
    
    
    // If we found CODE but no EN/VN, try to infer from context
    if (codeColIndex >= 0 && enColIndex === -1 && vnColIndex === -1) {
      // Many converted grids (like Q8) have no explicit VN/EN header.
      // In that case, assume the label column is CODE+1.
      if (codeColIndex + 1 < headerRow.length) {
        const nextCell = String(headerRow[codeColIndex + 1] || '').trim().toUpperCase()
        // If header cell is empty or looks like a section title (e.g. "VẬT LIỆU"), still treat as label column.
        if (!nextCell.includes('CODE') && !nextCell.includes('EN') && !nextCell.includes('LOGIC')) {
          vnColIndex = codeColIndex + 1
        } 
      }
      // Also check if CODE+2 might be VN
      if (vnColIndex === -1 && codeColIndex + 2 < headerRow.length) {
        const nextCell = String(headerRow[codeColIndex + 2] || '').trim().toUpperCase()
        if (nextCell.length > 0 && !nextCell.includes('CODE') && !nextCell.includes('EN') && !nextCell.includes('LOGIC')) {
          vnColIndex = codeColIndex + 2
        }
      }
    }
  }
  
  if (headerRowIndex === -1 || codeColIndex === -1) {
    return {}
  }
  
  const headerRow = block[headerRowIndex]
  const options: Array<{ code: string | number; en?: string; vn?: string; logic?: string }> = []
  const rows: Array<{ code: string | number; en?: string; vn?: string }> = []
  const columns: Array<{ code: string | number; label: string }> = []
  const questionColumns = new Map<string, Array<{ code: string | number; label: string }>>() // Columns per question
  const logic: { type?: string; terminate?: string; askIf?: string } = {}
  
  // Check if this is a shared table with question-specific columns (Q9, Q10.1, Q10.2)
  // Grid questions have column headers like "10.1 In-store", "10.2 Online", or question IDs like "Q9", "Q10.1"
  // OR they have descriptive column headers like "Trần chìm", "Trần nổi/thả" (Q7 example)
  let isGrid = false
  let hasQuestionColumns = false
  let gridColumnCount = 0 // Count of columns that look like grid columns
  
  headerRow.forEach((cell, colIndex) => {
    if (colIndex === codeColIndex || colIndex === enColIndex || colIndex === vnColIndex || colIndex === logicColIndex) {
      return
    }
    const cellText = String(cell || '').trim()
    
    // Skip empty cells
    if (!cellText || cellText.length === 0) {
      return
    }
    
    // Check for question ID columns (Q9, Q10.1, Q10.2)
    const questionIdMatch = cellText.match(/^Q(\d+(?:\.\d+)?[A-Z]?)$/i)
    if (questionIdMatch) {
      const qId = 'Q' + questionIdMatch[1]
      if (questionIds.includes(qId)) {
        hasQuestionColumns = true
        // This column is for a specific question (e.g., "Q9")
        // For Q9, this column indicates it's an options question, not a grid
        // We'll handle this in parseQuestionBlock
        if (!questionColumns.has(qId)) {
          questionColumns.set(qId, [])
        }
        // Mark this as an options column (not a grid column)
        questionColumns.get(qId)!.push({
          code: colIndex,
          label: cellText, // "Q9"
        })
      }
    }
    
    // Check for patterns like "10.1 In-store", "10.2. Online"
    const gridColMatch = cellText.match(/(\d+\.\d+)\s*(.+)/i)
    if (gridColMatch) {
      isGrid = true
      hasQuestionColumns = true
      gridColumnCount++
      // Find which question this column belongs to (Q10.1 or Q10.2)
      const colQId = 'Q' + gridColMatch[1]
      if (questionIds.includes(colQId)) {
        if (!questionColumns.has(colQId)) {
          questionColumns.set(colQId, [])
        }
        questionColumns.get(colQId)!.push({
          code: gridColMatch[1],
          label: gridColMatch[2].trim(),
        })
      } else {
        // General grid column
        columns.push({
          code: gridColMatch[1],
          label: gridColMatch[2].trim(),
        })
      }
    } else if (cellText && cellText.length > 3 && !cellText.match(/^(CODE|EN|VN|LOGIC|OPTION)$/i)) {
      // This looks like a grid column (descriptive text, not a standard header)
      // Examples: "Trần chìm (khung giấu...)", "Trần nổi/thả (khung lộ...)"
      // Only mark as grid if we have multiple such columns (at least 2)
      gridColumnCount++
      // If we have 2+ such columns, it's likely a grid.
      // IMPORTANT: do NOT push into `columns` here, because we will extract columns
      // from the header row in the dedicated extraction step below. Pushing here
      // would cause duplicates (e.g., Q7 becomes 3 columns instead of 2).
      if (gridColumnCount >= 2) isGrid = true
    }
  })
  
  
  if (hasQuestionColumns) {
  }
  
  if (isGrid || hasQuestionColumns) {
    // Extract columns from header row (for shared table scenario)
    if (!hasQuestionColumns) {
      // Ensure columns is clean (avoid duplicates from earlier detection)
      columns.length = 0

      // Regular grid - extract all columns that are not Code, EN, VN, Logic
      headerRow.forEach((cell, colIndex) => {
        if (colIndex === codeColIndex || colIndex === enColIndex || colIndex === vnColIndex || colIndex === logicColIndex) {
          return
        }
        const cellText = String(cell || '').trim()
        if (cellText && cellText.length > 0) {
          // Skip if it looks like a question ID or standard header
          if (cellText.match(/^Q\d+$/i) || cellText.match(/^(CODE|EN|VN|LOGIC|OPTION)$/i)) {
            return
          }
          
          // Extract column code and label (e.g., "10.1 In-store" → code: "10.1", label: "In-store")
          const colMatch = cellText.match(/(\d+\.\d+)\s*(.+)/i)
          if (colMatch) {
            columns.push({
              code: colMatch[1],
              label: colMatch[2].trim(),
            })
          } else {
            // No explicit code in header -> use sequential codes 1..N (NOT Excel column index)
            columns.push({
              code: columns.length + 1,
              label: cellText,
            })
          }
        }
      })
    }
    
    // Extract rows from data rows (brands/shops/rooms) - shared for all questions
    // For grid questions, rows are the row labels (e.g., "Phòng khách", "Phòng ngủ")
    // Columns are the column headers (e.g., "Trần chìm", "Trần nổi/thả")
    for (let i = headerRowIndex + 1; i < block.length; i++) {
      const row = block[i]
      const code = row[codeColIndex]
      if (!code || String(code).trim() === '') {
        // Check if this might be a city header (like "HỒ CHÍ MINH")
        const firstCell = String(row[0] || '').trim()
        if (firstCell && firstCell.length > 5 && !firstCell.match(/^\d+[\.\)]/) && !firstCell.match(/^Q\d+/i)) {
          // Skip city headers, they're not data rows
          continue
        }
        // Empty row, skip
        continue
      }
      
      const codeStr = String(code).trim()
      
      // Skip if code looks like a question ID (e.g., "Q10")
      if (codeStr.match(/^Q\d+/i)) {
        continue
      }
      
      // Skip if this row starts a new question
      const rowText = row.map(cell => String(cell || '')).join(' ')
      if (rowText.match(/\bQ\s*\d+[A-Z]?\b/i)) {
        break // End of this question block
      }
      
      // Skip summary rows like "TỔNG CỘNG"
      if (codeStr.toUpperCase().includes('TỔNG') || codeStr.toUpperCase().includes('TOTAL')) {
        continue
      }
      
      const en = enColIndex >= 0 ? String(row[enColIndex] || '').trim() : ''
      const vn = vnColIndex >= 0 ? String(row[vnColIndex] || '').trim() : ''
      
      // For grid questions, the VN column contains the row label
      // The code can be numeric (1, 2, 3...) or the row label itself
      if (codeStr || vn) {
        rows.push({
          code: codeStr || String(i - headerRowIndex), // Use code or row index
          en: en || undefined,
          vn: vn || undefined,
        })
      }
    }
    
    if (rows.length > 0 && rows.length <= 5) {
    }
  } else {
    // Regular question with options table
    for (let i = headerRowIndex + 1; i < block.length; i++) {
      const row = block[i]
      const code = row[codeColIndex]
      
      // Check if code exists - handle both string "00" and number 0
      // Don't skip if code is 0 or "00" (valid codes)
      if (code === null || code === undefined || code === '') {
        continue
      }
      
      // Convert to string - preserve original format
      // If code is already a string, use it as-is (preserves "00")
      // If code is number 0, we need to check if it should be "00"
      let codeStr: string = String(code).trim()
      
      // Special handling: if code is "0" but we're in a context where "00" is common
      // (like "Others" option with TERMINATE logic), check the logic column
      if (codeStr === '0') {
        const logicText = logicColIndex >= 0 ? String(row[logicColIndex] || '').trim() : ''
        const en = enColIndex >= 0 ? String(row[enColIndex] || '').trim() : ''
        const vn = vnColIndex >= 0 ? String(row[vnColIndex] || '').trim() : ''
        const label = vn || en || ''
        
        // If it has TERMINATE logic or standalone "Other"/"Khác" label, it's likely "00"
        // Avoid false positives like "khách" (contains "khác" as a prefix).
        const lower = label.toLowerCase()
        const hasStandaloneOther =
          /\bother\b/i.test(lower) ||
          /(^|[^\p{L}])khác([^\p{L}]|$)/iu.test(lower)

        if (/TERMINATE/i.test(logicText) || hasStandaloneOther) {
          codeStr = '00'
        }
      }
      
      // Skip empty string after conversion
      if (codeStr === '') continue
      
      // Skip if code looks like a question ID
      if (codeStr.match(/^Q\d+/i)) {
        break // End of this question block
      }
      
      // Skip if this row starts a new question
      const rowText = row.map(cell => String(cell || '')).join(' ')
      if (rowText.match(/\bQ\s*\d+[A-Z]?\b/i) && !rowText.match(new RegExp(`\\b${codeStr}\\b`))) {
        break // End of this question block
      }
      
      const en = enColIndex >= 0 ? String(row[enColIndex] || '').trim() : ''
      const vn = vnColIndex >= 0 ? String(row[vnColIndex] || '').trim() : ''
      const logicText = logicColIndex >= 0 ? String(row[logicColIndex] || '').trim() : ''
      
      
      options.push({
        code: codeStr, // Keep as string to preserve "00"
        en: en || undefined,
        vn: vn || undefined,
        logic: logicText || undefined,
      })
      
      // Extract logic from Logic column
      if (logicText) {
        if (/TERMINATE/i.test(logicText)) {
          logic.terminate = logicText
        }
        if (/ASK\s+IF/i.test(logicText)) {
          logic.askIf = logicText
        }
      }
    }
    
  }
  
  return {
    options: options.length > 0 ? options : undefined,
    rows: rows.length > 0 ? rows : undefined,
    columns: columns.length > 0 ? columns : undefined,
    questionColumns: hasQuestionColumns && questionColumns.size > 0 ? questionColumns : undefined,
    logic: Object.keys(logic).length > 0 ? logic : undefined,
  }
}
