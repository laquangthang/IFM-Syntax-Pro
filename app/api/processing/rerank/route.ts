import { NextRequest, NextResponse } from 'next/server'
import { generateRerankSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { baseVar, numRanks, labels } = body
    
    const safeLabels = String(labels || '').split(/\r?\n/).filter(line => line.trim() !== '').join('|||')
    const syntax = generateRerankSyntax(baseVar, parseInt(String(numRanks)), safeLabels)
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
