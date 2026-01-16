/**
 * Structure Detection Service
 * Detects question boundaries, options, and tables from extracted PDF text
 */

import { ExtractedPage, TextBlock } from './pdfExtractor'

export interface QuestionBoundary {
  id: string // Q1, Q2, Q3A, etc.
  startPage: number
  endPage: number
  startIndex: number // Character index in full text
  endIndex: number
  rawText: string
}

export interface DetectedOption {
  code: string | number
  label: string
  rawText: string
}

export interface DetectedStructure {
  questions: QuestionBoundary[]
  totalQuestions: number
  hasGrids: boolean
  hasLogic: boolean
}

/**
 * Detect question boundaries from PDF text
 */
export function detectQuestionBoundaries(
  pages: ExtractedPage[]
): QuestionBoundary[] {
  const fullText = pages.map(p => p.text).join('\n')
  const questions: QuestionBoundary[] = []
  
  // Pattern to match question IDs: Q1, Q2, Q3A, Q10, etc.
  const questionPattern = /(?:^|\n)\s*(Q\d+[A-Z]?)\s*[:\-\.]?\s*/gim
  let match: RegExpExecArray | null
  let currentIndex = 0
  
  while ((match = questionPattern.exec(fullText)) !== null) {
    const questionId = match[1]
    const startIndex = match.index
    const startPage = findPageForIndex(pages, startIndex)
    
    // Find end of question (next question or end of document)
    let endIndex = fullText.length
    questionPattern.lastIndex = startIndex + 1
    const nextMatch = questionPattern.exec(fullText)
    if (nextMatch) {
      endIndex = nextMatch.index
    }
    
    const rawText = fullText.substring(startIndex, endIndex).trim()
    const endPage = findPageForIndex(pages, endIndex)
    
    questions.push({
      id: questionId,
      startPage,
      endPage,
      startIndex,
      endIndex,
      rawText,
    })
  }
  
  return questions.sort((a, b) => {
    // Sort by question number
    const aNum = parseInt(a.id.replace(/\D/g, '')) || 0
    const bNum = parseInt(b.id.replace(/\D/g, '')) || 0
    if (aNum !== bNum) return aNum - bNum
    return a.id.localeCompare(b.id)
  })
}

/**
 * Find page number for a given character index
 */
function findPageForIndex(pages: ExtractedPage[], index: number): number {
  let currentIndex = 0
  for (const page of pages) {
    const pageLength = page.text.length + 2 // +2 for newlines
    if (index <= currentIndex + pageLength) {
      return page.pageNumber
    }
    currentIndex += pageLength
  }
  return pages.length
}

/**
 * Detect if text contains grid/table structures
 */
export function detectGrids(text: string): boolean {
  // Look for table indicators
  const gridPatterns = [
    /per attribute/i,
    /grid/i,
    /matrix/i,
    /table/i,
    /\|\s*\|\s*\|/, // Table separators
    /\s+\d+\s+\d+\s+\d+/, // Multiple numbers in a row (likely table)
  ]
  
  return gridPatterns.some(pattern => pattern.test(text))
}

/**
 * Detect if text contains logic keywords
 */
export function detectLogic(text: string): boolean {
  const logicPatterns = [
    /piping/i,
    /ask if/i,
    /ask for/i,
    /terminate/i,
    /exclusive/i,
    /script:/i,
  ]
  
  return logicPatterns.some(pattern => pattern.test(text))
}

/**
 * Extract options from question text (rule-based)
 */
export function extractOptionsFromText(questionText: string): DetectedOption[] {
  const options: DetectedOption[] = []
  
  // Pattern 1: Numbered options (1. Option, 2. Option, etc.)
  const numberedPattern = /(?:^|\n)\s*(\d+)[\.\)]\s*([^\n]+)/gim
  let match: RegExpExecArray | null
  
  while ((match = numberedPattern.exec(questionText)) !== null) {
    const code = parseInt(match[1])
    const label = match[2].trim()
    options.push({
      code,
      label,
      rawText: match[0],
    })
  }
  
  // Pattern 2: Letter options (a. Option, b. Option, etc.) - convert to numbers
  if (options.length === 0) {
    const letterPattern = /(?:^|\n)\s*([a-z])[\.\)]\s*([^\n]+)/gim
    let letterMatch: RegExpExecArray | null
    let letterIndex = 1
    
    while ((letterMatch = letterPattern.exec(questionText)) !== null) {
      const label = letterMatch[2].trim()
      options.push({
        code: letterIndex++,
        label,
        rawText: letterMatch[0],
      })
    }
  }
  
  // Pattern 3: Checkbox/bullet options (□ Option, • Option, etc.)
  if (options.length === 0) {
    const bulletPattern = /(?:^|\n)\s*[□•▪▫○◯]\s*([^\n]+)/gim
    let bulletMatch: RegExpExecArray | null
    let bulletIndex = 1
    
    while ((bulletMatch = bulletPattern.exec(questionText)) !== null) {
      const label = bulletMatch[1].trim()
      options.push({
        code: bulletIndex++,
        label,
        rawText: bulletMatch[0],
      })
    }
  }
  
  return options
}

/**
 * Main structure detection function
 */
export function detectStructure(pages: ExtractedPage[]): DetectedStructure {
  const fullText = pages.map(p => p.text).join('\n')
  const questions = detectQuestionBoundaries(pages)
  
  return {
    questions,
    totalQuestions: questions.length,
    hasGrids: detectGrids(fullText),
    hasLogic: detectLogic(fullText),
  }
}
