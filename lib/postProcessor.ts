/**
 * Post-Processing Service
 * Resolves dependencies, merges questions, and validates consistency
 */

import { ParsedQuestion } from './geminiParser'

/**
 * Resolve piping dependencies
 * For questions with piping_source, copy options from source question
 */
export function resolvePipingDependencies(questions: ParsedQuestion[]): ParsedQuestion[] {
  const questionMap = new Map<string, ParsedQuestion>()
  
  // First pass: build map
  questions.forEach(q => {
    questionMap.set(q.id, { ...q })
  })
  
  // Second pass: resolve piping
  const resolved: ParsedQuestion[] = []
  
  for (const question of questions) {
    const resolvedQuestion = { ...question }
    
    // Check if this question has piping
    if (resolvedQuestion.logic?.piping_source) {
      const sourceId = resolvedQuestion.logic.piping_source
      const sourceQuestion = questionMap.get(sourceId)
      
      if (sourceQuestion && sourceQuestion.options) {
        // Copy options from source
        resolvedQuestion.options = sourceQuestion.options.map(opt => ({
          ...opt,
        }))
        
        console.log(`   ✅ Resolved piping: ${question.id} → ${sourceId} (${resolvedQuestion.options.length} options)`)
      } else {
        console.warn(`   ⚠️  Piping source ${sourceId} not found for ${question.id}`)
      }
    }
    
    resolved.push(resolvedQuestion)
  }
  
  return resolved
}

/**
 * Validate question consistency
 */
export function validateQuestions(questions: ParsedQuestion[]): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const questionIds = new Set<string>()
  
  questions.forEach((q, index) => {
    // Check for duplicate IDs
    if (questionIds.has(q.id)) {
      errors.push(`Duplicate question ID: ${q.id}`)
    } else {
      questionIds.add(q.id)
    }
    
    // Check required fields
    if (!q.type) {
      errors.push(`Question ${q.id} missing type`)
    }
    
    if (!q.label || q.label.trim().length === 0) {
      warnings.push(`Question ${q.id} has empty label`)
    }
    
    // Check options for SA/MA questions
    if ((q.type === 'SA' || q.type === 'MA') && (!q.options || q.options.length === 0)) {
      warnings.push(`Question ${q.id} (${q.type}) has no options`)
    }
    
    // Check rows/columns for Grid questions
    if ((q.type === 'SA_Grid' || q.type === 'MA_Grid') && (!q.rows || q.rows.length === 0)) {
      warnings.push(`Question ${q.id} (${q.type}) has no rows`)
    }
    
    // Check piping source exists
    if (q.logic?.piping_source) {
      const sourceId = q.logic.piping_source
      const sourceExists = questions.some(q2 => q2.id === sourceId)
      if (!sourceExists) {
        errors.push(`Question ${q.id} references non-existent piping source: ${sourceId}`)
      }
    }
    
    // Check ask_if_condition references
    if (q.logic?.ask_if_condition) {
      const condition = q.logic.ask_if_condition
      // Extract question IDs from condition (e.g., "IF (Q5R6 = 6)" → Q5)
      const questionRefs = condition.match(/Q\d+[A-Z]?/g) || []
      questionRefs.forEach(ref => {
        const refExists = questions.some(q2 => q2.id === ref)
        if (!refExists) {
          warnings.push(`Question ${q.id} references non-existent question in ask_if: ${ref}`)
        }
      })
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Sort questions by ID
 */
export function sortQuestions(questions: ParsedQuestion[]): ParsedQuestion[] {
  return [...questions].sort((a, b) => {
    // Extract numeric part
    const aNum = parseInt(a.id.replace(/\D/g, '')) || 0
    const bNum = parseInt(b.id.replace(/\D/g, '')) || 0
    if (aNum !== bNum) return aNum - bNum
    return a.id.localeCompare(b.id)
  })
}

/**
 * Main post-processing function
 */
export function postProcessQuestions(questions: ParsedQuestion[]): {
  questions: ParsedQuestion[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
} {
  console.log(`\n🔧 Post-processing ${questions.length} questions...`)
  
  // Step 1: Sort
  const sorted = sortQuestions(questions)
  console.log(`   ✅ Sorted questions`)
  
  // Step 2: Resolve dependencies
  const resolved = resolvePipingDependencies(sorted)
  console.log(`   ✅ Resolved dependencies`)
  
  // Step 3: Validate
  const validation = validateQuestions(resolved)
  console.log(`   ✅ Validation: ${validation.errors.length} errors, ${validation.warnings.length} warnings`)
  
  return {
    questions: resolved,
    validation,
  }
}
