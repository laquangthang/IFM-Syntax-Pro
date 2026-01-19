/**
 * PDF Parser - Client-side function to parse survey PDFs
 * Uses rule-based extraction (no AI)
 */

import { ParsedQuestion } from './types'

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse Survey PDF using Rule-Based Extraction
 * Uses rule-based extraction from PDF, no AI involved
 * @param file - PDF file from input
 * @param onProgress - Optional progress callback (0-100, phase, details)
 * @returns Array of parsed questions
 */
export async function parseSurveyPDFStructured(
  file: File,
  onProgress?: (progress: number, phase?: string, details?: string) => void
): Promise<ParsedQuestion[]> {
  const maxRetries = 3
  const networkErrorDelays = [2000, 4000, 8000]
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      
      if (onProgress) onProgress(5, 'Initializing', 'Preparing rule-based extraction...')
      
      const formData = new FormData()
      formData.append('file', file)
      
      if (onProgress) onProgress(10, 'Uploading', 'Sending PDF to server...')
      
      const response = await fetch('/api/parse-survey-structured', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Handle server errors
        if (response.status >= 500 && attempt < maxRetries) {
          const delayMs = networkErrorDelays[attempt]
          console.warn(`⚠️  Server error. Retrying in ${delayMs / 1000}s...`)
          if (onProgress) onProgress(30 + attempt * 10, 'Retrying', `Server error, retrying...`)
          await delay(delayMs)
          continue
        }
        
        // Log full error details before throwing
        console.error('❌ Server error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          details: errorData.details,
        })
        
        const errorMessage = errorData.details 
          ? `${errorData.error || 'Failed to extract PDF'}: ${errorData.details}`
          : errorData.error || `Failed to extract PDF: ${response.statusText}`
        
        throw new Error(errorMessage)
      }
      
      if (onProgress) onProgress(90, 'Processing', 'Finalizing results...')
      
      const data = await response.json()
      
      if (!data.success || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format from extraction API')
      }
      
      if (onProgress) onProgress(100, 'Complete', `Extracted ${data.questions.length} questions`)
      
      if (data.validation?.errors?.length > 0) {
        console.warn(`⚠️  Validation errors:`, data.validation.errors)
      }
      if (data.validation?.warnings?.length > 0) {
        console.warn(`⚠️  Validation warnings:`, data.validation.warnings)
      }
      
      return data.questions as ParsedQuestion[]
      
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('fetch') || 
                            error?.message?.includes('network') ||
                            error?.name === 'TypeError'
      
      if (isNetworkError && attempt < maxRetries && !error?.message?.includes('500')) {
        const delayMs = networkErrorDelays[attempt]
        console.warn(`⚠️  Network error. Retrying in ${delayMs / 1000}s...`)
        if (onProgress) onProgress(30 + attempt * 10, 'Retrying', 'Network error, retrying...')
        await delay(delayMs)
        continue
      }
      
      if (attempt === maxRetries) {
        console.error('❌ Error in PDF extraction:', error)
        if (onProgress) onProgress(0, 'Error', error.message)
        throw error
      }
    }
  }
  
  throw new Error('Failed to extract PDF after maximum retries')
}
