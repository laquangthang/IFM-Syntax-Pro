/**
 * Backward compatibility file
 * @deprecated This file is kept for backward compatibility
 * Please use:
 * - Types: import from '@/lib/types'
 * - Parser: import from '@/lib/pdfParser'
 */

// Re-export types from types.ts
export type {
  QuestionOption,
  QuestionLogic,
  ParsedQuestion,
} from './types'

// Re-export parser function from pdfParser.ts
export {
  parseSurveyPDFStructured,
} from './pdfParser'

/**
 * Legacy function - redirects to structured extraction
 * @deprecated Use parseSurveyPDFStructured from '@/lib/pdfParser' instead
 */
export async function parseSurveyPDF(
  file: File,
  onProgress?: (progress: number) => void
): Promise<import('./types').ParsedQuestion[]> {
  const { parseSurveyPDFStructured } = await import('./pdfParser')
  console.warn('⚠️  parseSurveyPDF is deprecated. Using rule-based extraction instead.')
  return parseSurveyPDFStructured(file, onProgress ? (p, phase, details) => onProgress(p) : undefined)
}

/**
 * Legacy function - redirects to structured extraction
 * @deprecated Use parseSurveyPDFStructured from '@/lib/pdfParser' instead
 */
export async function parseSurveyPDFChunked(
  file: File,
  onProgress?: (progress: number, chunkIndex?: number, totalChunks?: number) => void,
  onChunkComplete?: (chunkIndex: number, questions: import('./types').ParsedQuestion[], totalParsed: number) => void,
  questionsPerChunk: number = 10
): Promise<import('./types').ParsedQuestion[]> {
  const { parseSurveyPDFStructured } = await import('./pdfParser')
  console.warn('⚠️  parseSurveyPDFChunked is deprecated. Using rule-based extraction instead.')
  return parseSurveyPDFStructured(file, onProgress ? (p, phase, details) => onProgress(p) : undefined)
}
