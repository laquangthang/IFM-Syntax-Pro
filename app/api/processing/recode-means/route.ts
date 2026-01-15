import { NextRequest, NextResponse } from 'next/server'
import { generateRecodeMeansSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ranges, variables, means, codes } = body
    
    const syntax = generateRecodeMeansSyntax(ranges, variables, means, codes)
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
