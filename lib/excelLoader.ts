import { ParsedQuestion } from './types'
import { parseXLSXToQuestions } from './xlsxParser'
import * as XLSX from 'xlsx'

export interface SurveyExcel {
  questions: ParsedQuestion[]
}

function normalizeInlineText(input: string): string {
  return (input || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForMatch(input: string): string {
  const base = normalizeInlineText(input)
  try {
    // Remove diacritics, then remove all non-letters/numbers to handle spaced-out PDF artifacts.
    return base
      .normalize('NFD')
      // @ts-ignore
      .replace(/\p{Diacritic}/gu, '')
      // @ts-ignore
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .toUpperCase()
  } catch {
    // Fallback without Unicode properties
    return base.replace(/[^A-Za-z0-9À-ỹ]+/g, '').toUpperCase()
  }
}

/**
 * Convert XLSXQuestionData to ParsedQuestion
 */
function convertXLSXQuestionToParsed(xlsxQ: import('./xlsxParser').XLSXQuestionData): ParsedQuestion {
  // Determine question type
  let questionType: ParsedQuestion['type'] = 'SA'
  if (xlsxQ.questionType) {
    if (xlsxQ.questionType === 'MA') questionType = 'MA'
    else if (xlsxQ.questionType === 'MA_Grid' || xlsxQ.questionType === 'SA/MA per attribute') questionType = 'MA_Grid'
    else if (xlsxQ.questionType === 'SA_Grid') questionType = 'SA_Grid'
    else if (xlsxQ.questionType === 'SA') questionType = 'SA'
    else if (xlsxQ.questionType === 'OE') questionType = 'OE'
    else if (xlsxQ.questionType === 'OE_Grid') questionType = 'OE_Grid'
  } else if (xlsxQ.rows && xlsxQ.columns) {
    // Has rows and columns = Grid question
    questionType = 'MA_Grid'
  } else if (xlsxQ.options && xlsxQ.options.length > 0) {
    // Check if MA (multiple answer)
    const hasMultipleAnswer = xlsxQ.instruction?.toUpperCase().includes('MA') || 
                               xlsxQ.options.some(opt => opt.logic?.toUpperCase().includes('MA'))
    questionType = hasMultipleAnswer ? 'MA' : 'SA'
  }
  
  // Extract options
  const options: ParsedQuestion['options'] = xlsxQ.options?.map(opt => {
    // Prefer VN label (Vietnamese), fallback to EN
    let label = normalizeInlineText(opt.vn || opt.en || String(opt.code))
    
    // Preserve code as string to keep "00" (not convert to 0)
    const code = typeof opt.code === 'number' && opt.code === 0 && String(opt.code) === '0' 
      ? '00' // If it's 0, might be "00" originally
      : String(opt.code) // Otherwise convert to string
    
    const isOtherLabel = (rawLabel: string): boolean => {
      // NEW RULE: Only treat as Other when it is a "specify/write-in" style option.
      // Vietnamese: (ghi rõ/ghi ro...), (vui lòng ghi rõ), etc.
      // English: Other (Specify), Other - specify, Other (please specify), etc.
      const text = (rawLabel || '').trim().toLowerCase()
      if (!text) return false

      // Normalize to no-diacritics for robust matching (e.g., "khac" vs "khác", "ghi ro" vs "ghi rõ")
      let ascii = text
      try {
        ascii = text
          .normalize('NFD')
          // @ts-ignore
          .replace(/\p{Diacritic}/gu, '')
      } catch {
        // ignore
      }

      const hasSpecifyCue =
        /\bghi\s*ro\b/i.test(ascii) || // covers "ghi rõ"/"ghi ro"
        /\bplease\s*specify\b/i.test(ascii) ||
        /\bspecif(?:y|ied|ication)\b/i.test(ascii) ||
        /\bwrite\s*in\b/i.test(ascii) ||
        /\b(open[-\s]*ended|open\s*end(ed)?)\b/i.test(ascii)

      if (!hasSpecifyCue) return false

      // Must contain "other" OR "khác" as a standalone word near the cue
      // We keep a strict boundary check to avoid words like "khách sạn"
      const isLetter = (ch: string | undefined) => {
        if (!ch) return false
        try {
          return /\p{L}/u.test(ch)
        } catch {
          return /[A-Za-zÀ-ỹ]/.test(ch)
        }
      }

      const containsWholeWord = (haystack: string, needle: string) => {
        let start = 0
        while (start <= haystack.length) {
          const idx = haystack.indexOf(needle, start)
          if (idx === -1) return false
          const before = haystack[idx - 1]
          const after = haystack[idx + needle.length]
          const beforeOk = !isLetter(before)
          const afterOk = !isLetter(after)
          if (beforeOk && afterOk) return true
          start = idx + 1
        }
        return false
      }

      // Check on ascii string so "khac" is accepted too
      return (
        containsWholeWord(ascii, 'other') ||
        containsWholeWord(ascii, 'khac')
      )
    }

    const isOtherLogic = (rawLogic: string | undefined | null): boolean => {
      if (!rawLogic) return false
      const t = String(rawLogic).toLowerCase()
      // Only treat as other when logic explicitly indicates specify/write-in
      return (
        (t.includes('other') && /\b(specif|please\s*specify|write\s*in)\b/i.test(t)) ||
        (t.includes('khác') && /\bghi\s*r[oõ]\b/i.test(t))
      )
    }

    // Determine codeType from logic
    let codeType: 'Normal' | 'Exclusive' | 'Trap' | 'Other' | 'Terminate' = 'Normal'
    if (opt.logic) {
      const logicUpper = String(opt.logic).toUpperCase()
      if (logicUpper.includes('TERMINATE')) {
        codeType = 'Terminate'
      }
      else if (logicUpper.includes('EXCLUSIVE')) codeType = 'Exclusive'
      else if (logicUpper.includes('TRAP')) codeType = 'Trap'
      else if (isOtherLogic(opt.logic) || isOtherLabel(label)) codeType = 'Other'
    }
    
    // Check if label contains "Other" or "Khác"
    if (!opt.logic && isOtherLabel(label)) {
      codeType = 'Other'
    }
    
    // Special case: if code is "00" and has "Other"/"Khác" label, it's likely "Other" type
    if (code === '00' && isOtherLabel(label)) {
      // But if it has TERMINATE logic, keep Terminate type
      if (codeType !== 'Terminate') {
        codeType = 'Other'
      }
    }
    
    return {
      code: code, // Keep as string
      label,
      codeType,
    }
  })
  
  // Extract rows for Grid questions
  const rows: ParsedQuestion['rows'] = xlsxQ.rows?.map((row) => {
    // Prefer VN label (Vietnamese), fallback to EN
    const label = normalizeInlineText(row.vn || row.en || String(row.code))
    
    return {
      code: row.code,
      label,
      codeType: 'Normal' as const,
    }
  })
  
  // Extract columns for Grid questions
  const columns: ParsedQuestion['columns'] = xlsxQ.columns?.map(col => ({
    code: col.code,
    label: normalizeInlineText(col.label),
    codeType: 'Normal' as const,
  }))
  
  // Extract logic
  const logic: ParsedQuestion['logic'] = {
    type: 'Normal',
    piping_source: null,
    terminate_if: null,
    ask_if_condition: null,
  }
  
  if (xlsxQ.instruction) {
    if (/SCRIPT:\s*HỎI\s+TẤT\s+CẢ/i.test(xlsxQ.instruction) || /ASK\s+ALL/i.test(xlsxQ.instruction)) {
      logic.type = 'Ask All'
    }
    
    // Detect generic piping source references (Vietnamese + English)
    // Examples:
    // - "SHOW CODES IN Q7 ..."
    // - "INSERT CODE Q6 ..."
    // - "HỎI CHO TỪNG ... Q6 ..."
    const instr = xlsxQ.instruction
    const pipingSourceMatch =
      instr.match(/\bINSERT\s+CODE\s+(Q\d+(?:\.\d+)?)/i) ||
      instr.match(/\bCODES?\s+IN\s+(Q\d+(?:\.\d+)?)/i) ||
      instr.match(/\bCHO\s+TỪNG[\s\S]*?\b(Q\d+(?:\.\d+)?)/i) ||
      instr.match(/\bFOR\s+EACH[\s\S]*?\b(Q\d+(?:\.\d+)?)/i)

    if (pipingSourceMatch) {
      logic.piping_source = pipingSourceMatch[1].toUpperCase()
      // If this is an OE asked per code/category, treat as OE_Grid
      if (questionType === 'OE' && /(CHO\s+TỪNG|FOR\s+EACH|INSERT\s+CODE)/i.test(instr)) {
        questionType = 'OE_Grid'
      }
    }

    // Detect Ask If (e.g., "ASK Q10.2 FOR CODE 1 SELECTED IN Q7")
    const askIfMatch = xlsxQ.instruction.match(/ASK\s+(?:Q\d+\.\d+|FOR|IF)\s+(?:FOR|IF)\s+CODE\s+(\d+)\s+(?:IN|SELECTED)\s+(Q\d+)/i)
    if (askIfMatch) {
      const code = askIfMatch[1]
      const sourceQ = askIfMatch[2]
      logic.piping_source = sourceQ
      logic.ask_if_condition = `IF (${sourceQ}RX = ${code})`
      logic.type = 'Piping'
    } else {
      // Try alternative pattern: "ASK Q10.2 FOR CODE 1 SELECTED IN Q7"
      const altAskIfMatch = xlsxQ.instruction.match(/ASK\s+(Q\d+\.\d+)\s+FOR\s+CODE\s+(\d+)\s+SELECTED\s+IN\s+(Q\d+)/i)
      if (altAskIfMatch) {
        const targetQ = altAskIfMatch[1]
        const code = altAskIfMatch[2]
        const sourceQ = altAskIfMatch[3]
        logic.piping_source = sourceQ
        logic.ask_if_condition = `IF (${sourceQ}RX = ${code})`
        logic.type = 'Piping'
      }
    }

    // Vietnamese "không chọn code X" condition (best-effort)
    // Example: "KHÔNG CHỌN ... (CODE 1)" → set ask_if_condition referencing piping_source
    const codeMatch = instr.match(/\bCODE\s+(\d+)\b/i)
    if (!logic.ask_if_condition && logic.piping_source && codeMatch) {
      const code = codeMatch[1]
      if (/KHÔNG\s+CHỌN|NOT\s+SELECT|DOESN'?T\s+SELECT/i.test(instr)) {
        logic.ask_if_condition = `IF NOT (${logic.piping_source}RX = ${code})`
        logic.type = logic.type === 'Ask All' ? 'Piping' : logic.type
      }
    }
    
    // Detect terminate
    if (/TERMINATE/i.test(xlsxQ.instruction)) {
      logic.terminate_if = xlsxQ.logic?.terminate || 'TERMINATE'
    }
  }
  
  return {
    id: xlsxQ.questionId,
    type: questionType,
    instruction: xlsxQ.instruction || undefined,
    label: normalizeInlineText(xlsxQ.label || xlsxQ.questionId),
    options: options && options.length > 0 ? options : undefined,
    rows: rows && rows.length > 0 ? rows : undefined,
    columns: columns && columns.length > 0 ? columns : undefined,
    logic,
  }
}

/**
 * Load Excel file from user's file system and parse questions
 */
export async function loadExcelFromFile(file: File): Promise<SurveyExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        
        // Parse questions from XLSX
        const xlsxQuestions = parseXLSXToQuestions(workbook)
        
        if (xlsxQuestions.length === 0) {
          throw new Error('No questions found in Excel file')
        }
        
        // Convert XLSXQuestionData to ParsedQuestion
        const questions = xlsxQuestions.map(xlsxQ => convertXLSXQuestionToParsed(xlsxQ))

        // Second pass: enrich OE_Grid rows from piping_source question options (if available)
        const qMap = new Map<string, ParsedQuestion>()
        for (const q of questions) qMap.set(q.id, q)

        const enriched = questions.map((q) => {
          if (q.type !== 'OE_Grid') return q
          if (q.rows && q.rows.length > 0) return q

          const sourceId = q.logic?.piping_source || null
          if (!sourceId) return q

          const source = qMap.get(sourceId)
          if (!source?.options || source.options.length === 0) return q

          return {
            ...q,
            // OE_Grid uses rows only
            rows: source.options.map((opt) => ({
              code: opt.code,
              label: opt.label,
              codeType: opt.codeType || 'Normal',
            })),
            columns: undefined,
            options: undefined,
          }
        })

        // Third pass: for Grid questions with piping_source, align column codes to piping source codes by label.
        const enrichedMap = new Map<string, ParsedQuestion>()
        for (const q of enriched) enrichedMap.set(q.id, q)

        const finalQuestions = enriched.map((q) => {
          const srcId = q.logic?.piping_source || null
          if (!srcId) return q
          if (!q.columns || q.columns.length === 0) return q

          const src = enrichedMap.get(srcId)
          if (!src) return q

          // Prefer mapping against source rows (e.g., Q8 columns are rooms from Q7 rows)
          const refList = src.rows?.length ? src.rows : src.options?.length ? src.options : src.columns
          if (!refList || refList.length === 0) return q

          const refMap = new Map<string, string | number>()
          for (const r of refList) {
            refMap.set(normalizeForMatch(r.label), r.code)
          }

          const remappedCols = q.columns.map((col) => {
            const key = normalizeForMatch(col.label)
            const mappedCode = refMap.get(key)
            return mappedCode !== undefined ? { ...col, code: mappedCode } : col
          })

          return { ...q, columns: remappedCols }
        })

        resolve({ questions: finalQuestions })
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}
