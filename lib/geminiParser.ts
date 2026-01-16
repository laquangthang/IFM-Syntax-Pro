// Gemini API calls are handled server-side via API route

// Type definitions
export interface QuestionOption {
  code: string | number
  label: string // Single string (Vietnamese only)
  codeType?: 'Normal' | 'Exclusive' | 'Trap' | 'Other' | 'Terminate' | 'string' | 'number'
}

export interface QuestionLogic {
  type?: 'Ask All' | 'Piping' | 'Normal'
  piping_source?: string | null // e.g., "Q8" or null
  terminate_if?: string | null
  ask_if_condition?: string | null // e.g., "IF (Q5R6 = 6 OR Q5R7 = 7)" - condition for ASK IF connections
}

export interface ParsedQuestion {
  id: string // Q1, Q2, Q3A, etc.
  type: 'SA' | 'MA' | 'SA_Grid' | 'MA_Grid' | 'Rank_Fixed' | 'Rank_Upto' | 'OE' | 'OE_Grid' | 'Numeric'
  instruction?: string // Original instruction text (Note, SCRIPT, etc.)
  label: string // Clean question text (Vietnamese only, single string)
  options?: QuestionOption[]
  rows?: QuestionOption[] // For Grid questions
  columns?: QuestionOption[] // For Grid questions (empty for OE_Grid)
  limit?: number // For Rank questions
  logic?: QuestionLogic
}

/**
 * List available models for diagnostic purposes
 */
export async function listAvailableModels(): Promise<void> {
  try {
    console.log('🔍 Gemini API Diagnostic:')
    console.log('API calls handled via server-side API route')
    console.log('Model: gemini-2.5-flash')
    console.log('Ready to parse PDF files')
  } catch (error) {
    console.error('Error in diagnostic:', error)
  }
}

/**
 * Check if error is a rate limit (429) error
 */
function isRateLimitError(response: Response): boolean {
  return response.status === 429
}

/**
 * Delay helper for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse Survey PDF using Gemini API via server-side API route
 * @param file - PDF file from input
 * @param onProgress - Optional progress callback (0-100)
 * @returns Array of parsed questions
 */
export async function parseSurveyPDF(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ParsedQuestion[]> {
  // Simulate progress during processing
  let progressInterval: NodeJS.Timeout | null = null
  if (onProgress) {
    let currentProgress = 0
    progressInterval = setInterval(() => {
      currentProgress += Math.random() * 10
      if (currentProgress > 90) currentProgress = 90 // Don't reach 100 until done
      onProgress(currentProgress)
    }, 300)
  }

  const maxRetries = 3
  // Longer delays for 429 errors: 10s, 20s, 40s (rate limits usually need more time)
  const rateLimitDelays = [10000, 20000, 40000]
  // Shorter delays for network/5xx errors: 2s, 4s, 8s
  const networkErrorDelays = [2000, 4000, 8000]

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Send PDF directly to Gemini API route (Gemini supports PDF natively)
      if (onProgress) onProgress(10)
      
      if (attempt === 0) {
        console.log(`📄 Processing PDF: ${file.name}`)
      } else {
        console.log(`🔄 Retrying... (Attempt ${attempt + 1}/${maxRetries + 1})`)
      }
      
      const formData = new FormData()
      formData.append('file', file)
      
      if (onProgress) onProgress(30)
      console.log('🔄 Calling parse-survey-gemini API...')
      
      const response = await fetch('/api/parse-survey-gemini', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Log debug info if available
        if (errorData.debug) {
          console.error('🔍 Debug Info from API:')
          console.error('Response Length:', errorData.debug.responseLength)
          console.error('Preview:', errorData.debug.preview)
          console.error('Last Chars:', errorData.debug.lastChars)
        }
        
        // Handle rate limit (429) with longer delays
        if (isRateLimitError(response)) {
          if (attempt < maxRetries) {
            const delayMs = rateLimitDelays[attempt]
            const delaySeconds = (delayMs / 1000).toFixed(0)
            
            console.warn(`⏳ Rate limit hit (429). Waiting ${delaySeconds}s before retry ${attempt + 1}/${maxRetries}...`)
            console.warn(`💡 Google API đang giới hạn số lượng request. Vui lòng đợi...`)
            
            if (onProgress) {
              // Show retry progress with indication of waiting
              onProgress(30 + attempt * 15)
            }
            
            await delay(delayMs)
            continue // Retry
          } else {
            // Max retries reached for rate limit
            throw new Error('Hệ thống Google đang bận. Đã thử lại nhiều lần nhưng vẫn gặp giới hạn. Vui lòng đợi 1-2 phút và thử lại.')
          }
        }
        
        // Handle server errors (5xx) with shorter delays
        if (response.status >= 500 && attempt < maxRetries) {
          const delayMs = networkErrorDelays[attempt]
          console.warn(`⚠️  Server error (${response.status}). Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`)
          
          if (onProgress) {
            onProgress(30 + attempt * 10)
          }
          
          await delay(delayMs)
          continue // Retry
        }
        
        // Non-retryable error or max retries reached
        throw new Error(errorData.error || `Failed to parse survey: ${response.statusText} (${response.status})`)
      }

      // Success! Clear progress interval
      if (progressInterval) clearInterval(progressInterval)
      if (onProgress) onProgress(100)

      const data = await response.json()
      
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format from API')
      }

      if (attempt > 0) {
        console.log(`✅ Successfully parsed after ${attempt + 1} attempts`)
      }
      console.log(`✅ Parsed ${data.questions.length} questions successfully`)
      return data.questions as ParsedQuestion[]
      
    } catch (error: any) {
      // Check if it's a network error (fetch failed completely)
      const isNetworkError = error?.message?.includes('fetch') || 
                            error?.message?.includes('network') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.name === 'TypeError'
      
      // Retry network errors (but not 429/500 which are handled above)
      if (isNetworkError && attempt < maxRetries && !error?.message?.includes('429') && !error?.message?.includes('500')) {
        const delayMs = networkErrorDelays[attempt]
        console.warn(`⚠️  Network error occurred. Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`)
        
        if (onProgress) {
          onProgress(30 + attempt * 10)
        }
        
        await delay(delayMs)
        continue // Retry
      }
      
      // Max retries reached or non-retryable error
      if (progressInterval) clearInterval(progressInterval)
      if (onProgress) onProgress(0)

      console.error('❌ Error parsing PDF:', error)
      console.error('   Attempt:', attempt + 1, 'of', maxRetries + 1)
      
      // Provide user-friendly error message
      if (error?.message) {
        throw error
      } else {
        throw new Error('Không thể parse PDF. Vui lòng kiểm tra file và thử lại.')
      }
    }
  }
  
  // Should not reach here, but TypeScript needs a return
  throw new Error('Failed to parse PDF after maximum retries')
}

/**
 * Parse Survey PDF using Structured Extraction + AI Refinement
 * More reliable approach: extract structure first, then refine with AI
 * @param file - PDF file from input
 * @param onProgress - Optional progress callback (0-100, phase, details)
 * @returns Array of parsed questions
 */
export async function parseSurveyPDFStructured(
  file: File,
  onProgress?: (progress: number, phase?: string, details?: string) => void
): Promise<ParsedQuestion[]> {
  const maxRetries = 3
  const rateLimitDelays = [10000, 20000, 40000]
  const networkErrorDelays = [2000, 4000, 8000]
  
  console.log(`\n📦 Starting Structured Extraction for: ${file.name}`)
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retrying structured extraction (Attempt ${attempt + 1}/${maxRetries + 1})...`)
      }
      
      if (onProgress) onProgress(5, 'Initializing', 'Preparing structured extraction...')
      
      const formData = new FormData()
      formData.append('file', file)
      
      if (onProgress) onProgress(10, 'Uploading', 'Sending PDF to server...')
      
      const response = await fetch('/api/parse-survey-structured', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Handle rate limit
        if (response.status === 429) {
          if (attempt < maxRetries) {
            const delayMs = rateLimitDelays[attempt]
            console.warn(`⏳ Rate limit hit. Waiting ${delayMs / 1000}s...`)
            if (onProgress) onProgress(30 + attempt * 15, 'Waiting', `Rate limit, retrying in ${delayMs / 1000}s...`)
            await delay(delayMs)
            continue
          } else {
            throw new Error('Rate limit exceeded after retries')
          }
        }
        
        // Handle server errors
        if (response.status >= 500 && attempt < maxRetries) {
          const delayMs = networkErrorDelays[attempt]
          console.warn(`⚠️  Server error. Retrying in ${delayMs / 1000}s...`)
          console.warn(`   Error details:`, errorData)
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
          stack: errorData.stack
        })
        
        const errorMessage = errorData.details 
          ? `${errorData.error || 'Failed to parse PDF'}: ${errorData.details}`
          : errorData.error || `Failed to parse PDF: ${response.statusText}`
        
        throw new Error(errorMessage)
      }
      
      if (onProgress) onProgress(90, 'Processing', 'Finalizing results...')
      
      const data = await response.json()
      
      if (!data.success || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format from structured API')
      }
      
      if (onProgress) onProgress(100, 'Complete', `Parsed ${data.questions.length} questions`)
      
      if (attempt > 0) {
        console.log(`✅ Successfully parsed after ${attempt + 1} attempts`)
      }
      
      console.log(`✅ Structured extraction complete: ${data.questions.length} questions`)
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
      
      if (isNetworkError && attempt < maxRetries && !error?.message?.includes('429') && !error?.message?.includes('500')) {
        const delayMs = networkErrorDelays[attempt]
        console.warn(`⚠️  Network error. Retrying in ${delayMs / 1000}s...`)
        if (onProgress) onProgress(30 + attempt * 10, 'Retrying', 'Network error, retrying...')
        await delay(delayMs)
        continue
      }
      
      if (attempt === maxRetries) {
        console.error('❌ Error in structured extraction:', error)
        if (onProgress) onProgress(0, 'Error', error.message)
        throw error
      }
    }
  }
  
  throw new Error('Failed to parse PDF using structured extraction after maximum retries')
}

/**
 * Parse Survey PDF using Chunked Approach
 * Divides PDF into chunks and parses each chunk separately, saving results incrementally
 * @param file - PDF file from input
 * @param onProgress - Optional progress callback (0-100, chunkIndex, totalChunks)
 * @param onChunkComplete - Optional callback when a chunk is completed (chunkIndex, questions)
 * @param questionsPerChunk - Number of questions to parse per chunk (default: 10)
 * @returns Array of all parsed questions
 */
export async function parseSurveyPDFChunked(
  file: File,
  onProgress?: (progress: number, chunkIndex?: number, totalChunks?: number) => void,
  onChunkComplete?: (chunkIndex: number, questions: ParsedQuestion[], totalParsed: number) => void,
  questionsPerChunk: number = 10
): Promise<ParsedQuestion[]> {
  const maxRetries = 3
  const rateLimitDelays = [10000, 20000, 40000]
  const networkErrorDelays = [2000, 4000, 8000]
  
  // Estimate total chunks (assume max 100 questions, can be adjusted)
  const estimatedTotalChunks = Math.ceil(100 / questionsPerChunk)
  let allQuestions: ParsedQuestion[] = []
  
  console.log(`\n📦 Starting Chunked PDF Parsing`)
  console.log(`   File: ${file.name}`)
  console.log(`   Questions per chunk: ${questionsPerChunk}`)
  console.log(`   Estimated chunks: ${estimatedTotalChunks}`)
  
  // Parse chunks sequentially
  let chunkIndex = 0
  let hasMoreChunks = true
  let consecutiveEmptyChunks = 0
  const maxEmptyChunks = 2 // Stop if 2 consecutive chunks return no questions
  
  while (hasMoreChunks && consecutiveEmptyChunks < maxEmptyChunks) {
    const totalChunks = estimatedTotalChunks // Will be updated as we go
    
    if (onProgress) {
      const chunkProgress = (chunkIndex / totalChunks) * 100
      onProgress(chunkProgress, chunkIndex, totalChunks)
    }
    
    console.log(`\n📦 Processing Chunk ${chunkIndex + 1}...`)
    
    let chunkQuestions: ParsedQuestion[] = []
    let chunkSuccess = false
    
    // Retry logic for each chunk
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`   🔄 Retrying chunk ${chunkIndex + 1} (Attempt ${attempt + 1}/${maxRetries + 1})...`)
        }
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('chunkIndex', chunkIndex.toString())
        formData.append('totalChunks', totalChunks.toString())
        formData.append('questionsPerChunk', questionsPerChunk.toString())
        
        // Include previous questions for context (last 10 for piping references)
        if (allQuestions.length > 0) {
          const contextQuestions = allQuestions.slice(-10)
          formData.append('previousQuestions', JSON.stringify(contextQuestions))
        }
        
        const response = await fetch('/api/parse-survey-gemini-chunked', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          // Handle rate limit
          if (isRateLimitError(response)) {
            if (attempt < maxRetries) {
              const delayMs = rateLimitDelays[attempt]
              console.warn(`   ⏳ Rate limit hit. Waiting ${delayMs / 1000}s...`)
              await delay(delayMs)
              continue
            } else {
              throw new Error('Rate limit exceeded after retries')
            }
          }
          
          // Handle server errors
          if (response.status >= 500 && attempt < maxRetries) {
            const delayMs = networkErrorDelays[attempt]
            console.warn(`   ⚠️  Server error. Retrying in ${delayMs / 1000}s...`)
            await delay(delayMs)
            continue
          }
          
          throw new Error(errorData.error || `Failed to parse chunk: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (!data.success || !Array.isArray(data.questions)) {
          throw new Error('Invalid response format from chunked API')
        }
        
        chunkQuestions = data.questions as ParsedQuestion[]
        chunkSuccess = true
        
        // Log validation errors if any
        if (data.validationErrors && data.validationErrors.length > 0) {
          console.warn(`   ⚠️  Validation warnings:`, data.validationErrors)
        }
        
        break // Success, exit retry loop
        
      } catch (error: any) {
        const isNetworkError = error?.message?.includes('fetch') || 
                              error?.message?.includes('network') ||
                              error?.name === 'TypeError'
        
        if (isNetworkError && attempt < maxRetries && !error?.message?.includes('429') && !error?.message?.includes('500')) {
          const delayMs = networkErrorDelays[attempt]
          console.warn(`   ⚠️  Network error. Retrying in ${delayMs / 1000}s...`)
          await delay(delayMs)
          continue
        }
        
        if (attempt === maxRetries) {
          console.error(`   ❌ Failed to parse chunk ${chunkIndex + 1} after ${maxRetries + 1} attempts`)
          throw error
        }
      }
    }
    
    if (!chunkSuccess) {
      throw new Error(`Failed to parse chunk ${chunkIndex + 1}`)
    }
    
    // Check if chunk returned questions
    if (chunkQuestions.length === 0) {
      consecutiveEmptyChunks++
      console.log(`   ℹ️  Chunk ${chunkIndex + 1} returned no questions (empty chunk ${consecutiveEmptyChunks}/${maxEmptyChunks})`)
      
      if (consecutiveEmptyChunks >= maxEmptyChunks) {
        console.log(`   ✅ No more questions found. Stopping chunked parsing.`)
        hasMoreChunks = false
        break
      }
    } else {
      consecutiveEmptyChunks = 0 // Reset counter
      
      // Merge questions (avoid duplicates)
      const existingIds = new Set(allQuestions.map(q => q.id))
      const newQuestions = chunkQuestions.filter(q => !existingIds.has(q.id))
      
      allQuestions = [...allQuestions, ...newQuestions]
      
      console.log(`   ✅ Chunk ${chunkIndex + 1} completed: ${chunkQuestions.length} questions (${newQuestions.length} new, ${chunkQuestions.length - newQuestions.length} duplicates skipped)`)
      console.log(`   📊 Total parsed so far: ${allQuestions.length} questions`)
      
      // Call chunk complete callback
      if (onChunkComplete) {
        onChunkComplete(chunkIndex, newQuestions, allQuestions.length)
      }
      
      // If chunk returned fewer questions than expected, might be near the end
      if (chunkQuestions.length < questionsPerChunk) {
        console.log(`   ℹ️  Chunk returned fewer questions than expected. May be near end of survey.`)
        // Continue one more chunk to be sure
      }
    }
    
    chunkIndex++
    
    // Safety limit: don't parse more than 200 questions total (20 chunks * 10 questions)
    if (chunkIndex >= 20) {
      console.log(`   ⚠️  Reached safety limit of 20 chunks. Stopping.`)
      hasMoreChunks = false
    }
  }
  
  console.log(`\n✅ Chunked Parsing Complete!`)
  console.log(`   Total chunks processed: ${chunkIndex}`)
  console.log(`   Total questions parsed: ${allQuestions.length}`)
  
  if (onProgress) {
    onProgress(100, chunkIndex, chunkIndex)
  }
  
  return allQuestions
}
