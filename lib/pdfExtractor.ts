/**
 * PDF Text Extraction Service
 * Uses ConvertAPI to convert PDF → XLSX for accurate table extraction
 * Then parses XLSX to extract text and tables as markdown
 */

import ConvertAPI from 'convertapi'
import * as XLSX from 'xlsx'

export interface ExtractedPage {
  pageNumber: number
  text: string
  markdown: string // Markdown format with tables preserved
  workbook?: XLSX.WorkBook // XLSX workbook for direct parsing (attached to first page)
}

// Initialize ConvertAPI (will use CONVERTAPI_SECRET from env)
let convertapi: ConvertAPI | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(err: any): boolean {
  const msg = String(err?.message || err || '')
  // Network/transient errors we should retry
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('429') ||
    msg.includes('503')
  )
}

async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number }
): Promise<T> {
  const retries = opts?.retries ?? 3
  const baseDelayMs = opts?.baseDelayMs ?? 800

  let lastErr: any
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      // Don't retry on missing secret or clearly non-retryable errors
      const msg = String(err?.message || err || '')
      if (msg.includes('CONVERTAPI_SECRET')) throw err
      if (!isRetryableError(err) || attempt === retries) throw err

      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      console.warn(`   ⚠️  ${label} failed (${msg}). Waiting ${delay}ms before retry...`)
      await sleep(delay)
    }
  }
  throw lastErr
}

function getConvertAPI(): ConvertAPI {
  if (!convertapi) {
    const secret = process.env.CONVERTAPI_SECRET
    if (!secret) {
      throw new Error(
        'CONVERTAPI_SECRET environment variable is not set.\n' +
        'Please:\n' +
        '1. Get your free API key from https://www.convertapi.com/\n' +
        '2. Create .env.local file in project root\n' +
        '3. Add: CONVERTAPI_SECRET=your_secret_key_here\n' +
        '4. Restart dev server\n' +
        'See CONVERTAPI_SETUP.md for detailed instructions.'
      )
    }
    convertapi = new ConvertAPI(secret)
  }
  return convertapi
}

/**
 * Helper function to fetch file content from ConvertAPI URL
 */
async function fetchFileContent(url: string): Promise<Buffer> {
  try {
    
    // Try Node.js built-in fetch first (Node 18+)
    try {
      // @ts-ignore - fetch might be available in Node 18+
      if (typeof globalThis.fetch !== 'undefined' || typeof fetch !== 'undefined') {
        // @ts-ignore
        const fetchFn = globalThis.fetch || fetch
        const response = await fetchFn(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'IFM-Syntax-Pro/1.0',
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return buffer
      }
    } catch (fetchError: any) {
    }
    
    // Fallback: Use https/http modules
    const https = require('https')
    const http = require('http')
    const urlModule = require('url')
    
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = urlModule.parse(url)
        const client = parsedUrl.protocol === 'https:' ? https : http
        
        
        const request = client.get(url, (res: any) => {
          
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`))
          }
          
          const chunks: Buffer[] = []
          let totalSize = 0
          
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
            totalSize += chunk.length
          })
          
          res.on('end', () => {
            const buffer = Buffer.concat(chunks)
            resolve(buffer)
          })
          
          res.on('error', (err: Error) => {
            console.error(`   ❌ Response error:`, err.message)
            reject(err)
          })
        })
        
        request.on('error', (err: Error) => {
          console.error(`   ❌ Request error:`, err.message)
          reject(err)
        })
        
        request.setTimeout(60000, () => {
          console.error(`   ❌ Request timeout after 60 seconds`)
          request.destroy()
          reject(new Error('Request timeout after 60 seconds'))
        })
      } catch (err: any) {
        console.error(`   ❌ Error setting up request:`, err.message)
        reject(err)
      }
    })
  } catch (error: any) {
    console.error(`❌ Error fetching file from URL:`, error.message)
    console.error(`   URL: ${url.substring(0, 200)}`)
    console.error(`   Stack:`, error.stack)
    throw new Error(`Failed to fetch file from ConvertAPI URL: ${error.message}`)
  }
}

/**
 * Convert XLSX workbook to markdown format
 */
function xlsxToMarkdown(workbook: XLSX.WorkBook): string {
  const markdownParts: string[] = []
  
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    if (jsonData.length === 0) return
    
    // Add sheet header
    if (workbook.SheetNames.length > 1) {
      markdownParts.push(`## Sheet ${sheetIndex + 1}: ${sheetName}\n`)
    }
    
    // Convert to markdown table
    if (jsonData.length > 0) {
      // Find max columns
      const maxCols = Math.max(...jsonData.map(row => row.length))
      
      // Normalize rows
      const normalizedRows = jsonData.map(row => {
        const normalized = [...row]
        while (normalized.length < maxCols) {
          normalized.push('')
        }
        return normalized.map(cell => {
          const value = cell === null || cell === undefined ? '' : String(cell)
          // Escape pipe characters in markdown
          return value.replace(/\|/g, '\\|').trim()
        })
      })
      
      // Build markdown table
      if (normalizedRows.length > 0) {
        // Header row (first row)
        markdownParts.push('| ' + normalizedRows[0].join(' | ') + ' |')
        markdownParts.push('| ' + normalizedRows[0].map(() => '---').join(' | ') + ' |')
        
        // Data rows
        for (let i = 1; i < normalizedRows.length; i++) {
          markdownParts.push('| ' + normalizedRows[i].join(' | ') + ' |')
        }
      }
    }
    
    markdownParts.push('') // Empty line between sheets
  })
  
  return markdownParts.join('\n')
}

/**
 * Extract text from XLSX (simple text extraction)
 */
function xlsxToText(workbook: XLSX.WorkBook): string {
  const textParts: string[] = []
  
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    if (jsonData.length === 0) return
    
    if (workbook.SheetNames.length > 1) {
      textParts.push(`Sheet ${sheetIndex + 1}: ${sheetName}`)
    }
    
    jsonData.forEach(row => {
      const rowText = row
        .map(cell => cell === null || cell === undefined ? '' : String(cell))
        .filter(cell => cell.trim().length > 0)
        .join(' ')
      
      if (rowText.trim().length > 0) {
        textParts.push(rowText)
      }
    })
    
    textParts.push('') // Empty line between sheets
  })
  
  return textParts.join('\n')
}

/**
 * Extract text from PDF file using ConvertAPI
 * Converts PDF → XLSX for best table extraction, then parses to markdown
 * Returns array of pages with text content and markdown format
 */
export async function extractPDFText(file: File): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  try {
    const convertapi = getConvertAPI()
    // Use require for CommonJS compatibility with stream module
    const { Readable } = require('stream')
    
    // Convert Buffer to ReadableStream
    const bufferToStream = (buf: Buffer) => {
      const readable = new Readable({
        read() {
          // no-op, data is already pushed
        }
      })
      readable.push(buf)
      readable.push(null)
      return readable
    }
    
    // Step 1: Upload PDF file to ConvertAPI
    const pdfStream = bufferToStream(buffer)
    const uploadResult = await withRetries('ConvertAPI upload', () => convertapi.upload(pdfStream, file.name))
    
    // Step 2: Convert PDF to XLSX (preserves tables perfectly)
    const xlsxResult = await withRetries('ConvertAPI convert(pdf→xlsx)', () =>
      convertapi.convert(
        'xlsx',
        {
          File: uploadResult,
          // NOTE: Storing file reduces response payload and is more reliable on flaky networks.
          // We'll download via Url afterward.
          StoreFile: true,
        },
        'pdf'
      )
    )
    
    // Step 3: Get XLSX file content
    let xlsxBuffer: Buffer
    
    try {
      // ConvertAPI typically returns Files array with Url property
      // Format: { ConversionCost: 1, Files: [{ FileName, FileExt, FileSize, FileId, Url }] }
      // Or SDK might return: result.files (lowercase) or result.file (singular)
      const xlsxFile = xlsxResult.Files?.[0] || xlsxResult.files?.[0] || xlsxResult.file
      
      // Try to get file content
      if (xlsxFile?.FileData) {
        // FileData is base64 encoded (if StoreFile: false worked)
        xlsxBuffer = Buffer.from(xlsxFile.FileData, 'base64')
      } else if (xlsxFile?.Url) {
        // Fetch from URL (most common case) - uppercase Url
        xlsxBuffer = await withRetries('Download XLSX (Url)', () => fetchFileContent(xlsxFile.Url))
      } else if (xlsxFile?.url) {
        // Fetch from URL - lowercase url
        xlsxBuffer = await withRetries('Download XLSX (url)', () => fetchFileContent(xlsxFile.url))
      } else {
        // Try alternative URL formats
        const xlsxUrl = xlsxResult.file?.url || xlsxResult.url || xlsxResult.Files?.[0]?.url || xlsxResult.Files?.[0]?.Url
        if (xlsxUrl) {
          xlsxBuffer = await withRetries('Download XLSX (alt url)', () => fetchFileContent(xlsxUrl))
        } else {
          // Try SDK save method to get buffer (if available)
          if (typeof xlsxResult.saveFiles === 'function') {
            // This would save to disk, not what we want
            throw new Error('SDK saveFiles method requires disk write, not suitable for buffer extraction')
          }
          
          // Log safe response structure
          const safeErrorResponse: any = {}
          if ('ConversionCost' in xlsxResult) safeErrorResponse.ConversionCost = (xlsxResult as any).ConversionCost
          if ('Files' in xlsxResult) safeErrorResponse.hasFiles = Array.isArray((xlsxResult as any).Files)
          if ('files' in xlsxResult) safeErrorResponse.hasfiles = Array.isArray((xlsxResult as any).files)
          if ('file' in xlsxResult) safeErrorResponse.hasfile = !!(xlsxResult as any).file
          console.error('❌ ConvertAPI response structure (safe):', JSON.stringify(safeErrorResponse, null, 2))
          throw new Error('No XLSX file URL or FileData returned from ConvertAPI. Check console for response structure.')
        }
      }
    } catch (error: any) {
      console.error('❌ Error getting XLSX file content:', error.message)
      console.error('   Stack:', error.stack)
      throw new Error(`Failed to get XLSX file from ConvertAPI: ${error.message}`)
    }
    
    // Step 4: Parse XLSX
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(xlsxBuffer, { type: 'buffer' })
    } catch (parseError: any) {
      console.error('❌ Error parsing XLSX:', parseError.message)
      console.error('   Stack:', parseError.stack)
      throw new Error(`Failed to parse XLSX file: ${parseError.message}`)
    }
    
    // Convert to markdown and text (for backward compatibility with structureDetector)
    const markdownContent = xlsxToMarkdown(workbook)
    const textContent = xlsxToText(workbook)
    
    
    // Store workbook for direct XLSX parsing
    ;(workbook as any)._rawBuffer = xlsxBuffer
    
    // Step 5: Split into pages (by sheets or evenly)
    const pages = splitIntoPages(markdownContent, textContent, workbook.SheetNames.length)
    
    // Attach workbook to first page for XLSX parsing
    if (pages.length > 0) {
      ;(pages[0] as any).workbook = workbook
    }
    
    if (pages.length === 0) {
      throw new Error('No content extracted from PDF')
    }
    
    
    return pages
  } catch (error: any) {
    // If ConvertAPI fails, provide helpful error message
    if (error.message?.includes('CONVERTAPI_SECRET')) {
      throw error
    }
    
    console.error('❌ ConvertAPI error:', error.message)
    console.error('   Stack:', error.stack)
    throw new Error(`Failed to extract PDF using ConvertAPI: ${error.message}`)
  }
}

/**
 * Split content into pages
 */
function splitIntoPages(markdown: string, text: string, sheetCount: number): ExtractedPage[] {
  // If we have multiple sheets, split by sheets
  if (sheetCount > 1) {
    const sheetMarkers = markdown.split(/^## Sheet \d+:/gm)
    const sheetTexts = text.split(/^Sheet \d+:/gm)
    
    const pages: ExtractedPage[] = []
    
    for (let i = 0; i < Math.max(sheetMarkers.length, sheetTexts.length); i++) {
      const markdownPage = i === 0 ? sheetMarkers[0] : (sheetMarkers[i] || '').trim()
      const textPage = i === 0 ? sheetTexts[0] : (sheetTexts[i] || '').trim()
      
      if (markdownPage.trim().length > 0 || textPage.trim().length > 0) {
        pages.push({
          pageNumber: i + 1,
          text: textPage || markdownPage.replace(/\|/g, ' ').replace(/-/g, ' '),
          markdown: markdownPage || textPage,
        })
      }
    }
    
    return pages.length > 0 ? pages : [{
      pageNumber: 1,
      text: text.trim(),
      markdown: markdown.trim(),
    }]
  }
  
  // Single sheet: split evenly if content is long
  if (text.length > 10000) {
    const lines = text.split('\n')
    const linesPerPage = Math.ceil(lines.length / 3)
    const pages: ExtractedPage[] = []
    
    for (let i = 0; i < lines.length; i += linesPerPage) {
      const textPage = lines.slice(i, i + linesPerPage).join('\n')
      const mdLines = markdown.split('\n')
      const mdLinesPerPage = Math.ceil(mdLines.length / Math.ceil(lines.length / linesPerPage))
      const mdStart = Math.floor(i / linesPerPage) * mdLinesPerPage
      const markdownPage = mdLines.slice(mdStart, mdStart + mdLinesPerPage).join('\n')
      
      pages.push({
        pageNumber: pages.length + 1,
        text: textPage.trim(),
        markdown: markdownPage.trim(),
      })
    }
    
    return pages
  }
  
  // Single page
  return [{
    pageNumber: 1,
    text: text.trim(),
    markdown: markdown.trim(),
  }]
}

/**
 * Extract text as simple string
 */
export async function extractPDFTextSimple(file: File): Promise<string> {
  const pages = await extractPDFText(file)
  return pages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n')
}

/**
 * Extract text as markdown (with tables preserved)
 */
export async function extractPDFTextAsMarkdown(file: File): Promise<string> {
  const pages = await extractPDFText(file)
  return pages.map(p => {
    return `## Page ${p.pageNumber}\n\n${p.markdown}`
  }).join('\n\n')
}
