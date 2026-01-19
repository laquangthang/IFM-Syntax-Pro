import { NextRequest, NextResponse } from 'next/server'
import { ParsedQuestion } from '@/lib/types'
import { extractPDFText } from '@/lib/pdfExtractor'
import { detectStructure, extractOptionsFromText, QuestionBoundary } from '@/lib/structureDetector'
import { postProcessQuestions } from '@/lib/postProcessor'
import { parseXLSXToQuestions } from '@/lib/xlsxParser'
import * as XLSX from 'xlsx'

/**
 * Convert XLSXQuestionData to ParsedQuestion
 */
function convertXLSXQuestionToParsed(xlsxQ: import('@/lib/xlsxParser').XLSXQuestionData): ParsedQuestion {
  // Determine question type
  let questionType: ParsedQuestion['type'] = 'SA'
  if (xlsxQ.questionType) {
    if (xlsxQ.questionType === 'MA') questionType = 'MA'
    else if (xlsxQ.questionType === 'MA_Grid' || xlsxQ.questionType === 'SA/MA per attribute') questionType = 'MA_Grid'
    else if (xlsxQ.questionType === 'SA_Grid') questionType = 'SA_Grid'
    else if (xlsxQ.questionType === 'SA') questionType = 'SA'
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
    let label = opt.vn || opt.en || String(opt.code)
    
    // Preserve code as string to keep "00" (not convert to 0)
    const code = typeof opt.code === 'number' && opt.code === 0 && String(opt.code) === '0' 
      ? '00' // If it's 0, might be "00" originally
      : String(opt.code) // Otherwise convert to string
    
    const normalizeLabel = (s: string) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const stripDiacritics = (s: string) => {
      try {
        return s
          .normalize('NFD')
          // @ts-ignore
          .replace(/\p{Diacritic}/gu, '')
      } catch {
        return s
      }
    }

    // Same rule as client: only Other if it is a specify/write-in option
    const isOtherLabel = (rawLabel: string): boolean => {
      const text = normalizeLabel(rawLabel)
      if (!text) return false
      const ascii = stripDiacritics(text)

      const hasSpecifyCue =
        /\bghi\s*ro\b/i.test(ascii) || // covers "ghi rõ"/"ghi ro"
        /\bplease\s*specify\b/i.test(ascii) ||
        /\bspecif(?:y|ied|ication)\b/i.test(ascii) ||
        /\bwrite\s*in\b/i.test(ascii) ||
        /\b(open[-\s]*ended|open\s*end(ed)?)\b/i.test(ascii)

      if (!hasSpecifyCue) return false

      // Basic strict match for other/khác token
      return /\bother\b/i.test(ascii) || /(^|[^a-z])khac([^a-z]|$)/i.test(ascii)
    }

    const isOtherLogic = (rawLogic: string | undefined | null): boolean => {
      if (!rawLogic) return false
      const t = String(rawLogic).toLowerCase()
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
      label: label.trim(),
      codeType,
    }
  })
  
  // Extract rows for Grid questions
  const rows: ParsedQuestion['rows'] = xlsxQ.rows?.map((row) => {
    // Prefer VN label (Vietnamese), fallback to EN
    const label = row.vn || row.en || String(row.code)
    
    return {
      code: row.code,
      label: label.trim(),
      codeType: 'Normal' as const,
    }
  })
  
  // Extract columns for Grid questions
  const columns: ParsedQuestion['columns'] = xlsxQ.columns?.map(col => ({
    code: col.code,
    label: col.label,
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
    
    // Detect terminate
    if (/TERMINATE/i.test(xlsxQ.instruction)) {
      logic.terminate_if = xlsxQ.logic?.terminate || 'TERMINATE'
    }
  }
  
  return {
    id: xlsxQ.questionId,
    type: questionType,
    instruction: xlsxQ.instruction || undefined,
    label: xlsxQ.label || xlsxQ.questionId,
    options: options && options.length > 0 ? options : undefined,
    rows: rows && rows.length > 0 ? rows : undefined,
    columns: columns && columns.length > 0 ? columns : undefined,
    logic,
  }
}

/**
 * Rule-based question parser - Convert QuestionBoundary to ParsedQuestion
 */
function parseQuestionRuleBased(questionBoundary: QuestionBoundary): ParsedQuestion {
  const rawText = questionBoundary.rawText
  const detectedOptions = extractOptionsFromText(rawText)
  
  // Detect question type
  let questionType: ParsedQuestion['type'] = 'SA'
  let limit: number | undefined = undefined
  
  // Type detection patterns
  if (/Note:\s*MA/i.test(rawText) || /\bMA\b/i.test(rawText)) {
    questionType = 'MA'
  } else if (/Note:\s*SA\/MA\s+per\s+attribute/i.test(rawText) || /SA\/MA\s+per\s+attribute/i.test(rawText)) {
    questionType = detectedOptions.length > 0 ? 'MA_Grid' : 'SA_Grid'
  } else if (/Note:\s*SA\/MA\s+per\s+attribute/i.test(rawText)) {
    questionType = 'SA_Grid'
  } else if (/Ranking\s*=\s*(\d+)/i.test(rawText)) {
    const rankMatch = rawText.match(/Ranking\s*=\s*(\d+)/i)
    questionType = 'Rank_Fixed'
    limit = rankMatch ? parseInt(rankMatch[1]) : undefined
  } else if (/Ranking\s+upto\s+(\d+)/i.test(rawText)) {
    const rankMatch = rawText.match(/Ranking\s+upto\s+(\d+)/i)
    questionType = 'Rank_Upto'
    limit = rankMatch ? parseInt(rankMatch[1]) : undefined
  } else if (/OE\/OA/i.test(rawText) || /\(ghi\s+rõ\)/i.test(rawText)) {
    if (/per\s+attribute/i.test(rawText)) {
      questionType = 'OE_Grid'
    } else {
      questionType = 'OE'
    }
  } else if (/Note:\s*SA/i.test(rawText) || /SCRIPT:\s*HỎI\s+TẤT\s+CẢ/i.test(rawText)) {
    questionType = 'SA'
  }
  
  // Extract instruction and label
  let instruction = ''
  let label = rawText
  
  // Remove instruction markers
  const instructionPatterns = [
    /Note:\s*[^\n]+/gi,
    /SCRIPT:\s*[^\n]+/gi,
    /TERMINATE[^\n]*/gi,
  ]
  
  instructionPatterns.forEach(pattern => {
    const matches = label.match(pattern)
    if (matches) {
      instruction += matches.join(' ') + ' '
      label = label.replace(pattern, '')
    }
  })
  
  instruction = instruction.trim()
  
  // Clean label - remove question ID prefix
  label = label.replace(/^Q\d+[A-Z]?\s*[:\-\.]?\s*/i, '').trim()
  
  // Remove Vietnamese/English separation
  const lines = label.split('\n')
  const cleanedLines: string[] = []
  
  for (const line of lines) {
    // Skip lines that are clearly English-only instructions
    if (/^[A-Z][a-z]+\s+[A-Z]/.test(line) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(line)) {
      continue
    }
    cleanedLines.push(line.trim())
  }
  
  label = cleanedLines.filter(l => l.length > 0).join(' ').trim()
  
  // Extract options
  const options: Array<{ code: string | number; label: string; codeType: 'Normal' | 'Exclusive' | 'Trap' | 'Other' | 'Terminate' }> = detectedOptions.map(opt => ({
    code: opt.code,
    label: opt.label,
    codeType: 'Normal' as const,
  }))
  
  // Add "Other" option if "(ghi rõ)" is present
  if (/\(ghi\s+rõ\)/i.test(rawText) && questionType === 'OE') {
    const lastCode = options.length > 0 ? (typeof options[options.length - 1].code === 'number' ? options[options.length - 1].code : parseInt(String(options[options.length - 1].code)) || 1) : 1
    options.push({
      code: `${lastCode}_O`,
      label: 'Khác (ghi rõ)',
      codeType: 'Other' as const,
    })
  }
  
  // Detect logic
  const logic: ParsedQuestion['logic'] = {
    type: 'Normal',
    piping_source: null,
    terminate_if: null,
    ask_if_condition: null,
  }
  
  // Detect "Ask All"
  if (/SCRIPT:\s*HỎI\s+TẤT\s+CẢ/i.test(rawText)) {
    logic.type = 'Ask All'
  }
  
  // Detect piping
  const pipingMatch = rawText.match(/Piping\s+code\s+in\s+(Q\d+[A-Z]?)/i)
  if (pipingMatch) {
    logic.piping_source = pipingMatch[1]
    logic.type = 'Piping'
  }
  
  // Detect "Ask If"
  const askIfMatch = rawText.match(/ASK\s+(?:FOR|IF)\s+CODE\s+(\d+)\s+IN\s+(Q\d+[A-Z]?)/i)
  if (askIfMatch) {
    const code = askIfMatch[1]
    const sourceQ = askIfMatch[2]
    logic.piping_source = sourceQ
    logic.ask_if_condition = `IF (${sourceQ}RX = ${code})`
  }
  
  // Detect terminate
  if (/TERMINATE/i.test(rawText)) {
    const terminateMatch = rawText.match(/TERMINATE\s+IF\s+([^\n]+)/i)
    if (terminateMatch) {
      logic.terminate_if = terminateMatch[1].trim()
    }
  }
  
  // Extract rows and columns for grid questions
  const rows: ParsedQuestion['rows'] = []
  const columns: ParsedQuestion['columns'] = []
  
  if (questionType.includes('Grid')) {
    const rowPattern = /(?:^|\n)\s*[-•]\s*([^\n]+)/gim
    let rowMatch
    while ((rowMatch = rowPattern.exec(rawText)) !== null) {
      const rowText = rowMatch[1].trim()
      if (rowText && !rowText.match(/^\d+[\.\)]/)) {
        rows.push({
          code: rows.length + 1,
          label: rowText,
          codeType: 'Normal',
        })
      }
    }
    
    if (questionType === 'MA_Grid' && options.length > 0) {
      columns.push(...options)
    }
  }
  
  const parsedQuestion: ParsedQuestion = {
    id: questionBoundary.id,
    type: questionType,
    instruction: instruction || undefined,
    label: label || questionBoundary.id,
    options: options.length > 0 ? options : undefined,
    rows: rows.length > 0 ? rows : undefined,
    columns: columns.length > 0 ? columns : undefined,
    limit,
    logic,
  }
  
  return parsedQuestion
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Step 1: Extract PDF to XLSX using ConvertAPI
    let pages
    let workbook: XLSX.WorkBook | null = null
    try {
      pages = await extractPDFText(file)
      
      // Get workbook from first page if available
      const firstPageWorkbook = pages.length > 0 ? (pages[0] as any).workbook : null
      if (firstPageWorkbook && 
          firstPageWorkbook.SheetNames && 
          Array.isArray(firstPageWorkbook.SheetNames) && 
          firstPageWorkbook.SheetNames.length > 0) {
        workbook = firstPageWorkbook as XLSX.WorkBook
      } else {
        console.warn('[PDF Extraction] No workbook found in extracted pages')
      }
    } catch (extractError: any) {
      console.error('❌ PDF extraction error:', extractError.message)
      console.error('   Error name:', extractError.name)
      console.error('   Stack:', extractError.stack)
      console.error('   Full error object:', JSON.stringify(extractError, Object.getOwnPropertyNames(extractError), 2))
      return NextResponse.json(
        { 
          error: 'Failed to extract PDF text',
          details: extractError.message,
          errorType: extractError.name,
          stack: process.env.NODE_ENV === 'development' ? extractError.stack : undefined
        },
        { status: 500 }
      )
    }
    
    if (!pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No text content extracted from PDF' },
        { status: 400 }
      )
    }
    
    // Step 2: Parse questions from XLSX structure
    let parsedQuestions: ParsedQuestion[] = []
    const errors: string[] = []
    
    if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
      // Parse directly from XLSX
      try {
        const xlsxQuestions = parseXLSXToQuestions(workbook)
        
        if (xlsxQuestions.length > 0) {
          // Convert XLSXQuestionData to ParsedQuestion
          parsedQuestions = xlsxQuestions.map(xlsxQ => convertXLSXQuestionToParsed(xlsxQ))
        }
      } catch (xlsxError: any) {
        console.error('[XLSX Parsing] Error:', xlsxError.message)
        console.error('[XLSX Parsing] Stack:', xlsxError.stack)
        errors.push(`XLSX parsing: ${xlsxError.message}`)
      }
    }
    
    // Fallback: Use text-based detection if XLSX parsing failed
    if (parsedQuestions.length === 0) {
      const fullText = pages.map(p => p.markdown || p.text).join('\n')
      const structure = detectStructure(pages)
      
      if (structure.questions.length === 0) {
        return NextResponse.json(
          { 
            error: 'No questions detected in PDF',
            details: {
              pagesExtracted: pages.length,
              totalTextLength: fullText.length,
              textPreview: fullText.substring(0, 1000),
              suggestion: 'Please check if the PDF contains questions with IDs like Q1, Q2, etc.'
            }
          },
          { status: 400 }
        )
      }
      
      // Parse each question from text
      for (let i = 0; i < structure.questions.length; i++) {
        const questionBoundary = structure.questions[i]
        try {
          const parsed = parseQuestionRuleBased(questionBoundary)
          parsedQuestions.push(parsed)
        } catch (error: any) {
          console.error(`   ❌ Error parsing ${questionBoundary.id}:`, error.message)
          errors.push(`${questionBoundary.id}: ${error.message}`)
        }
      }
    }
    
    if (parsedQuestions.length === 0) {
      return NextResponse.json(
        { 
          error: 'No questions could be parsed',
          details: errors
        },
        { status: 400 }
      )
    }

    // Step 3: Post-processing
    let postProcessed
    try {
      postProcessed = postProcessQuestions(parsedQuestions)
    } catch (postError: any) {
      console.error('[Post-processing] Error:', postError.message)
      throw new Error(`Post-processing failed: ${postError.message}`)
    }

    // Prepare response
    const response: any = {
      success: true,
      questions: postProcessed.questions,
      totalQuestions: postProcessed.questions.length,
      errors: errors.length > 0 ? errors : undefined,
      validation: postProcessed.validation,
    }
    
    // Include workbook data if available (for Excel export)
    if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
      try {
        // Convert workbook to base64 for client-side download
        const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
        const workbookBase64 = workbookBuffer.toString('base64')
        response.workbookBase64 = workbookBase64
        response.workbookFileName = file.name.replace(/\.pdf$/i, '.xlsx')
      } catch (exportError: any) {
        console.warn(`   ⚠️  Failed to prepare workbook for export: ${exportError.message}`)
      }
    }
    
    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Error in PDF extraction:', error)
    console.error('   Stack:', error.stack)
    
    return NextResponse.json(
      { 
        error: 'Failed to extract PDF',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
