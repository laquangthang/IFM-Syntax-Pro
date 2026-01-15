import { NextRequest, NextResponse } from 'next/server'
import { generateRestructSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Auto mode: Grid questions
    if (body.variablesByCode && body.questionIds) {
      const { variablesByCode, numBrands, brandNames, indexVarName, keepVars, questionIds } = body
      
      // Convert brandNames to array if it's a string
      const brandNamesArray = Array.isArray(brandNames) 
        ? brandNames 
        : (typeof brandNames === 'string' ? brandNames.split('\n').filter(b => b.trim()) : [])
      
      const syntax = generateRestructSyntax(
        '', // variables not needed for auto mode
        parseInt(String(numBrands)),
        brandNamesArray,
        '', // outputVars not needed for auto mode
        keepVars,
        indexVarName,
        variablesByCode,
        questionIds
      )
      
      return NextResponse.json({ success: true, syntax })
    }
    
    // Manual mode
    const { variables, numBrands, brandNames, outputVars, keepVars, indexVarName } = body
    
    const syntax = generateRestructSyntax(
      variables, 
      parseInt(String(numBrands)), 
      brandNames, 
      outputVars, 
      keepVars,
      indexVarName
    )
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
