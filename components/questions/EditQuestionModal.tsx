'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ParsedQuestion, QuestionOption, QuestionLogic } from '@/lib/geminiParser'
import { X, Plus, Trash2, Save, Type, FileText, List, Grid, Zap, Code2 } from 'lucide-react'
import { useSurveyStore } from '@/store/surveyStore'
import { getVariableCountForQuestion } from '@/lib/variableCountHelper'
import { convertTerminateCondition } from '@/lib/qcSyntaxGeneratorFromJSON'

interface EditQuestionModalProps {
  question: ParsedQuestion
  isOpen: boolean
  onClose: () => void
  onSave: (updatedQuestion: ParsedQuestion) => void
}

const QUESTION_TYPES = ['SA', 'MA', 'SA_Grid', 'MA_Grid', 'Rank_Fixed', 'Rank_Upto', 'OE', 'OE_Grid', 'Numeric'] as const
const CODE_TYPES = ['Normal', 'Exclusive', 'Trap', 'Other', 'Terminate'] as const
const LOGIC_TYPES = ['Normal', 'Ask All', 'Piping'] as const

const LOGIC_OPERATORS = [
  { value: 'is_exactly_equal', label: 'is exactly equal to' },
  { value: 'is_not_exactly_equal', label: 'is not exactly equal to' },
  { value: 'is_one_of', label: 'is one of the following answers' },
  { value: 'is_not_one_of', label: 'is not one of the following answers' },
  { value: 'is_answered', label: 'is answered' },
  { value: 'is_not_answered', label: 'is not answered' },
] as const

export default function EditQuestionModal({ question, isOpen, onClose, onSave }: EditQuestionModalProps) {
  const { oldVariableMapping, setQuestionOldVariables, parsedQuestions } = useSurveyStore()
  const [editedQuestion, setEditedQuestion] = useState<ParsedQuestion>(question)
  const [newOptionCode, setNewOptionCode] = useState<string>('')
  const [newOptionLabel, setNewOptionLabel] = useState<string>('')
  const [newOptionCodeType, setNewOptionCodeType] = useState<QuestionOption['codeType']>('Normal')
  const [oldVariablesText, setOldVariablesText] = useState<string>('')
  
  // Ask If state - support multiple conditions with AND/OR
  interface AskIfCondition {
    id: string // Unique ID for this condition
    source: string
    operator: string
    selectedCodes: Set<string | number>
  }
  const [askIfConditions, setAskIfConditions] = useState<AskIfCondition[]>([])
  const [askIfConnectors, setAskIfConnectors] = useState<('AND' | 'OR')[]>([]) // Connectors between conditions (length = conditions.length - 1)

  // Terminate If state - similar structure to Ask If
  interface TerminateIfCondition {
    id: string
    source: string
    operator: string
    selectedCodes: Set<string | number>
  }
  const [terminateIfConditions, setTerminateIfConditions] = useState<TerminateIfCondition[]>([])
  const [terminateIfConnectors, setTerminateIfConnectors] = useState<('AND' | 'OR')[]>([])

  // Piping Source state - with operator
  const [pipingOperator, setPipingOperator] = useState<string>('is_exactly_equal')

  /**
   * Split a condition string by top-level AND/OR connectors only.
   * IMPORTANT: Do not split on lowercase "or" inside a single condition
   * (e.g. "Q1 = 1 or Q1 = 2"), otherwise reopening the modal will create
   * extra UI conditions.
   */
  const splitByTopLevelConnectors = (raw: string): { conditionParts: string[]; connectors: ('AND' | 'OR')[] } => {
    const s = raw.replace(/\s+/g, ' ').trim()
    const conditionParts: string[] = []
    const connectors: ('AND' | 'OR')[] = []

    let buf = ''
    let depth = 0

    for (let i = 0; i < s.length; i++) {
      const ch = s[i]

      if (ch === '(') depth++
      if (ch === ')' && depth > 0) depth--

      // Only treat AND/OR as connectors at top-level and in uppercase form
      if (depth === 0) {
        if (s.slice(i, i + 5) === ' AND ') {
          if (buf.trim()) conditionParts.push(buf.trim())
          connectors.push('AND')
          buf = ''
          i += 4
          continue
        }
        if (s.slice(i, i + 4) === ' OR ') {
          if (buf.trim()) conditionParts.push(buf.trim())
          connectors.push('OR')
          buf = ''
          i += 3
          continue
        }
      }

      buf += ch
    }

    if (buf.trim()) conditionParts.push(buf.trim())
    return { conditionParts, connectors }
  }

  // Parse existing terminate_if condition to populate state
  const parseTerminateIfCondition = (condition: string | null | undefined) => {
    if (!condition) {
      setTerminateIfConditions([])
      setTerminateIfConnectors([])
      return
    }

    // For terminate_if, handle special case: multiple mis() calls with same source should be merged
    // Example: "mis(Q1R1) and mis(Q1R2)" should be 1 condition with codes [1, 2], not 2 separate conditions
    const cleanCondition = condition.replace(/^IF\s+/i, '').trim()
    
    // Check if this is a pattern like "mis(Q1R1) and mis(Q1R2) and mis(Q1R3)" - all same source
    const allMisPattern = /^mis\(Q(\d+)R(\d+)\)(?:\s+and\s+mis\(Q\1R(\d+)\))*$/i
    const misMatches = cleanCondition.match(/mis\(Q(\d+)R(\d+)\)/gi)
    
    if (misMatches && misMatches.length > 1) {
      // Check if all mis() calls are for the same source question
      const firstMatch = misMatches[0].match(/mis\(Q(\d+)/i)
      if (firstMatch) {
        const sourceId = `Q${firstMatch[1]}`
        const allSameSource = misMatches.every(m => m.includes(`Q${firstMatch[1]}`))
        
        if (allSameSource) {
          // Merge all codes into one condition
          const sourceQuestion = parsedQuestions.find(q => q.id === sourceId)
          const codes = new Set<string | number>()
          
          const normalizeCode = (codeStr: string): string | number => {
            if (!sourceQuestion) return Number(codeStr)
            const options = sourceQuestion.options || sourceQuestion.rows || []
            if (options.length > 0) {
              const firstOptionCode = options[0].code
              return typeof firstOptionCode === 'string' ? codeStr : Number(codeStr)
            }
            return Number(codeStr)
          }
          
          misMatches.forEach(match => {
            const codeMatch = match.match(/mis\(Q\d+R(\d+)\)/i)
            if (codeMatch) {
              codes.add(normalizeCode(codeMatch[1]))
            }
          })
          
          if (codes.size > 0) {
            setTerminateIfConditions([{
              id: `term_cond_${Date.now()}`,
              source: sourceId,
              operator: 'is_not_one_of',
              selectedCodes: codes,
            }])
            setTerminateIfConnectors([])
            return
          }
        }
      }
    }
    
    // Fallback to original parsing logic for other cases
    const { conditionParts, connectors } = splitByTopLevelConnectors(cleanCondition)
    
    const conditions: TerminateIfCondition[] = []
    
    for (let i = 0; i < conditionParts.length; i++) {
      const part = conditionParts[i].trim()
      const cleanPart = part.replace(/^\(|\)$/g, '')
      const sourceMatch = cleanPart.match(/Q\d+/i)
      const sourceId = sourceMatch ? sourceMatch[0] : ''
      
      if (!sourceId) continue
      
      let operator = 'is_exactly_equal'
      if (cleanPart.includes('mis(')) {
        operator = 'is_not_one_of'
      } else if (cleanPart.includes('NOT')) {
        operator = 'is_not_one_of'
      } else if (cleanPart.includes('or') || cleanPart.includes('OR')) {
        operator = 'is_one_of'
      } else if (cleanPart.includes('IS NOT MISSING')) {
        operator = 'is_answered'
      } else if (cleanPart.includes('IS MISSING')) {
        operator = 'is_not_answered'
      }
      
      const codes = new Set<string | number>()
      const sourceQuestion = parsedQuestions.find(q => q.id === sourceId)
      const isMatrixMA = sourceQuestion && 
                        (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'MA') && 
                        sourceQuestion.rows && sourceQuestion.rows.length > 0 && 
                        sourceQuestion.columns && sourceQuestion.columns.length > 0
      
      // Helper to normalize code type to match sourceQuestion option.code type
      const normalizeCode = (codeStr: string): string | number => {
        if (!sourceQuestion) return Number(codeStr)
        const options = sourceQuestion.options || sourceQuestion.rows || []
        if (options.length > 0) {
          const firstOptionCode = options[0].code
          // If first option code is string, keep as string; otherwise convert to number
          return typeof firstOptionCode === 'string' ? codeStr : Number(codeStr)
        }
        return Number(codeStr)
      }

      if (operator === 'is_not_one_of' && cleanPart.includes('mis(')) {
        if (isMatrixMA) {
          const misMatches = cleanPart.match(/mis\(Q\d+_(\d+)R(\d+)\)/g)
          if (misMatches) {
            misMatches.forEach(match => {
              const codeMatch = match.match(/mis\(Q\d+_(\d+)R(\d+)\)/)
              if (codeMatch) {
                const [, colCode, rowCode] = codeMatch
                codes.add(`R${rowCode}C${colCode}`)
              }
            })
          }
        }
        if (codes.size === 0) {
          const misMatches = cleanPart.match(/mis\(Q\d+R?(\d+)\)/g)
          if (misMatches) {
            misMatches.forEach(match => {
              const codeMatch = match.match(/mis\(Q\d+R?(\d+)\)/)
              if (codeMatch) {
                codes.add(normalizeCode(codeMatch[1]))
              }
            })
          }
        }
      } else if (operator !== 'is_answered' && operator !== 'is_not_answered') {
        if (isMatrixMA) {
          const gridMatches = cleanPart.match(/Q\d+_(\d+)R(\d+)\s*=\s*\d+/g)
          if (gridMatches) {
            gridMatches.forEach(match => {
              const codeMatch = match.match(/Q\d+_(\d+)R(\d+)\s*=\s*\d+/)
              if (codeMatch) {
                const [, colCode, rowCode] = codeMatch
                codes.add(`R${rowCode}C${colCode}`)
              }
            })
          }
        }
        if (codes.size === 0) {
          const codeMatches = cleanPart.match(/(?:Q\d+R)?(\d+)\s*=\s*\d+/g)
          if (codeMatches) {
            codeMatches.forEach(match => {
              const codeMatch = match.match(/(\d+)\s*=\s*\d+/)
              if (codeMatch) {
                codes.add(normalizeCode(codeMatch[1]))
              }
            })
          }
        }
      }
      
      conditions.push({
        id: `term_cond_${Date.now()}_${i}`,
        source: sourceId,
        operator,
        selectedCodes: codes,
      })
    }
    
    setTerminateIfConditions(conditions)
    setTerminateIfConnectors(connectors)
  }

  // Generate terminate_if condition string from multiple conditions
  const generateTerminateIfConditionFromMultiple = (conditions: TerminateIfCondition[], connectors: ('AND' | 'OR')[]): string | null => {
    if (conditions.length === 0) return null
    
    const conditionStrings: string[] = []
    
    conditions.forEach((cond, index) => {
      const sourceQuestion = parsedQuestions.find(q => q.id === cond.source)
      const condStr = generateSingleCondition(cond.source, cond.operator, cond.selectedCodes, sourceQuestion)
      if (condStr) {
        conditionStrings.push(condStr)
        
        if (index < conditions.length - 1) {
          const connector = connectors[index] || 'AND'
          conditionStrings.push(connector)
        }
      }
    })
    
    if (conditionStrings.length === 0) return null
    
    return conditionStrings.join(' ')
  }

  // Parse existing ask_if_condition to populate state (support multiple conditions with AND/OR)
  const parseAskIfCondition = (condition: string | null | undefined) => {
    if (!condition) {
      setAskIfConditions([])
      setAskIfConnectors([])
      return
    }

    // Split by AND/OR (case insensitive)
    // Pattern: "IF (condition1) AND (condition2) OR (condition3)"
    const { conditionParts, connectors } = splitByTopLevelConnectors(condition.replace(/^IF\s+/i, ''))
    
    const conditions: AskIfCondition[] = []
    
    for (let i = 0; i < conditionParts.length; i++) {
      const part = conditionParts[i].trim()
      // This is a condition - parse it
      const cleanPart = part.replace(/^\(|\)$/g, '') // Remove outer parentheses
      
      // Extract source question ID
      const sourceMatch = cleanPart.match(/Q\d+/i)
      const sourceId = sourceMatch ? sourceMatch[0] : ''
      
      if (!sourceId) continue
      
      // Determine operator
      let operator = 'is_exactly_equal'
      if (cleanPart.includes('mis(')) {
        operator = 'is_not_one_of'
      } else if (cleanPart.includes('NOT')) {
        operator = 'is_not_one_of'
      } else if (cleanPart.includes('or') || cleanPart.includes('OR')) {
        operator = 'is_one_of'
      } else if (cleanPart.includes('IS NOT MISSING')) {
        operator = 'is_answered'
      } else if (cleanPart.includes('IS MISSING')) {
        operator = 'is_not_answered'
      }
      
      // Extract codes - handle both regular and MA_Grid format
      const codes = new Set<string | number>()
      const sourceQuestion = parsedQuestions.find(q => q.id === sourceId)
      const isMatrixMA = sourceQuestion && 
                        (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'MA') && 
                        sourceQuestion.rows && sourceQuestion.rows.length > 0 && 
                        sourceQuestion.columns && sourceQuestion.columns.length > 0
      
      // Helper to normalize code type to match sourceQuestion option.code type
      const normalizeCode = (codeStr: string): string | number => {
        if (!sourceQuestion) return Number(codeStr)
        const options = sourceQuestion.options || sourceQuestion.rows || []
        if (options.length > 0) {
          const firstOptionCode = options[0].code
          // If first option code is string, keep as string; otherwise convert to number
          return typeof firstOptionCode === 'string' ? codeStr : Number(codeStr)
        }
        return Number(codeStr)
      }

      if (operator === 'is_not_one_of' && cleanPart.includes('mis(')) {
        // Handle MA_Grid format: mis(Q7_1R1) -> R1C1
        if (isMatrixMA) {
          const misMatches = cleanPart.match(/mis\(Q\d+_(\d+)R(\d+)\)/g)
          if (misMatches) {
            misMatches.forEach(match => {
              const codeMatch = match.match(/mis\(Q\d+_(\d+)R(\d+)\)/)
              if (codeMatch) {
                const [, colCode, rowCode] = codeMatch
                codes.add(`R${rowCode}C${colCode}`)
              }
            })
          }
        }
        // Handle regular format: mis(Q5R6) -> 6
        if (codes.size === 0) {
          const misMatches = cleanPart.match(/mis\(Q\d+R?(\d+)\)/g)
          if (misMatches) {
            misMatches.forEach(match => {
              const codeMatch = match.match(/mis\(Q\d+R?(\d+)\)/)
              if (codeMatch) {
                codes.add(normalizeCode(codeMatch[1]))
              }
            })
          }
        }
      } else if (operator !== 'is_answered' && operator !== 'is_not_answered') {
        // Handle MA_Grid format: Q7_1R1 = 1 -> R1C1
        if (isMatrixMA) {
          const gridMatches = cleanPart.match(/Q\d+_(\d+)R(\d+)\s*=\s*\d+/g)
          if (gridMatches) {
            gridMatches.forEach(match => {
              const codeMatch = match.match(/Q\d+_(\d+)R(\d+)\s*=\s*\d+/)
              if (codeMatch) {
                const [, colCode, rowCode] = codeMatch
                codes.add(`R${rowCode}C${colCode}`)
              }
            })
          }
        }
        // Handle regular format: Q5R6 = 6 -> 6
        if (codes.size === 0) {
          const codeMatches = cleanPart.match(/(?:Q\d+R)?(\d+)\s*=\s*\d+/g)
          if (codeMatches) {
            codeMatches.forEach(match => {
              const codeMatch = match.match(/(\d+)\s*=\s*\d+/)
              if (codeMatch) {
                codes.add(normalizeCode(codeMatch[1]))
              }
            })
          }
        }
      }
      
      conditions.push({
        id: `cond_${Date.now()}_${i}`,
        source: sourceId,
        operator,
        selectedCodes: codes,
      })
    }
    
    setAskIfConditions(conditions)
    setAskIfConnectors(connectors)
    
    // Set piping_source to first condition's source (for backward compatibility)
    if (conditions.length > 0 && !editedQuestion.logic?.piping_source) {
      updateLogic('piping_source', conditions[0].source)
    }
  }

  // Generate single condition string
  const generateSingleCondition = (sourceId: string, operator: string, selectedCodes: Set<string | number>, sourceQuestion?: ParsedQuestion): string | null => {
    if (!sourceId || !operator) {
      return null
    }

    // Check if this is a Matrix MA question
    const isMatrixMA = sourceQuestion && 
                      (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'MA') && 
                      sourceQuestion.rows && sourceQuestion.rows.length > 0 && 
                      sourceQuestion.columns && sourceQuestion.columns.length > 0

    const isMA = sourceQuestion?.type === 'MA' || sourceQuestion?.type === 'MA_Grid'
    const codesArray = Array.from(selectedCodes)

    // Helper to convert composite key "R{rowCode}C{columnCode}" to variable format
    const convertMatrixKey = (key: string | number): string => {
      const keyStr = String(key)
      const match = keyStr.match(/^R(\d+)C(\d+)$/)
      if (match) {
        const [, rowCode, colCode] = match
        return `${sourceId}_${colCode}R${rowCode} = ${rowCode}`
      }
      // Fallback for regular codes
      return isMA ? `${sourceId}R${key} = ${key}` : `${sourceId} = ${key}`
    }

    // Helper to convert composite key to MIS format
    const convertMatrixKeyToMIS = (key: string | number): string => {
      const keyStr = String(key)
      const match = keyStr.match(/^R(\d+)C(\d+)$/)
      if (match) {
        const [, rowCode, colCode] = match
        return `mis(${sourceId}_${colCode}R${rowCode})`
      }
      // Fallback for regular codes
      return isMA ? `mis(${sourceId}R${key})` : `mis(${sourceId})`
    }

    if (operator === 'is_exactly_equal' && codesArray.length === 1) {
      const code = codesArray[0]
      if (isMatrixMA && String(code).match(/^R\d+C\d+$/)) {
        return `(${convertMatrixKey(code)})`
      }
      return isMA ? `(${sourceId}R${code} = ${code})` : `${sourceId} = ${code}`
    } else if (operator === 'is_not_exactly_equal' && codesArray.length === 1) {
      const code = codesArray[0]
      if (isMatrixMA && String(code).match(/^R\d+C\d+$/)) {
        return `NOT(${convertMatrixKey(code)})`
      }
      return isMA ? `NOT(${sourceId}R${code} = ${code})` : `NOT(${sourceId} = ${code})`
    } else if (operator === 'is_one_of') {
      if (codesArray.length === 0) return null
      const conditions = codesArray.map(code => {
        if (isMatrixMA && String(code).match(/^R\d+C\d+$/)) {
          return convertMatrixKey(code)
        }
        return isMA ? `${sourceId}R${code} = ${code}` : `${sourceId} = ${code}`
      }).join(' or ')
      return isMA || isMatrixMA ? `(${conditions})` : conditions
    } else if (operator === 'is_not_one_of') {
      // For "is not one of", use missing format: mis(Q5R6) and mis(Q5R7) ...
      if (codesArray.length === 0) return null
      const conditions = codesArray.map(code => {
        if (isMatrixMA && String(code).match(/^R\d+C\d+$/)) {
          return convertMatrixKeyToMIS(code)
        }
        return isMA ? `mis(${sourceId}R${code})` : `mis(${sourceId})`
      }).join(' and ')
      return conditions
    } else if (operator === 'is_answered') {
      return `${sourceId} IS NOT MISSING`
    } else if (operator === 'is_not_answered') {
      return `${sourceId} IS MISSING`
    }

    return null
  }

  // Generate ask_if_condition string from multiple conditions with AND/OR
  const generateAskIfConditionFromMultiple = (conditions: AskIfCondition[], connectors: ('AND' | 'OR')[]): string | null => {
    if (conditions.length === 0) return null
    
    const conditionStrings: string[] = []
    
    conditions.forEach((cond, index) => {
      const sourceQuestion = parsedQuestions.find(q => q.id === cond.source)
      const condStr = generateSingleCondition(cond.source, cond.operator, cond.selectedCodes, sourceQuestion)
      if (condStr) {
        conditionStrings.push(condStr)
        
        // Add connector if not last condition
        if (index < conditions.length - 1) {
          const connector = connectors[index] || 'AND' // Default to AND if missing
          conditionStrings.push(connector)
        }
      }
    })
    
    if (conditionStrings.length === 0) return null
    
    return `IF ${conditionStrings.join(' ')}`
  }

  // Reset form when question changes
  useEffect(() => {
    if (isOpen) {
      // Convert terminate_if to display format when loading question
      const questionToLoad = { ...question }
      if (questionToLoad.logic?.terminate_if) {
        const converted = convertTerminateCondition(
          questionToLoad.logic.terminate_if,
          questionToLoad.id,
          questionToLoad.type
        )
        if (converted) {
          questionToLoad.logic = {
            ...questionToLoad.logic,
            terminate_if: converted
          }
        }
      }
      
      // Auto-sync from piping source
      if (questionToLoad.logic?.piping_source) {
        const sourceQuestion = parsedQuestions.find(q => q.id === questionToLoad.logic?.piping_source)
        if (sourceQuestion) {
          // If source question is a Grid question, use its ROWS as piping source
          const isSourceGrid = sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid'
          
          if (isSourceGrid && sourceQuestion.rows && sourceQuestion.rows.length > 0) {
            // Source is Grid → use rows from source
            if (questionToLoad.type === 'MA_Grid' || questionToLoad.type === 'SA_Grid') {
              // Target is also Grid → sync rows from source as columns
              questionToLoad.columns = [...sourceQuestion.rows]
            } else if (questionToLoad.type === 'MA') {
              // Target is MA → use source rows as options
              questionToLoad.options = [...sourceQuestion.rows]
            }
          }
          // If source is regular MA question, use its options
          else if (sourceQuestion.type === 'MA' && sourceQuestion.options && sourceQuestion.options.length > 0) {
            if (questionToLoad.type === 'MA_Grid' || questionToLoad.type === 'SA_Grid') {
              // Target is Grid → use source options as columns
              questionToLoad.columns = [...sourceQuestion.options]
            } else if (questionToLoad.type === 'MA') {
              // Target is MA → sync options
              questionToLoad.options = [...sourceQuestion.options]
            }
          }
        }
      }
      
      setEditedQuestion(questionToLoad)
      setNewOptionCode('')
      setNewOptionLabel('')
      setNewOptionCodeType('Normal')
      
      // Load existing old variables
      const existingVars = oldVariableMapping[question.id] || []
      setOldVariablesText(existingVars.join('\n'))

      // Parse existing ask_if_condition
      parseAskIfCondition(question.logic?.ask_if_condition)
      
      // Parse existing terminate_if condition
      parseTerminateIfCondition(question.logic?.terminate_if)
      
      // Initialize piping operator (default to is_exactly_equal)
      setPipingOperator('is_exactly_equal')
    }
  }, [question, isOpen, oldVariableMapping, parsedQuestions])
  
  // Additional effect to sync columns when parsedQuestions changes (e.g., Q7 data becomes available)
  // This ensures columns are synced even if source question data loads after modal opens
  useEffect(() => {
    if (isOpen && editedQuestion.logic?.piping_source && (editedQuestion.type === 'MA_Grid' || editedQuestion.type === 'SA_Grid')) {
      const sourceQuestion = parsedQuestions.find(q => q.id === editedQuestion.logic?.piping_source)
      if (sourceQuestion) {
        const isSourceGrid = sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid'
        
        if (isSourceGrid && sourceQuestion.rows && sourceQuestion.rows.length > 0) {
          // Always sync columns from source rows when piping is active
          // This ensures columns are up-to-date even if question had old Excel data
          const sourceRows = sourceQuestion.rows
          
          // Use functional update to check current state and sync if needed
          setEditedQuestion(prev => {
            const currentColumns = prev.columns || []
            
            // Check if sync is needed (different length or different content)
            const needsSync = currentColumns.length !== sourceRows.length || 
              currentColumns.some((col, idx) => {
                const sourceRow = sourceRows[idx]
                return !sourceRow || col.code !== sourceRow.code || col.label !== sourceRow.label
              })
            
            if (needsSync) {
              // Force sync columns from source rows
              return {
                ...prev,
                columns: [...sourceRows]
              }
            }
            
            return prev
          })
        }
      }
    }
  }, [isOpen, editedQuestion.logic?.piping_source, editedQuestion.type, parsedQuestions])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return

    // Save current scroll position
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    
    // Save original styles
    const originalBodyStyle = {
      position: document.body.style.position || '',
      top: document.body.style.top || '',
      width: document.body.style.width || '',
      overflow: document.body.style.overflow || '',
      paddingRight: document.body.style.paddingRight || '',
    }
    const originalHtmlOverflow = document.documentElement.style.overflow || ''

    // Lock body scroll
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.documentElement.style.overflow = 'hidden'

    return () => {
      // Restore body/html styles
      document.body.style.position = originalBodyStyle.position
      document.body.style.top = originalBodyStyle.top
      document.body.style.width = originalBodyStyle.width
      document.body.style.overflow = originalBodyStyle.overflow
      document.body.style.paddingRight = originalBodyStyle.paddingRight
      document.documentElement.style.overflow = originalHtmlOverflow

      // Restore window scroll position
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    }
  }, [isOpen])

  const handleSave = () => {
    // Parse old variables from text (one per line)
    const oldVars = oldVariablesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    // Generate ask_if_condition from multiple conditions before saving
    const fullCondition = generateAskIfConditionFromMultiple(askIfConditions, askIfConnectors)
    
    // Generate terminate_if condition from multiple conditions before saving
    const fullTerminateCondition = generateTerminateIfConditionFromMultiple(terminateIfConditions, terminateIfConnectors)
    
    // Build final question object with all updates applied synchronously
    // Use current editedQuestion state directly (not in setState callback to avoid render-phase updates)
    const currentQuestion = editedQuestion
    
    // Determine piping_source: prefer from Ask If conditions, otherwise keep existing if set for Piping type
    let finalPipingSource: string | null = currentQuestion.logic?.piping_source || null
    if (askIfConditions.length > 0 && askIfConditions[0].source) {
      finalPipingSource = askIfConditions[0].source
    } else if (askIfConditions.length === 0) {
      // Only clear piping_source if no conditions and it was set for ask_if
      if (currentQuestion.logic?.ask_if_condition && currentQuestion.logic?.piping_source) {
        // Keep piping_source if it was set for other purposes (e.g., Piping type)
        if (currentQuestion.logic?.type !== 'Piping') {
          finalPipingSource = null
        }
      }
    }
    
    // Build final question object with all updates applied synchronously
    const finalQuestion: ParsedQuestion = {
      ...currentQuestion,
      logic: {
        ...currentQuestion.logic,
        ask_if_condition: fullCondition || null,
        terminate_if: fullTerminateCondition || null,
        piping_source: finalPipingSource,
      },
    }
    
    // Update local state for UI consistency (even though we're about to save)
    setEditedQuestion(finalQuestion)
    
    // Save old variables to store (outside of setState to avoid render-phase updates)
    setQuestionOldVariables(finalQuestion.id, oldVars)
    
    // Save the final question with all updates
    onSave(finalQuestion)
    onClose()
  }
  
  const variableCount = getVariableCountForQuestion(editedQuestion)

  const updateField = <K extends keyof ParsedQuestion>(field: K, value: ParsedQuestion[K]) => {
    setEditedQuestion(prev => ({ ...prev, [field]: value }))
  }

  const updateLogic = <K extends keyof QuestionLogic>(field: K, value: QuestionLogic[K]) => {
    setEditedQuestion(prev => ({
      ...prev,
      logic: {
        ...prev.logic,
        [field]: value,
      } as QuestionLogic
    }))
  }

  // Options management
  const addOption = () => {
    if (!newOptionCode.trim() || !newOptionLabel.trim()) return
    
    const code = isNaN(Number(newOptionCode)) ? newOptionCode : Number(newOptionCode)
    const newOption: QuestionOption = {
      code,
      label: newOptionLabel,
      codeType: newOptionCodeType,
    }
    
    updateField('options', [...(editedQuestion.options || []), newOption])
    setNewOptionCode('')
    setNewOptionLabel('')
    setNewOptionCodeType('Normal')
  }

  const updateOption = (index: number, field: keyof QuestionOption, value: any) => {
    const options = [...(editedQuestion.options || [])]
    options[index] = { ...options[index], [field]: value }
    updateField('options', options)
  }

  const deleteOption = (index: number) => {
    const options = [...(editedQuestion.options || [])]
    options.splice(index, 1)
    updateField('options', options)
  }

  // Rows management (for Grid questions)
  const addRow = () => {
    if (!newOptionCode.trim() || !newOptionLabel.trim()) return
    
    const code = isNaN(Number(newOptionCode)) ? newOptionCode : Number(newOptionCode)
    const newRow: QuestionOption = {
      code,
      label: newOptionLabel,
      codeType: newOptionCodeType,
    }
    
    updateField('rows', [...(editedQuestion.rows || []), newRow])
    setNewOptionCode('')
    setNewOptionLabel('')
    setNewOptionCodeType('Normal')
  }

  const updateRow = (index: number, field: keyof QuestionOption, value: any) => {
    const rows = [...(editedQuestion.rows || [])]
    rows[index] = { ...rows[index], [field]: value }
    updateField('rows', rows)
  }

  const deleteRow = (index: number) => {
    const rows = [...(editedQuestion.rows || [])]
    rows.splice(index, 1)
    updateField('rows', rows)
  }

  // Columns management (for Grid questions)
  const addColumn = () => {
    if (!newOptionCode.trim() || !newOptionLabel.trim()) return
    
    const code = isNaN(Number(newOptionCode)) ? newOptionCode : Number(newOptionCode)
    const newColumn: QuestionOption = {
      code,
      label: newOptionLabel,
      codeType: newOptionCodeType,
    }
    
    updateField('columns', [...(editedQuestion.columns || []), newColumn])
    setNewOptionCode('')
    setNewOptionLabel('')
    setNewOptionCodeType('Normal')
  }

  const updateColumn = (index: number, field: keyof QuestionOption, value: any) => {
    const columns = [...(editedQuestion.columns || [])]
    columns[index] = { ...columns[index], [field]: value }
    updateField('columns', columns)
  }

  const deleteColumn = (index: number) => {
    const columns = [...(editedQuestion.columns || [])]
    columns.splice(index, 1)
    updateField('columns', columns)
  }

  const isGridType = editedQuestion.type.includes('Grid')
  const isRankType = editedQuestion.type.includes('Rank')
  const isOE = editedQuestion.type === 'OE' || editedQuestion.type === 'OE_Grid'

  // Use portal to render modal at document body level to avoid stacking context issues
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <AnimatePresence>
      <div 
        className="fixed inset-0 flex items-center justify-center p-4" 
        data-modal="edit-question"
        style={{ 
          zIndex: 99999,
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white dark:bg-surface-dark-lighter rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Question</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Question ID: {editedQuestion.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question ID
                  </label>
                  <input
                    type="text"
                    value={editedQuestion.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Question Type
                  </label>
                  <select
                    value={editedQuestion.type}
                    onChange={(e) => updateField('type', e.target.value as ParsedQuestion['type'])}
                    className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {QUESTION_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Question Label
                </label>
                <textarea
                  value={editedQuestion.label}
                  onChange={(e) => updateField('label', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instruction (Optional)
                </label>
                <textarea
                  value={editedQuestion.instruction || ''}
                  onChange={(e) => updateField('instruction', e.target.value || undefined)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Script, notes, etc."
                />
              </div>

              {isRankType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ranking Limit
                  </label>
                  <input
                    type="number"
                    value={editedQuestion.limit || ''}
                    onChange={(e) => updateField('limit', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., 5"
                  />
                </div>
              )}
            </div>

            {/* Old Variables */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                Old Variables ({variableCount} required)
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste old variable names (one per line, in order)
                </label>
                <textarea
                  value={oldVariablesText}
                  onChange={(e) => setOldVariablesText(e.target.value)}
                  rows={Math.max(3, Math.min(8, variableCount))}
                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm"
                  placeholder={`Paste ${variableCount} old variable name(s), one per line...`}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {oldVariablesText.split('\n').filter(l => l.trim()).length} of {variableCount} variables provided
                </p>
              </div>
            </div>

            {/* Logic */}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Logic
              </h3>
              
              {/* Logic Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Logic Type
                </label>
                <select
                  value={editedQuestion.logic?.type || 'Normal'}
                  onChange={(e) => updateLogic('type', e.target.value as QuestionLogic['type'])}
                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {LOGIC_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Piping Source - Redesigned */}
              <div className="p-4 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Piping Source
                  </label>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    Pipe codes from another question
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Source Question
                    </label>
                    <select
                      value={editedQuestion.logic?.piping_source || ''}
                      onChange={(e) => {
                        const sourceId = e.target.value || null
                        updateLogic('piping_source', sourceId)
                        
                        if (sourceId) {
                          const sourceQuestion = parsedQuestions.find(q => q.id === sourceId)
                          if (sourceQuestion) {
                            // If source question is a Grid question, use its ROWS as piping source
                            const isSourceGrid = sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid'
                            
                            if (isSourceGrid && sourceQuestion.rows) {
                              // Source is Grid → use rows from source
                              if (editedQuestion.type === 'MA_Grid' || editedQuestion.type === 'SA_Grid') {
                                // Target is also Grid → copy rows from source as columns
                                updateField('columns', [...sourceQuestion.rows])
                              } else if (editedQuestion.type === 'MA') {
                                // Target is MA → use source rows as options
                                updateField('options', [...sourceQuestion.rows])
                              }
                            }
                            // If source is regular MA question, use its options
                            else if (sourceQuestion.type === 'MA' && sourceQuestion.options) {
                              if (editedQuestion.type === 'MA_Grid' || editedQuestion.type === 'SA_Grid') {
                                // Target is Grid → use source options as columns
                                updateField('columns', [...sourceQuestion.options])
                              } else if (editedQuestion.type === 'MA') {
                                // Target is MA → copy options
                                updateField('options', [...sourceQuestion.options])
                              }
                            }
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    >
                      <option value="">None</option>
                      {/* Include current question */}
                      <option value={editedQuestion.id}>
                        {editedQuestion.id} - {editedQuestion.label.substring(0, 50)}{editedQuestion.label.length > 50 ? '...' : ''} (Current)
                      </option>
                      {parsedQuestions
                        .filter(q => q.id !== editedQuestion.id)
                        .map(q => (
                          <option key={q.id} value={q.id}>
                            {q.id} - {q.label.substring(0, 50)}{q.label.length > 50 ? '...' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  {editedQuestion.logic?.piping_source && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        Logic Operator
                      </label>
                      <select
                        value={pipingOperator}
                        onChange={(e) => setPipingOperator(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      >
                        {LOGIC_OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                {editedQuestion.logic?.piping_source && (() => {
                  const sourceQuestion = parsedQuestions.find(q => q.id === editedQuestion.logic?.piping_source)
                  const isSourceGrid = sourceQuestion && (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid')
                  
                  if (isSourceGrid) {
                    return (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Rows (codes and labels) from source Grid question will be used
                        {editedQuestion.type === 'MA_Grid' || editedQuestion.type === 'SA_Grid' 
                          ? ' as columns'
                          : ' as options'}
                      </p>
                    )
                  } else {
                    return (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {editedQuestion.type === 'MA' 
                          ? 'Options will be copied from source question'
                          : 'Codes will be piped from the selected question'}
                      </p>
                    )
                  }
                })()}
              </div>

              {/* Ask If Condition - Multiple Conditions with AND/OR */}
              <div className="p-4 bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-900/10 dark:to-red-900/10 rounded-lg border border-orange-200/50 dark:border-orange-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Ask If Condition
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Show this question only when condition(s) are met
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newCondition: AskIfCondition = {
                        id: `cond_${Date.now()}`,
                        source: '',
                        operator: '',
                        selectedCodes: new Set(),
                      }
                      setAskIfConditions([...askIfConditions, newCondition])
                      // Add connector if there's already a condition
                      if (askIfConditions.length > 0) {
                        setAskIfConnectors([...askIfConnectors, 'AND'])
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Condition
                  </button>
                </div>
                
                {askIfConditions.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                    No conditions. Click "Add Condition" to add one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {askIfConditions.map((condition, index) => (
                      <div key={condition.id} className="space-y-2">
                        {/* Connector selector (between conditions) */}
                        {index > 0 && (
                          <div className="flex items-center justify-center">
                            <select
                              value={askIfConnectors[index - 1] || 'AND'}
                              onChange={(e) => {
                                const newConnectors = [...askIfConnectors]
                                newConnectors[index - 1] = e.target.value as 'AND' | 'OR'
                                setAskIfConnectors(newConnectors)
                                const fullCondition = generateAskIfConditionFromMultiple(askIfConditions, newConnectors)
                                updateLogic('ask_if_condition', fullCondition)
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}
                        
                        {/* Condition block */}
                        <div className="p-3 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Condition {index + 1}</span>
                            {askIfConditions.length > 1 && (
                              <button
                                onClick={() => {
                                  const newConditions = askIfConditions.filter(c => c.id !== condition.id)
                                  setAskIfConditions(newConditions)
                                  const newConnectors = askIfConnectors.filter((_, i) => i !== index - 1)
                                  setAskIfConnectors(newConnectors)
                                  const fullCondition = generateAskIfConditionFromMultiple(newConditions, newConnectors)
                                  updateLogic('ask_if_condition', fullCondition)
                                  // Update piping_source if needed
                                  if (newConditions.length > 0 && !editedQuestion.logic?.piping_source) {
                                    updateLogic('piping_source', newConditions[0].source)
                                  } else if (newConditions.length === 0) {
                                    updateLogic('piping_source', null)
                                  }
                                }}
                                className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Source Question
                              </label>
                              <select
                                value={condition.source}
                                onChange={(e) => {
                                  const newConditions = [...askIfConditions]
                                  newConditions[index] = {
                                    ...condition,
                                    source: e.target.value,
                                    selectedCodes: new Set(),
                                  }
                                  setAskIfConditions(newConditions)
                                  // Set piping_source to first condition's source
                                  if (index === 0) {
                                    updateLogic('piping_source', e.target.value || null)
                                  }
                                  if (!e.target.value) {
                                    const fullCondition = generateAskIfConditionFromMultiple(newConditions, askIfConnectors)
                                    updateLogic('ask_if_condition', fullCondition)
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                              >
                                <option value="">None</option>
                                {/* Include current question */}
                                <option value={editedQuestion.id}>
                                  {editedQuestion.id} - {editedQuestion.label.substring(0, 40)}{editedQuestion.label.length > 40 ? '...' : ''} (Current)
                                </option>
                                {parsedQuestions
                                  .filter(q => q.id !== editedQuestion.id)
                                  .map(q => (
                                    <option key={q.id} value={q.id}>
                                      {q.id} - {q.label.substring(0, 40)}{q.label.length > 40 ? '...' : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {condition.source && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Logic Operator
                                </label>
                                <select
                                  value={condition.operator}
                                  onChange={(e) => {
                                    const operator = e.target.value
                                    const newConditions = [...askIfConditions]
                                    newConditions[index] = {
                                      ...condition,
                                      operator,
                                      selectedCodes: operator === 'is_answered' || operator === 'is_not_answered' ? new Set() : condition.selectedCodes,
                                    }
                                    setAskIfConditions(newConditions)
                                    const fullCondition = generateAskIfConditionFromMultiple(newConditions, askIfConnectors)
                                    updateLogic('ask_if_condition', fullCondition)
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  {LOGIC_OPERATORS.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Code selection - Matrix table for MA_Grid, checkboxes for others */}
                          {condition.source && condition.operator && 
                           condition.operator !== 'is_answered' && 
                           condition.operator !== 'is_not_answered' && (
                            <div className="mt-3">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Select Codes
                              </label>
                              <div className="max-h-96 overflow-y-auto p-4 bg-white dark:bg-surface-dark-lighter rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                {(() => {
                                  const sourceQuestion = parsedQuestions.find(q => q.id === condition.source) || 
                                                         (condition.source === editedQuestion.id ? editedQuestion : null)
                                  if (!sourceQuestion) {
                                    return <p className="text-xs text-gray-500 dark:text-gray-400">Question not found</p>
                                  }

                                  // Check if this is a Matrix MA question (MA_Grid or MA with rows and columns)
                                  const isMatrixMA = (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'MA') && 
                                                    sourceQuestion.rows && sourceQuestion.rows.length > 0 && 
                                                    sourceQuestion.columns && sourceQuestion.columns.length > 0

                                  // Matrix table for MA_Grid
                                  if (isMatrixMA) {
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                          Matrix: {sourceQuestion.rows.length} rows × {sourceQuestion.columns.length} columns
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full border-collapse text-xs">
                                            <thead>
                                              <tr className="bg-gray-50 dark:bg-surface-dark-lighter border-b-2 border-gray-300 dark:border-gray-600">
                                                <th className="px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-50 dark:bg-surface-dark-lighter z-10">
                                                  <div className="flex flex-col">
                                                    <span className="text-xs">CODE</span>
                                                    <span className="text-[10px] font-normal text-gray-600 dark:text-gray-400">VN</span>
                                                  </div>
                                                </th>
                                                {sourceQuestion.columns.map((column, colIdx) => (
                                                  <th key={colIdx} className="px-3 py-2 text-center font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 last:border-r-0 min-w-[80px]">
                                                    <div className="flex flex-col items-center">
                                                      <span className="font-mono font-bold text-primary text-sm">{column.code}</span>
                                                      <span className="text-[10px] font-normal text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{column.label}</span>
                                                    </div>
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {sourceQuestion.rows.map((row, rowIdx) => (
                                                <tr
                                                  key={rowIdx}
                                                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                                                >
                                                  <td className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 sticky left-0 bg-white dark:bg-surface-dark z-10">
                                                    <div className="flex flex-col">
                                                      <span className="font-mono font-bold text-primary text-sm">{row.code}</span>
                                                      <span className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{row.label}</span>
                                                    </div>
                                                  </td>
                                                  {sourceQuestion.columns.map((column, colIdx) => {
                                                    // For MA_Grid, the code format is: {rowCode}_{columnCode}
                                                    // But for selection, we need to store it in a way that can be used in condition
                                                    // We'll use a composite key: "R{rowCode}C{columnCode}" for storage
                                                    const compositeKey = `R${row.code}C${column.code}`
                                                    const isChecked = condition.selectedCodes.has(compositeKey)
                                                    
                                                    return (
                                                      <td
                                                        key={colIdx}
                                                        className="px-3 py-2 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0"
                                                      >
                                                        <label className="flex items-center justify-center cursor-pointer group relative">
                                                          <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                              const newSelected = new Set(condition.selectedCodes)
                                                              if (e.target.checked) {
                                                                newSelected.add(compositeKey)
                                                              } else {
                                                                newSelected.delete(compositeKey)
                                                              }
                                                              const newConditions = [...askIfConditions]
                                                              newConditions[index] = {
                                                                ...condition,
                                                                selectedCodes: newSelected,
                                                              }
                                                              setAskIfConditions(newConditions)
                                                              const fullCondition = generateAskIfConditionFromMultiple(newConditions, askIfConnectors)
                                                              updateLogic('ask_if_condition', fullCondition)
                                                            }}
                                                            className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary/50 cursor-pointer"
                                                          />
                                                          {isChecked && (
                                                            <span className="absolute inset-0 bg-primary/10 rounded pointer-events-none"></span>
                                                          )}
                                                        </label>
                                                      </td>
                                                    )
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )
                                  }

                                  // Regular options/rows list for SA, MA, SA_Grid, etc.
                                  const options = sourceQuestion.options || sourceQuestion.rows || []
                                  const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))

                                  if (mainOptions.length === 0) {
                                    return <p className="text-xs text-gray-500 dark:text-gray-400">No options available</p>
                                  }

                                  return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {mainOptions.map((option) => {
                                        const isChecked = condition.selectedCodes.has(option.code)
                                        return (
                                          <label
                                            key={option.code}
                                            className={`flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-all border ${
                                              isChecked 
                                                ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 shadow-sm' 
                                                : 'bg-gray-50 dark:bg-surface-dark border-gray-200 dark:border-gray-700 hover:border-primary/20 hover:bg-gray-100 dark:hover:bg-surface-dark-lighter'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                const newSelected = new Set(condition.selectedCodes)
                                                if (e.target.checked) {
                                                  newSelected.add(option.code)
                                                } else {
                                                  newSelected.delete(option.code)
                                                }
                                                const newConditions = [...askIfConditions]
                                                newConditions[index] = {
                                                  ...condition,
                                                  selectedCodes: newSelected,
                                                }
                                                setAskIfConditions(newConditions)
                                                const fullCondition = generateAskIfConditionFromMultiple(newConditions, askIfConnectors)
                                                updateLogic('ask_if_condition', fullCondition)
                                              }}
                                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary/50 shrink-0 cursor-pointer"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-1">
                                              <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                                                isChecked 
                                                  ? 'bg-primary text-white' 
                                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                              }`}>
                                                {option.code}
                                              </span>
                                              <span className="flex-1">{option.label}</span>
                                            </span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview generated condition */}
                {editedQuestion.logic?.ask_if_condition && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">Generated Condition:</p>
                    <p className="text-xs font-mono text-blue-800 dark:text-blue-200">{editedQuestion.logic.ask_if_condition}</p>
                  </div>
                )}
              </div>

              {/* Terminate If Condition - Multiple Conditions with AND/OR */}
              <div className="p-4 bg-gradient-to-br from-red-50/50 to-pink-50/50 dark:from-red-900/10 dark:to-pink-900/10 rounded-lg border border-red-200/50 dark:border-red-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Terminate If Condition
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      End survey when condition(s) are met
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newCondition: TerminateIfCondition = {
                        id: `term_cond_${Date.now()}`,
                        source: '',
                        operator: '',
                        selectedCodes: new Set(),
                      }
                      setTerminateIfConditions([...terminateIfConditions, newCondition])
                      // Add connector if there's already a condition
                      if (terminateIfConditions.length > 0) {
                        setTerminateIfConnectors([...terminateIfConnectors, 'AND'])
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Condition
                  </button>
                </div>
                
                {terminateIfConditions.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-surface-dark/50 rounded-lg">
                    No conditions. Click "Add Condition" to add one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {terminateIfConditions.map((condition, index) => (
                      <div key={condition.id} className="space-y-2">
                        {/* Connector selector (between conditions) */}
                        {index > 0 && (
                          <div className="flex items-center justify-center">
                            <select
                              value={terminateIfConnectors[index - 1] || 'AND'}
                              onChange={(e) => {
                                const newConnectors = [...terminateIfConnectors]
                                newConnectors[index - 1] = e.target.value as 'AND' | 'OR'
                                setTerminateIfConnectors(newConnectors)
                                const fullCondition = generateTerminateIfConditionFromMultiple(terminateIfConditions, newConnectors)
                                updateLogic('terminate_if', fullCondition)
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}
                        
                        {/* Condition block */}
                        <div className="p-3 bg-white dark:bg-surface-dark-lighter rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Condition {index + 1}</span>
                            {terminateIfConditions.length > 1 && (
                              <button
                                onClick={() => {
                                  const newConditions = terminateIfConditions.filter(c => c.id !== condition.id)
                                  setTerminateIfConditions(newConditions)
                                  const newConnectors = terminateIfConnectors.filter((_, i) => i !== index - 1)
                                  setTerminateIfConnectors(newConnectors)
                                  const fullCondition = generateTerminateIfConditionFromMultiple(newConditions, newConnectors)
                                  updateLogic('terminate_if', fullCondition)
                                }}
                                className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Source Question
                              </label>
                              <select
                                value={condition.source}
                                onChange={(e) => {
                                  const newConditions = [...terminateIfConditions]
                                  newConditions[index] = {
                                    ...condition,
                                    source: e.target.value,
                                    selectedCodes: new Set(),
                                  }
                                  setTerminateIfConditions(newConditions)
                                  if (!e.target.value) {
                                    const fullCondition = generateTerminateIfConditionFromMultiple(newConditions, terminateIfConnectors)
                                    updateLogic('terminate_if', fullCondition)
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                              >
                                <option value="">None</option>
                                {/* Include current question */}
                                <option value={editedQuestion.id}>
                                  {editedQuestion.id} - {editedQuestion.label.substring(0, 40)}{editedQuestion.label.length > 40 ? '...' : ''} (Current)
                                </option>
                                {parsedQuestions
                                  .filter(q => q.id !== editedQuestion.id)
                                  .map(q => (
                                    <option key={q.id} value={q.id}>
                                      {q.id} - {q.label.substring(0, 40)}{q.label.length > 40 ? '...' : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {condition.source && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Logic Operator
                                </label>
                                <select
                                  value={condition.operator}
                                  onChange={(e) => {
                                    const operator = e.target.value
                                    const newConditions = [...terminateIfConditions]
                                    newConditions[index] = {
                                      ...condition,
                                      operator,
                                      selectedCodes: operator === 'is_answered' || operator === 'is_not_answered' ? new Set() : condition.selectedCodes,
                                    }
                                    setTerminateIfConditions(newConditions)
                                    const fullCondition = generateTerminateIfConditionFromMultiple(newConditions, terminateIfConnectors)
                                    updateLogic('terminate_if', fullCondition)
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                >
                                  {LOGIC_OPERATORS.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Code selection - Reuse the same logic from Ask If */}
                          {condition.source && condition.operator && 
                           condition.operator !== 'is_answered' && 
                           condition.operator !== 'is_not_answered' && (
                            <div className="mt-3">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Select Codes
                              </label>
                              <div className="max-h-96 overflow-y-auto p-4 bg-white dark:bg-surface-dark-lighter rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                {(() => {
                                  const sourceQuestion = parsedQuestions.find(q => q.id === condition.source) || 
                                                         (condition.source === editedQuestion.id ? editedQuestion : null)
                                  if (!sourceQuestion) {
                                    return <p className="text-xs text-gray-500 dark:text-gray-400">Question not found</p>
                                  }

                                  // Check if this is a Matrix MA question
                                  const isMatrixMA = (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'MA') && 
                                                    sourceQuestion.rows && sourceQuestion.rows.length > 0 && 
                                                    sourceQuestion.columns && sourceQuestion.columns.length > 0

                                  // Matrix table for MA_Grid
                                  if (isMatrixMA) {
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                          Matrix: {sourceQuestion.rows.length} rows × {sourceQuestion.columns.length} columns
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full border-collapse text-xs">
                                            <thead>
                                              <tr className="bg-gray-50 dark:bg-surface-dark-lighter border-b-2 border-gray-300 dark:border-gray-600">
                                                <th className="px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-50 dark:bg-surface-dark-lighter z-10">
                                                  <div className="flex flex-col">
                                                    <span className="text-xs">CODE</span>
                                                    <span className="text-[10px] font-normal text-gray-600 dark:text-gray-400">VN</span>
                                                  </div>
                                                </th>
                                                {sourceQuestion.columns.map((column, colIdx) => (
                                                  <th key={colIdx} className="px-3 py-2 text-center font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 last:border-r-0 min-w-[80px]">
                                                    <div className="flex flex-col items-center">
                                                      <span className="font-mono font-bold text-primary text-sm">{column.code}</span>
                                                      <span className="text-[10px] font-normal text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{column.label}</span>
                                                    </div>
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {sourceQuestion.rows.map((row, rowIdx) => (
                                                <tr
                                                  key={rowIdx}
                                                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                                                >
                                                  <td className="px-3 py-2 border-r border-gray-300 dark:border-gray-600 sticky left-0 bg-white dark:bg-surface-dark z-10">
                                                    <div className="flex flex-col">
                                                      <span className="font-mono font-bold text-primary text-sm">{row.code}</span>
                                                      <span className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">{row.label}</span>
                                                    </div>
                                                  </td>
                                                  {sourceQuestion.columns.map((column, colIdx) => {
                                                    const compositeKey = `R${row.code}C${column.code}`
                                                    const isChecked = condition.selectedCodes.has(compositeKey)
                                                    
                                                    return (
                                                      <td
                                                        key={colIdx}
                                                        className="px-3 py-2 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0"
                                                      >
                                                        <label className="flex items-center justify-center cursor-pointer group relative">
                                                          <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                              const newSelected = new Set(condition.selectedCodes)
                                                              if (e.target.checked) {
                                                                newSelected.add(compositeKey)
                                                              } else {
                                                                newSelected.delete(compositeKey)
                                                              }
                                                              const newConditions = [...terminateIfConditions]
                                                              newConditions[index] = {
                                                                ...condition,
                                                                selectedCodes: newSelected,
                                                              }
                                                              setTerminateIfConditions(newConditions)
                                                              const fullCondition = generateTerminateIfConditionFromMultiple(newConditions, terminateIfConnectors)
                                                              updateLogic('terminate_if', fullCondition)
                                                            }}
                                                            className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary/50 cursor-pointer"
                                                          />
                                                          {isChecked && (
                                                            <span className="absolute inset-0 bg-primary/10 rounded pointer-events-none"></span>
                                                          )}
                                                        </label>
                                                      </td>
                                                    )
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )
                                  }

                                  // Regular options/rows list
                                  const options = sourceQuestion.options || sourceQuestion.rows || []
                                  const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))

                                  if (mainOptions.length === 0) {
                                    return <p className="text-xs text-gray-500 dark:text-gray-400">No options available</p>
                                  }

                                  return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {mainOptions.map((option) => {
                                        const isChecked = condition.selectedCodes.has(option.code)
                                        return (
                                          <label
                                            key={option.code}
                                            className={`flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-all border ${
                                              isChecked 
                                                ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 shadow-sm' 
                                                : 'bg-gray-50 dark:bg-surface-dark border-gray-200 dark:border-gray-700 hover:border-primary/20 hover:bg-gray-100 dark:hover:bg-surface-dark-lighter'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                const newSelected = new Set(condition.selectedCodes)
                                                if (e.target.checked) {
                                                  newSelected.add(option.code)
                                                } else {
                                                  newSelected.delete(option.code)
                                                }
                                                const newConditions = [...terminateIfConditions]
                                                newConditions[index] = {
                                                  ...condition,
                                                  selectedCodes: newSelected,
                                                }
                                                setTerminateIfConditions(newConditions)
                                                const fullCondition = generateTerminateIfConditionFromMultiple(newConditions, terminateIfConnectors)
                                                updateLogic('terminate_if', fullCondition)
                                              }}
                                              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary/50 shrink-0 cursor-pointer"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-1">
                                              <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                                                isChecked 
                                                  ? 'bg-primary text-white' 
                                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                              }`}>
                                                {option.code}
                                              </span>
                                              <span className="flex-1">{option.label}</span>
                                            </span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview generated condition */}
                {editedQuestion.logic?.terminate_if && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-xs font-medium text-red-900 dark:text-red-300 mb-1">Generated Condition:</p>
                    <p className="text-xs font-mono text-red-800 dark:text-red-200">{editedQuestion.logic.terminate_if}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Options (for SA, MA, Rank questions) */}
            {!isGridType && !isOE && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Options ({(editedQuestion.options || []).length})
                  </h3>
                </div>

                {/* Add New Option */}
                <div className="p-4 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Code</label>
                      <input
                        type="text"
                        value={newOptionCode}
                        onChange={(e) => setNewOptionCode(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        placeholder="1"
                      />
                    </div>
                    <div className="col-span-7">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
                      <input
                        type="text"
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                        placeholder="Option label"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                      <select
                        value={newOptionCodeType || 'Normal'}
                        onChange={(e) => setNewOptionCodeType(e.target.value as QuestionOption['codeType'])}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {CODE_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={addOption}
                        className="w-full p-1.5 bg-primary hover:bg-primary/90 text-white rounded transition-colors flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  {(editedQuestion.options || []).map((option, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={option.code}
                            onChange={(e) => {
                              const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                              updateOption(index, 'code', val)
                            }}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                          />
                        </div>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={option.label}
                            onChange={(e) => updateOption(index, 'label', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={option.codeType || 'Normal'}
                            onChange={(e) => updateOption(index, 'codeType', e.target.value as QuestionOption['codeType'])}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                          >
                            {CODE_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1">
                          <button
                            onClick={() => deleteOption(index)}
                            className="w-full p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rows (for Grid questions) */}
            {isGridType && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Grid className="w-4 h-4" />
                    Rows ({(editedQuestion.rows || []).length})
                  </h3>
                </div>

                {/* Add New Row */}
                <div className="p-4 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Code</label>
                      <input
                        type="text"
                        value={newOptionCode}
                        onChange={(e) => setNewOptionCode(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="col-span-9">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
                      <input
                        type="text"
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={addRow}
                        className="w-full p-1.5 bg-primary hover:bg-primary/90 text-white rounded transition-colors flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rows List */}
                <div className="space-y-2">
                  {(editedQuestion.rows || []).map((row, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => {
                              const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                              updateRow(index, 'code', val)
                            }}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                          />
                        </div>
                        <div className="col-span-9">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => updateRow(index, 'label', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        <div className="col-span-1">
                          <button
                            onClick={() => deleteRow(index)}
                            className="w-full p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Columns (for Grid questions, except OE_Grid) */}
            {isGridType && editedQuestion.type !== 'OE_Grid' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Grid className="w-4 h-4" />
                      Columns ({(editedQuestion.columns || []).length})
                    </h3>
                    {editedQuestion.logic?.piping_source && (() => {
                      const sourceQuestion = parsedQuestions.find(q => q.id === editedQuestion.logic?.piping_source)
                      const isSourceGrid = sourceQuestion && (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid')
                      if (isSourceGrid) {
                        return (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                            Piped from {editedQuestion.logic.piping_source} (rows)
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>

                {/* Piping Info */}
                {editedQuestion.logic?.piping_source && (() => {
                  const sourceQuestion = parsedQuestions.find(q => q.id === editedQuestion.logic?.piping_source)
                  const isSourceGrid = sourceQuestion && (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid')
                  if (isSourceGrid) {
                    return (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          <span className="font-semibold">Columns initially synced from {editedQuestion.logic.piping_source}</span>
                          {' '}(rows from source Grid question). You can still edit these columns if needed.
                        </p>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Add New Column */}
                <div className="p-4 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Code</label>
                      <input
                        type="text"
                        value={newOptionCode}
                        onChange={(e) => setNewOptionCode(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="col-span-9">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
                      <input
                        type="text"
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={addColumn}
                        className="w-full p-1.5 bg-primary hover:bg-primary/90 text-white rounded transition-colors flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Columns List */}
                <div className="space-y-2">
                  {(editedQuestion.columns || []).map((col, index) => {
                    const isPiped = editedQuestion.logic?.piping_source && (() => {
                      const sourceQuestion = parsedQuestions.find(q => q.id === editedQuestion.logic?.piping_source)
                      return sourceQuestion && (sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid')
                    })()
                    
                    return (
                      <div key={index} className={`p-3 bg-gray-50 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 ${
                        isPiped ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/50' : ''
                      }`}>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={col.code}
                              onChange={(e) => {
                                const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                                updateColumn(index, 'code', val)
                              }}
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                            />
                          </div>
                          <div className="col-span-9">
                            <input
                              type="text"
                              value={col.label}
                              onChange={(e) => updateColumn(index, 'label', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                          <div className="col-span-1">
                            <button
                              onClick={() => deleteColumn(index)}
                              className="w-full p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  // Render modal using portal to document.body to ensure it's above all other content
  return mounted && typeof window !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null
}

