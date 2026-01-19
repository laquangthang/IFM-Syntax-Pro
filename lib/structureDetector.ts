/**
 * Structure Detection Service
 * Detects question boundaries, options, and tables from extracted PDF text
 */

import { ExtractedPage } from './pdfExtractor'

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
  // Use markdown if available (preserves table structure), otherwise use text
  const fullText = pages.map(p => p.markdown || p.text).join('\n')
  const questions: QuestionBoundary[] = []
  
  // Multiple patterns to match question IDs
  // Pattern 1: Q1, Q2, Q3A, Q10, etc. (standard)
  // Pattern 2: Q 1, Q 2 (with space)
  // Pattern 3: Question 1, Question 2
  const patterns = [
    /(?:^|\n|\s)(Q\s*\d+[A-Z]?)\s*[:\-\.]?\s*/gim,  // Q1, Q 1, Q3A
    /(?:^|\n|\s)(Question\s*\d+[A-Z]?)\s*[:\-\.]?\s*/gim,  // Question 1
  ]
  
  const allMatches: Array<{ id: string; index: number; pattern: number }> = []
  
  // Collect all matches from all patterns
  patterns.forEach((pattern, patternIndex) => {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0 // Reset pattern
    
    while ((match = pattern.exec(fullText)) !== null) {
      let questionId = match[1]
      // Normalize: remove spaces, convert "Question 1" to "Q1"
      questionId = questionId.replace(/\s+/g, '')
      if (questionId.startsWith('Question')) {
        questionId = 'Q' + questionId.replace(/Question/i, '')
      }
      
      // Avoid duplicates
      const existing = allMatches.find(m => m.index === match!.index)
      if (!existing) {
        allMatches.push({
          id: questionId,
          index: match.index,
          pattern: patternIndex,
        })
      }
    }
  })
  
  // Sort matches by index
  allMatches.sort((a, b) => a.index - b.index)
  
  // Group matches by question ID - keep only first occurrence of each ID
  const questionMap = new Map<string, { id: string; index: number; pattern: number }>()
  
  // Keep only the first match for each question ID
  allMatches.forEach(match => {
    if (!questionMap.has(match.id)) {
      questionMap.set(match.id, match)
    } else {
      // If we already have this ID, keep the one with the earliest index
      const existing = questionMap.get(match.id)!
      if (match.index < existing.index) {
        questionMap.set(match.id, match)
      }
    }
  })
  
  // Convert to array and sort by index
  const uniqueMatches = Array.from(questionMap.values()).sort((a, b) => a.index - b.index)
  
  // Create question boundaries
  for (let i = 0; i < uniqueMatches.length; i++) {
    const match = uniqueMatches[i]
    const nextMatch = uniqueMatches[i + 1]
    
    const startIndex = match.index
    const endIndex = nextMatch ? nextMatch.index : fullText.length
    const startPage = findPageForIndex(pages, startIndex)
    const endPage = findPageForIndex(pages, endIndex)
    
    const rawText = fullText.substring(startIndex, endIndex).trim()
    
    // Only create boundary if text is meaningful (at least 20 chars)
    if (rawText.length >= 20) {
      questions.push({
        id: match.id,
        startPage,
        endPage,
        startIndex,
        endIndex,
        rawText,
      })
    }
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
  const seenLabels = new Set<string>() // Avoid duplicates
  
  // Pattern 1: Numbered options (1. Option, 2. Option, etc.)
  const numberedPattern = /(?:^|\n)\s*(\d+)[\.\)]\s*([^\n]+)/gim
  let match: RegExpExecArray | null
  
  while ((match = numberedPattern.exec(questionText)) !== null) {
    const code = parseInt(match[1])
    const label = match[2].trim()
    
    // Skip if label is too short or looks like part of question text
    if (label.length < 2) continue
    if (/^(Note|SCRIPT|TERMINATE|Piping|ASK)/i.test(label)) continue
    
    const labelKey = label.toLowerCase()
    if (!seenLabels.has(labelKey)) {
      options.push({
        code,
        label,
        rawText: match[0],
      })
      seenLabels.add(labelKey)
    }
  }
  
  // Pattern 2: Letter options (a. Option, b. Option, etc.) - convert to numbers
  if (options.length === 0) {
    const letterPattern = /(?:^|\n)\s*([a-z])[\.\)]\s*([^\n]+)/gim
    let letterMatch: RegExpExecArray | null
    let letterIndex = 1
    
    while ((letterMatch = letterPattern.exec(questionText)) !== null) {
      const label = letterMatch[2].trim()
      
      if (label.length < 2) continue
      if (/^(Note|SCRIPT|TERMINATE|Piping|ASK)/i.test(label)) continue
      
      const labelKey = label.toLowerCase()
      if (!seenLabels.has(labelKey)) {
        options.push({
          code: letterIndex++,
          label,
          rawText: letterMatch[0],
        })
        seenLabels.add(labelKey)
      }
    }
  }
  
  // Pattern 3: Checkbox/bullet options (□ Option, • Option, etc.)
  if (options.length === 0) {
    const bulletPattern = /(?:^|\n)\s*[□•▪▫○◯]\s*([^\n]+)/gim
    let bulletMatch: RegExpExecArray | null
    let bulletIndex = 1
    
    while ((bulletMatch = bulletPattern.exec(questionText)) !== null) {
      const label = bulletMatch[1].trim()
      
      if (label.length < 2) continue
      if (/^(Note|SCRIPT|TERMINATE|Piping|ASK)/i.test(label)) continue
      
      const labelKey = label.toLowerCase()
      if (!seenLabels.has(labelKey)) {
        options.push({
          code: bulletIndex++,
          label,
          rawText: bulletMatch[0],
        })
        seenLabels.add(labelKey)
      }
    }
  }
  
  // Pattern 4: Options with parentheses (1) Option, (2) Option
  if (options.length === 0) {
    const parenPattern = /(?:^|\n)\s*\((\d+)\)\s*([^\n]+)/gim
    let parenMatch: RegExpExecArray | null
    
    while ((parenMatch = parenPattern.exec(questionText)) !== null) {
      const code = parseInt(parenMatch[1])
      const label = parenMatch[2].trim()
      
      if (label.length < 2) continue
      if (/^(Note|SCRIPT|TERMINATE|Piping|ASK)/i.test(label)) continue
      
      const labelKey = label.toLowerCase()
      if (!seenLabels.has(labelKey)) {
        options.push({
          code,
          label,
          rawText: parenMatch[0],
        })
        seenLabels.add(labelKey)
      }
    }
  }
  
  // Pattern 5: Options starting with dash (- Option)
  if (options.length === 0) {
    const dashPattern = /(?:^|\n)\s*-\s*([^\n]+)/gim
    let dashMatch: RegExpExecArray | null
    let dashIndex = 1
    
    while ((dashMatch = dashPattern.exec(questionText)) !== null) {
      const label = dashMatch[1].trim()
      
      if (label.length < 2) continue
      if (/^(Note|SCRIPT|TERMINATE|Piping|ASK)/i.test(label)) continue
      // Skip if it looks like a question ID
      if (/^Q\d+/i.test(label)) continue
      
      const labelKey = label.toLowerCase()
      if (!seenLabels.has(labelKey)) {
        options.push({
          code: dashIndex++,
          label,
          rawText: dashMatch[0],
        })
        seenLabels.add(labelKey)
      }
    }
  }
  
  // Sort options by code
  return options.sort((a, b) => {
    const aCode = typeof a.code === 'number' ? a.code : parseInt(String(a.code)) || 0
    const bCode = typeof b.code === 'number' ? b.code : parseInt(String(b.code)) || 0
    return aCode - bCode
  })
}

/**
 * Main structure detection function
 */
export function detectStructure(pages: ExtractedPage[]): DetectedStructure {
  // Use markdown if available (preserves table structure), otherwise use text
  const fullText = pages.map(p => p.markdown || p.text).join('\n')
  const questions = detectQuestionBoundaries(pages)
  
  return {
    questions,
    totalQuestions: questions.length,
    hasGrids: detectGrids(fullText),
    hasLogic: detectLogic(fullText),
  }
}
