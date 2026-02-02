/**
 * SPSS Processing Syntax Generators
 * Converted from the original Node.js server.js
 */

export function generateTopboxSyntax(
  varNames: string,
  varLabels: string,
  t2b: string,
  nonT2b: string,
  b2b: string,
  nonB2b: string
): string {
  let syntax = ''
  const varNamesArray = varNames.split(',').map(v => v.trim())
  const varLabelsArray = varLabels.split('|||')

  const t2bValues = String(t2b || '').split(',').map(v => v.trim()).filter(v => v)
  const nonT2bValues = String(nonT2b || '').split(',').map(v => v.trim()).filter(v => v)
  const b2bValues = String(b2b || '').split(',').map(v => v.trim()).filter(v => v)
  const nonB2bValues = String(nonB2b || '').split(',').map(v => v.trim()).filter(v => v)

  const tBoxCount = t2bValues.length
  const bBoxCount = b2bValues.length

  varNamesArray.forEach((varName, i) => {
    const varLabel = varLabelsArray[i] || ''
    
    if (tBoxCount > 0) {
      const tBoxSuffix = `_T${tBoxCount}B`
      const tBoxLabel = `T${tBoxCount}B`
      syntax += `recode ${varName} (${t2bValues.join(',')}=1) (${nonT2bValues.join(',')}=2) into ${varName}${tBoxSuffix}.\n`
      syntax += `var lab ${varName}${tBoxSuffix} "${varName}. ${varLabel} - ${tBoxLabel}".\n`
      syntax += `val lab ${varName}${tBoxSuffix}\n    1"${tBoxLabel}"\n    2"DEL (R)".\n`
    }
    if (bBoxCount > 0) {
      const bBoxSuffix = `_B${bBoxCount}B`
      const bBoxLabel = `B${bBoxCount}B`
      syntax += `recode ${varName} (${b2bValues.join(',')}=1) (${nonB2bValues.join(',')}=2) into ${varName}${bBoxSuffix}.\n`
      syntax += `var lab ${varName}${bBoxSuffix} "${varName}. ${varLabel} - ${bBoxLabel}".\n`
      syntax += `val lab ${varName}${bBoxSuffix}\n    1"${bBoxLabel}"\n    2"DEL (R)".\n`
    }
    if (tBoxCount > 0 || bBoxCount > 0) {
      syntax += `*=============================================.\n\n`
    }
  })
  return syntax
}

export function generateRerankSyntax(
  baseVar: string,
  numRanks: number,
  labels: string
): string {
  let syntax = ''
  const labelsArray = labels.split('|||')
  const numOptions = labelsArray.length
  
  for (let rankNum = 1; rankNum <= numRanks; rankNum++) {
    for (let optionNum = 1; optionNum <= numOptions; optionNum++) {
      syntax += `IF ${baseVar}_${optionNum}=${rankNum} ${baseVar}_Rank${rankNum}=${optionNum}.\n`
    }
    syntax += '\n'
  }

  syntax += '* Variable Labels.\n'
  const outputVars: string[] = []
  for (let rankNum = 1; rankNum <= numRanks; rankNum++) {
    const outputVar = `${baseVar}_Rank${rankNum}`
    outputVars.push(outputVar)
    syntax += `var lab ${outputVar} "${baseVar}. Rank ${rankNum}".\n`
  }
  syntax += '\n'

  syntax += '* Value Labels.\n'
  if (outputVars.length > 1) {
    syntax += `val lab ${outputVars[0]} to ${outputVars[outputVars.length - 1]}\n`
  } else if (outputVars.length === 1) {
    syntax += `val lab ${outputVars[0]}\n`
  }
  labelsArray.forEach((label, i) => {
    syntax += `    ${i + 1}"${label}"\n`
  })
  syntax += '.\n'
  return syntax
}

export function generateReloopSyntax(
  questionName: string,
  numAttributes: number,
  numBrands: number,
  rebaseQuestion: string,
  brandNames: string,
  attributeTexts: string
): string {
  let syntax = ''
  const brandNamesArray = brandNames.split('|||')
  const attributeTextsArray = attributeTexts.split('|||')

  syntax += `/* Reloop ${questionName} */\n\n`
  for (let brand_i = 1; brand_i <= numBrands; brand_i++) {
    for (let attr_j = 1; attr_j <= numAttributes; attr_j++) {
      syntax += `if ${questionName}_${attr_j}R${brand_i} = ${brand_i} re_${questionName}_${brand_i}R${attr_j} = ${attr_j}.\n`
    }
    const misConditions = Array.from({ length: parseInt(String(numAttributes)) }, (_, i) => `mis(${questionName}_${i + 1}R${brand_i})`).join(' and\n   ')
    const lastAttrCode = parseInt(String(numAttributes)) + 1
    syntax += `if ${rebaseQuestion}R${brand_i} = ${brand_i} and\n   ${misConditions} re_${questionName}_${brand_i}R${lastAttrCode} = ${lastAttrCode}.\n\n`
  }

  syntax += '/* ===== 1. Variable Labels ===== */\n'
  for (let brand_i = 1; brand_i <= numBrands; brand_i++) {
    const brandName = brandNamesArray[brand_i - 1] || ''
    for (let attr_j = 1; attr_j <= numAttributes; attr_j++) {
      const attrText = attributeTextsArray[attr_j - 1] || ''
      syntax += `var lab re_${questionName}_${brand_i}R${attr_j} "${questionName}-${brandName}. ${attrText}".\n`
    }
    const lastAttrIndex = parseInt(String(numAttributes)) + 1
    syntax += `var lab re_${questionName}_${brand_i}R${lastAttrIndex} "${questionName}-${brandName}. Rebase ${rebaseQuestion}".\n\n`
  }

  syntax += '/* ===== 2. Value Labels ===== */\n'
  const startVar = `re_${questionName}_1R1`
  const endVar = `re_${questionName}_${numBrands}R${parseInt(String(numAttributes)) + 1}`
  syntax += `val lab ${startVar} to ${endVar}\n`
  for (let attr_j = 1; attr_j <= numAttributes; attr_j++) {
    const attrText = attributeTextsArray[attr_j - 1] || ''
    syntax += `    ${attr_j}"${attrText}"\n`
  }
  const lastAttrIndex = parseInt(String(numAttributes)) + 1
  syntax += `    ${lastAttrIndex}"Rebase ${rebaseQuestion}".\n`
  
  return syntax
}

export function generateRestructSyntax(
  variables: string,
  numBrands: number,
  brandNames: string,
  outputVars: string,
  keepVars?: string,
  indexVarName?: string,
  variablesByCode?: { [code: string]: string[] },
  questionIds?: string[]
): string {
  // New format: if variablesByCode is provided, use Grid question format
  if (variablesByCode && Object.keys(variablesByCode).length > 0 && questionIds && questionIds.length > 0) {
    const brandList = (brandNames || '').split('\n').map(b => b.trim()).filter(b => b)
    return generateGridRestructSyntax(
      variablesByCode,
      numBrands,
      brandList,
      indexVarName || 'INDEX_VAR',
      keepVars,
      questionIds
    )
  }

  // Old format: manual input
  const variableList = variables.split('\n').map(v => v.trim()).filter(v => v)
  const outputVarList = (outputVars || '').split('\n').map(v => v.trim()).filter(v => v)
  const brandList = (brandNames || '').split('\n').map(b => b.trim()).filter(b => b)

  if (!Number.isFinite(numBrands) || numBrands <= 0) {
    throw new Error('Số lượng brand không hợp lệ')
  }

  const totalVars = variableList.length
  const numGroups = Math.ceil(totalVars / numBrands)

  function deriveOutputName(fromVar: string): string {
    const m = fromVar.match(/^(.*?)(?:_\d+)(?:(_O))?$/)
    if (m) return m[1] + (m[2] || '')
    return fromVar
  }

  let syntax = ''
  syntax += `VARSTOCASES\n`

  const usedOutputVars: string[] = []
  for (let g = 0; g < numGroups; g++) {
    const start = g * numBrands
    const end = Math.min(start + numBrands, totalVars)
    const fromVars = variableList.slice(start, end)
    if (fromVars.length === 0) continue
    const outVar = outputVarList[g] || deriveOutputName(fromVars[0])
    usedOutputVars.push(outVar)
    syntax += ` /MAKE ${outVar} FROM ${fromVars.join(' ')}\n`
  }

  syntax += ` /INDEX = ${indexVarName || 'BRAND'}(${numBrands})\n`
  if (keepVars && keepVars.trim()) {
    const keepList = keepVars.split(',').map(v => v.trim()).filter(Boolean).join(' ')
    syntax += ` /KEEP = ${keepList}\n`
  }
  syntax += `.\n\n`

  // Variable labels cho INDEX
  if (indexVarName) {
    syntax += `VARIABLE LABELS ${indexVarName} '${indexVarName}'.\n`
  }

  // Value labels cho INDEX (nếu brandNames có nhập)
  if (brandList.length > 0) {
    syntax += `VALUE LABELS ${indexVarName || 'BRAND'}\n`
    brandList.forEach((brand, index) => {
      syntax += ` ${index + 1} '${brand}'\n`
    })
    syntax += '.\n\n'
  }

  // Variable labels cho các biến output
  usedOutputVars.forEach(outputVar => {
    syntax += `VARIABLE LABELS ${outputVar} '${outputVar}'.\n`
  })

  return syntax
}

/**
 * Generate Restruct syntax for Grid questions
 * Format: /MAKE Q8_R1 FROM Q8_1R1 Q8_2R1 ... /MAKE Q8_R2 FROM Q8_1R2 Q8_2R2 ...
 */
function generateGridRestructSyntax(
  variablesByCode: { [code: string]: string[] },
  numBrands: number,
  brandNames: string[],
  indexVarName: string,
  keepVars?: string,
  questionIds?: string[]
): string {
  let syntax = ''
  syntax += `VARSTOCASES\n`

  // Get all codes sorted
  const codes = Object.keys(variablesByCode).sort((a, b) => {
    const numA = parseInt(a.replace('R', ''), 10)
    const numB = parseInt(b.replace('R', ''), 10)
    return numA - numB
  })

  // Generate /MAKE statements for each code and each question
  questionIds?.forEach(questionId => {
    codes.forEach(code => {
      const vars = variablesByCode[code] || []
      // Filter variables for this question
      const questionVars = vars.filter(v => v.startsWith(questionId + '_'))
      if (questionVars.length > 0) {
        // Output variable: Q8_R1, Q8_R2, etc.
        const outputVar = `${questionId}_${code}`
        syntax += ` /MAKE ${outputVar} FROM ${questionVars.join(' ')}\n`
      }
    })
  })

  syntax += ` /INDEX=${indexVarName}(${numBrands})\n`
  if (keepVars && keepVars.trim()) {
    const keepList = keepVars.split(',').map(v => v.trim()).filter(Boolean).join(' ')
    syntax += ` /KEEP=${keepList}\n`
  }
  syntax += `.\n\n`

  // Variable labels cho INDEX
  syntax += `VARIABLE LABELS ${indexVarName} '${indexVarName}'.\n`

  // Value labels cho INDEX
  if (brandNames.length > 0) {
    syntax += `VALUE LABELS ${indexVarName}\n`
    brandNames.forEach((brand, index) => {
      syntax += ` ${index + 1} '${brand}'\n`
    })
    syntax += '.\n\n'
  }

  // Variable labels cho các biến output
  questionIds?.forEach(questionId => {
    codes.forEach(code => {
      const outputVar = `${questionId}_${code}`
      syntax += `VARIABLE LABELS ${outputVar} '${outputVar}'.\n`
    })
  })

  return syntax
}

export function generateRecodeMeansSyntax(
  ranges: string,
  variables: string,
  means: string,
  codes: string
): string {
  let syntax = ''
  
  const rangeLines = ranges.split('\n').map(line => line.trim()).filter(line => line)
  const variableLines = variables.split('\n').map(line => line.trim()).filter(line => line)
  const meanLines = means.split('\n').map(line => line.trim()).filter(line => line)
  const codeLines = codes.split('\n').map(line => line.trim()).filter(line => line)
  
  if (rangeLines.length !== meanLines.length || rangeLines.length !== codeLines.length) {
    throw new Error('Số lượng ranges, means và codes phải bằng nhau')
  }
  
  // Tạo syntax cho từng biến
  variableLines.forEach(variable => {
    syntax += `recode ${variable}`
    
    // Tạo recode statements
    codeLines.forEach((code, index) => {
      const mean = meanLines[index]
      syntax += ` (${code} = ${mean})`
    })
    
    syntax += ` into ${variable}_means.\n`
    
    // Variable label
    syntax += `var lab ${variable}_means "${variable}. Mean".\n\n`
  })
  
  return syntax
}

export function generateNetcodeSyntax(
  questionName: string,
  codes: string,
  labels: string
): string {
  let syntax = ''
  
  const codeLines = codes.split('\n').map(line => line.trim()).filter(line => line)
  const labelLines = labels.split('\n').map(line => line.trim()).filter(line => line)
  
  if (codeLines.length !== labelLines.length) {
    throw new Error('Số lượng codes và labels phải bằng nhau')
  }
  
  // Tạo comment header với danh sách codes
  const allCodes = codeLines.join(',')
  syntax += `/* ${questionName}-Netcode [${allCodes}] */\n\n`
  
  // Tìm các NET codes và nhóm các codes liên quan
  interface NetGroup {
    netCode: string
    netLabel: string
    relatedCodes: string[]
  }
  
  const netGroups: NetGroup[] = []
  let currentGroup: NetGroup | null = null
  
  codeLines.forEach((code, index) => {
    const label = labelLines[index]
    if (label.includes('[NET]')) {
      // Lưu group trước đó nếu có
      if (currentGroup) {
        netGroups.push(currentGroup)
      }
      // Tạo group mới
      currentGroup = {
        netCode: code,
        netLabel: label.replace(' [NET]', ''),
        relatedCodes: []
      }
    } else if (currentGroup) {
      // Chỉ thêm code vào group nếu không phải là "Others"
      if (!label.toLowerCase().includes('others')) {
        currentGroup.relatedCodes.push(code)
      } else {
        // Nếu gặp "Others", đóng group hiện tại
        netGroups.push(currentGroup)
        currentGroup = null
      }
    }
    // Codes không thuộc group nào (như "Others") sẽ được bỏ qua
  })
  
  // Thêm group cuối cùng
  if (currentGroup) {
    netGroups.push(currentGroup)
  }
  
  // Tạo IF statements cho NET codes
  netGroups.forEach(group => {
    if (group.relatedCodes.length > 0) {
      const ifConditions = group.relatedCodes.map(code => `${questionName}R${code}=${code}`).join(' OR ')
      syntax += `IF ${ifConditions} ${questionName}R${group.netCode}=${group.netCode}.\n`
    }
  })
  
  syntax += '\n'
  
  // Tạo Variable Labels cho NET codes
  netGroups.forEach(group => {
    syntax += `Var lab ${questionName}R${group.netCode}"${questionName}. ${group.netLabel}".\n`
  })
  
  syntax += '\n'
  
  // Tạo Value Labels - tất cả các biến
  const allVarNames: string[] = []
  
  // Thêm các biến regular codes
  codeLines.forEach((code, index) => {
    const label = labelLines[index]
    if (!label.includes('[NET]')) {
      allVarNames.push(`${questionName}R${code}`)
    }
  })
  
  // Thêm các biến NET codes
  netGroups.forEach(group => {
    allVarNames.push(`${questionName}R${group.netCode}`)
  })
  
  syntax += `val lab ${allVarNames.join(' ')}\n`
  
  // Thêm labels cho regular codes
  codeLines.forEach((code, index) => {
    const label = labelLines[index]
    if (!label.includes('[NET]')) {
      syntax += `${code}"${label}"\n`
    }
  })
  
  // Thêm labels cho NET codes
  netGroups.forEach(group => {
    syntax += `${group.netCode}"${group.netLabel} [NET]"\n`
  })
  
  syntax += '.\n'
  
  return syntax
}
