/**
 * PDF Text Extraction Service
 * Extracts text from PDF with position information for structure detection
 */

import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
// Note: For Next.js, we'll use a simpler approach that works on both client and server
try {
  if (typeof window === 'undefined') {
    // Server-side: try to use Node.js worker, fallback to CDN
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs')
    } catch {
      // Fallback: use CDN even on server (may not work, but won't crash)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    }
  } else {
    // Client-side: use CDN worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }
} catch (e) {
  // If worker setup fails, PDF.js will use a fallback
  console.warn('PDF.js worker setup failed, using fallback:', e)
}

export interface TextBlock {
  text: string
  page: number
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
}

export interface ExtractedPage {
  pageNumber: number
  text: string
  textBlocks: TextBlock[]
}

/**
 * Extract text from PDF file with position information
 */
export async function extractPDFText(file: File): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  const pages: ExtractedPage[] = []
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    
    // Extract text blocks with positions
    const textBlocks: TextBlock[] = []
    let fullText = ''
    
    textContent.items.forEach((item: any) => {
      if (item.str) {
        const transform = item.transform
        const x = transform[4]
        const y = transform[5]
        const fontSize = item.height || transform[0]
        
        textBlocks.push({
          text: item.str,
          page: pageNum,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
        })
        
        fullText += item.str + ' '
      }
    })
    
    pages.push({
      pageNumber: pageNum,
      text: fullText.trim(),
      textBlocks,
    })
  }
  
  return pages
}

/**
 * Extract text as simple string (for AI processing)
 */
export async function extractPDFTextSimple(file: File): Promise<string> {
  const pages = await extractPDFText(file)
  return pages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n')
}
