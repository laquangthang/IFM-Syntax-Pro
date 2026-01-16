import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ParsedQuestion } from '@/lib/geminiParser'
import { postProcessQuestions } from '@/lib/postProcessor'

// Initialize Gemini Client
const API_KEY = process.env.GEMINI_API_KEY || ''
let genAI: GoogleGenerativeAI
let MODEL_NAME = 'gemini-2.5-flash'

try {
  if (!API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY environment variable is not set')
    console.warn('   Available env vars:', Object.keys(process.env).filter(k => k.includes('GEMINI')))
  }
  genAI = new GoogleGenerativeAI(API_KEY)
} catch (initError: any) {
  console.error('❌ Failed to initialize Gemini client:', initError)
  // Will be handled in POST handler
}

interface StructureResponse {
  pages?: Array<{ pageNumber: number; text: string }>
  questions?: Array<{ id: string; startPage: number; rawText: string }>
}

interface QuestionBoundary {
  id: string
  startPage: number
  endPage: number
  startIndex: number
  endIndex: number
  rawText: string
}

/**
 * AI Refinement Prompt - Refine a single question with context
 */
function createRefinementPrompt(
  questionBoundary: QuestionBoundary,
  rawText: string,
  detectedOptions: Array<{ code: string | number; label: string }>,
  previousQuestions?: ParsedQuestion[]
): string {
  let prompt = `Bạn là chuyên gia phân tích Bảng câu hỏi (BCH) Market Research.
Nhiệm vụ: Refine và parse MỘT câu hỏi từ raw text đã được extract.

QUAN TRỌNG - PHẢI TUÂN THỦ:
- Chỉ trả về MỘT JSON object, KHÔNG phải array
- KHÔNG có text giải thích trước hoặc sau JSON
- KHÔNG có markdown code blocks
- Tất cả strings phải được đóng dấu ngoặc kép đúng cách
- Escape các ký tự đặc biệt: \\", \\n, \\\\

RAW TEXT CỦA CÂU HỎI:
${rawText.substring(0, 2000)}${rawText.length > 2000 ? '...' : ''}

OPTIONS ĐÃ DETECT (rule-based, có thể thiếu hoặc sai):
${detectedOptions.length > 0 
  ? detectedOptions.map(o => `- Code ${o.code}: ${o.label}`).join('\n')
  : '- Chưa detect được options (cần AI extract)'}

`

  // Add context from previous questions
  if (previousQuestions && previousQuestions.length > 0) {
    prompt += `CONTEXT - CÁC CÂU HỎI TRƯỚC ĐÓ (để tham khảo logic dependencies):
`
    const contextQuestions = previousQuestions.slice(-5)
    contextQuestions.forEach(q => {
      prompt += `- ${q.id}: ${q.type} - "${q.label.substring(0, 50)}${q.label.length > 50 ? '...' : ''}"\n`
      if (q.options && q.options.length > 0) {
        prompt += `  Options: ${q.options.map(o => `${o.code}`).join(', ')}\n`
      }
    })
    prompt += `\n`
  }

  prompt += `PHÂN LOẠI TYPE:
- "Note: SA" hoặc "SCRIPT: HỎI TẤT CẢ" → type:"SA"
- "Note: MA" → type:"MA"
- "Note: SA/MA per attribute" → type:"SA_Grid" hoặc "MA_Grid"
- "Ranking = 5" → type:"Rank_Fixed", limit:5
- "Ranking upto 5" → type:"Rank_Upto", limit:5
- "OE/OA" hoặc nhãn có "(ghi rõ)" → type:"OE"
- "OE/OA per attribute" → type:"OE_Grid" (chỉ có rows, KHÔNG có columns)

LOGIC:
- "SCRIPT: HỎI TẤT CẢ" → logic.type:"Ask All"
- "Piping code in QX" → logic.piping_source:"QX", logic.type:"Piping"
- "ASK FOR/ASK IF CODE X IN QY" → logic.piping_source:"QY", logic.ask_if_condition:"IF (QYRX = X)"
- "TERMINATE" → codeType:"Terminate" và logic.terminate_if

OPTIONS:
- Validate và bổ sung options từ raw text
- Nếu có "(ghi rõ)" → thêm option với code X_O
- codeType: "Normal", "Exclusive", "Trap", "Other", "Terminate"

LÀM SẠCH:
- Label: chỉ Tiếng Việt, bỏ Tiếng Anh
- Xóa "TERMINATE", "Note:", "SCRIPT:" khỏi label, đưa vào instruction
- Nối các dòng text bị xuống dòng sai

ĐỊNH DẠNG JSON:
{
  "id": "${questionBoundary.id}",
  "type": "SA",
  "instruction": "Lời dẫn gốc",
  "label": "Nội dung câu hỏi sạch (chỉ Tiếng Việt)",
  "options": [
    {"code": 1, "label": "Đáp án 1", "codeType": "Normal"}
  ],
  "rows": [],
  "columns": [],
  "logic": {
    "type": "Normal",
    "piping_source": null,
    "terminate_if": null,
    "ask_if_condition": null
  }
}

YÊU CẦU: Trả về ĐÚNG MỘT JSON object như trên, KHÔNG có text nào khác.`

  return prompt
}

/**
 * Extract options from question text (rule-based)
 */
function extractOptionsFromText(questionText: string): Array<{ code: string | number; label: string }> {
  const options: Array<{ code: string | number; label: string }> = []
  
  // Pattern 1: Numbered options (1. Option, 2. Option, etc.)
  const numberedPattern = /(?:^|\n)\s*(\d+)[\.\)]\s*([^\n]+)/gim
  let match: RegExpExecArray | null
  
  while ((match = numberedPattern.exec(questionText)) !== null) {
    const code = parseInt(match[1])
    const label = match[2].trim()
    options.push({ code, label })
  }
  
  // Pattern 2: Letter options (a. Option, b. Option, etc.) - convert to numbers
  if (options.length === 0) {
    const letterPattern = /(?:^|\n)\s*([a-z])[\.\)]\s*([^\n]+)/gim
    let letterMatch: RegExpExecArray | null
    let letterIndex = 1
    
    while ((letterMatch = letterPattern.exec(questionText)) !== null) {
      const label = letterMatch[2].trim()
      options.push({ code: letterIndex++, label })
    }
  }
  
  // Pattern 3: Checkbox/bullet options (□ Option, • Option, etc.)
  if (options.length === 0) {
    const bulletPattern = /(?:^|\n)\s*[□•▪▫○◯]\s*([^\n]+)/gim
    let bulletMatch: RegExpExecArray | null
    let bulletIndex = 1
    
    while ((bulletMatch = bulletPattern.exec(questionText)) !== null) {
      const label = bulletMatch[1].trim()
      options.push({ code: bulletIndex++, label })
    }
  }
  
  return options
}

/**
 * Clean and fix JSON syntax
 */
function fixJSONSyntax(jsonText: string): string {
  let fixed = jsonText.trim()
  
  // Remove markdown code blocks
  fixed = fixed.replace(/```json\s*/g, '')
  fixed = fixed.replace(/```\s*/g, '')
  
  // Remove comments
  fixed = fixed.replace(/\/\/.*$/gm, '')
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
  
  // Fix control characters
  let result = ''
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i]
    const charCode = char.charCodeAt(0)
    
    if (escapeNext) {
      result += char
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      result += char
      escapeNext = true
      continue
    }
    
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    
    if (inString) {
      if (charCode === 0x0A) {
        result += '\\n'
      } else if (charCode === 0x0D) {
        result += '\\r'
      } else if (charCode === 0x09) {
        result += '\\t'
      } else if (charCode >= 0x00 && charCode <= 0x1F) {
        continue
      } else {
        result += char
      }
    } else {
      result += char
    }
  }
  
  fixed = result
  
  // Fix single quotes
  fixed = fixed.replace(/'([^']+)'\s*:/g, '"$1":')
  
  // Remove trailing commas
  fixed = fixed.replace(/,\s*}/g, '}')
  fixed = fixed.replace(/,\s*]/g, ']')
  
  return fixed.trim()
}

/**
 * Refine a single question using AI
 */
async function refineQuestion(
  questionBoundary: QuestionBoundary,
  detectedOptions: Array<{ code: string | number; label: string }>,
  previousQuestions?: ParsedQuestion[]
): Promise<ParsedQuestion> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })
  
  const prompt = createRefinementPrompt(
    questionBoundary,
    questionBoundary.rawText,
    detectedOptions,
    previousQuestions
  )
  
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096, // Smaller for single question
    },
  })
  
  let jsonText = result.response.text()
  jsonText = fixJSONSyntax(jsonText)
  
  // Parse JSON
  let parsedQuestion: ParsedQuestion
  try {
    parsedQuestion = JSON.parse(jsonText) as ParsedQuestion
    if (!parsedQuestion.id) {
      parsedQuestion.id = questionBoundary.id
    }
  } catch (parseError: any) {
    console.error(`❌ JSON Parse Error for ${questionBoundary.id}:`, parseError.message)
    throw new Error(`Failed to parse question ${questionBoundary.id}: ${parseError.message}`)
  }
  
  return parsedQuestion
}

export async function POST(request: NextRequest) {
  try {
    console.log(`\n📦 STRUCTURED EXTRACTION - Starting...`)
    
    // Validate API key early
    if (!API_KEY) {
      console.error('❌ GEMINI_API_KEY is not set')
      return NextResponse.json(
        { 
          error: 'GEMINI_API_KEY is not configured',
          details: 'Please set GEMINI_API_KEY environment variable'
        },
        { status: 500 }
      )
    }
    
    if (!genAI) {
      console.error('❌ Gemini client not initialized')
      return NextResponse.json(
        { 
          error: 'Failed to initialize Gemini client',
          details: 'Gemini client initialization failed'
        },
        { status: 500 }
      )
    }
    
    console.log(`   API Key present: ${!!API_KEY}`)
    console.log(`   Parsing form data...`)
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.error('❌ No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    console.log(`   File received: ${file.name}, type: ${file.type}, size: ${file.size}`)
    
    if (file.type !== 'application/pdf') {
      console.error(`❌ Invalid file type: ${file.type}`)
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    console.log(`   ✅ File validation passed`)

    // Phase 1: Extract PDF text using Gemini (more reliable than pdfjs-dist on server)
    console.log(`\n📄 Phase 1: Extracting PDF text structure with Gemini...`)
    
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })
    
    // Convert PDF to base64
    console.log(`   Converting PDF to base64...`)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')
    console.log(`   ✅ PDF converted (${base64Data.length} chars)`)
    
    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: 'application/pdf',
      },
    }
    
    // Use Gemini to extract text structure
    const structurePrompt = `Bạn là chuyên gia phân tích PDF.
Nhiệm vụ: Đọc PDF và trả về text structure dưới dạng JSON.

YÊU CẦU:
- Trả về JSON object với format:
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "Full text content of page 1"
    }
  ],
  "questions": [
    {
      "id": "Q1",
      "startPage": 1,
      "rawText": "Full text of question Q1 including question and all options"
    }
  ]
}

- Tìm tất cả questions (Q1, Q2, Q3A, etc.) trong PDF
- Với mỗi question, extract toàn bộ text từ question đến trước question tiếp theo
- Chỉ trả về JSON, không có text giải thích`

    console.log(`   Calling Gemini API for structure extraction...`)
    let structureResult
    try {
      structureResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: structurePrompt }, pdfPart] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 16384,
        },
      })
      console.log(`   ✅ Gemini API call successful`)
    } catch (geminiError: any) {
      console.error('❌ Gemini API Error:', geminiError.message)
      console.error('   Error details:', JSON.stringify(geminiError, null, 2))
      throw new Error(`Gemini API error: ${geminiError.message}`)
    }
    
    console.log(`   Extracting response text...`)
    let structureJson
    try {
      structureJson = structureResult.response.text()
      console.log(`   ✅ Response text extracted (${structureJson.length} chars)`)
    } catch (textError: any) {
      console.error('❌ Error extracting response text:', textError.message)
      throw new Error(`Failed to extract response text: ${textError.message}`)
    }
    
    console.log(`   Fixing JSON syntax...`)
    structureJson = fixJSONSyntax(structureJson)
    
    let structureData: StructureResponse
    try {
      structureData = JSON.parse(structureJson) as StructureResponse
      console.log(`   ✅ Structure JSON parsed successfully`)
    } catch (parseError: any) {
      console.error('❌ Failed to parse structure JSON:', parseError.message)
      console.error('   JSON preview (first 500 chars):', structureJson.substring(0, 500))
      throw new Error(`Failed to extract PDF structure: ${parseError.message}`)
    }
    
    // Convert to our format
    const questions: QuestionBoundary[] = (structureData.questions || []).map((q, idx) => ({
      id: q.id,
      startPage: q.startPage || 1,
      endPage: q.startPage || 1,
      startIndex: idx * 1000, // Approximate
      endIndex: (idx + 1) * 1000,
      rawText: q.rawText,
    }))
    
    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions detected in PDF' },
        { status: 400 }
      )
    }
    
    const hasGrids = questions.some(q => q.rawText.toLowerCase().includes('grid') || q.rawText.toLowerCase().includes('per attribute'))
    const hasLogic = questions.some(q => q.rawText.toLowerCase().includes('piping') || q.rawText.toLowerCase().includes('ask if') || q.rawText.toLowerCase().includes('terminate'))
    
    console.log(`   ✅ Extracted structure: ${questions.length} questions`)
    console.log(`   ✅ Has grids: ${hasGrids}`)
    console.log(`   ✅ Has logic: ${hasLogic}`)

    // Phase 2: Refine each question with AI
    console.log(`\n🤖 Phase 2: Refining questions with AI...`)
    const refinedQuestions: ParsedQuestion[] = []
    const errors: string[] = []

    for (let i = 0; i < questions.length; i++) {
      const questionBoundary = questions[i]
      console.log(`   Processing ${questionBoundary.id} (${i + 1}/${questions.length})...`)
      
      try {
        // Extract options using rule-based method
        const detectedOptions = extractOptionsFromText(questionBoundary.rawText)
        
        // Refine with AI
        const previousQuestions = refinedQuestions.slice(-5) // Last 5 for context
        const refined = await refineQuestion(
          questionBoundary,
          detectedOptions,
          previousQuestions.length > 0 ? previousQuestions : undefined
        )
        
        refinedQuestions.push(refined)
        console.log(`   ✅ ${questionBoundary.id}: ${refined.type}`)
        
        // Small delay to avoid rate limits
        if (i < questions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error: any) {
        console.error(`   ❌ Error refining ${questionBoundary.id}:`, error.message)
        errors.push(`${questionBoundary.id}: ${error.message}`)
        // Continue with next question
      }
    }

    // Phase 3: Post-processing
    console.log(`\n🔧 Phase 3: Post-processing...`)
    let postProcessed
    try {
      postProcessed = postProcessQuestions(refinedQuestions)
      console.log(`   ✅ Post-processing complete`)
    } catch (postError: any) {
      console.error('❌ Post-processing error:', postError.message)
      console.error('   Stack:', postError.stack)
      throw new Error(`Post-processing failed: ${postError.message}`)
    }
    
    console.log(`\n✅ Structured extraction complete!`)
    console.log(`   Total questions: ${postProcessed.questions.length}`)
    console.log(`   Validation errors: ${postProcessed.validation.errors.length}`)
    console.log(`   Validation warnings: ${postProcessed.validation.warnings.length}`)

    return NextResponse.json({
      success: true,
      questions: postProcessed.questions,
      totalQuestions: postProcessed.questions.length,
      errors: errors.length > 0 ? errors : undefined,
      validation: postProcessed.validation,
      structure: {
        totalDetected: questions.length,
        hasGrids,
        hasLogic,
      },
    })

  } catch (error: any) {
    console.error('❌ Error in structured extraction:', error)
    console.error('   Stack:', error.stack)
    
    // Return detailed error for debugging
    return NextResponse.json(
      { 
        error: 'Failed to parse PDF using structured extraction',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
