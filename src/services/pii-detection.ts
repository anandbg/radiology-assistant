// PII Detection Service for UK Healthcare Data
import type { PIIResult, PIIEntity } from '../types'

export class PIIDetectionService {
  private static instance: PIIDetectionService
  private ukPostcodeRegex: RegExp
  private nhsNumberRegex: RegExp
  private niNumberRegex: RegExp
  private phoneRegex: RegExp
  private emailRegex: RegExp
  private dobRegex: RegExp
  private creditCardRegex: RegExp

  constructor() {
    // UK-specific regex patterns
    this.ukPostcodeRegex = /\b[A-Z]{1,2}[0-9R][0-9A-Z]? ?[0-9][A-Z]{2}\b/gi
    this.nhsNumberRegex = /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g
    this.niNumberRegex = /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi
    this.phoneRegex = /\b(?:\+44|0)(?:\d{2,3}|\(\d{2,3}\))[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g
    this.emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    this.dobRegex = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g
    this.creditCardRegex = /\b(?:\d{4}[\s-]?){3}\d{4}\b/g
  }

  static getInstance(): PIIDetectionService {
    if (!PIIDetectionService.instance) {
      PIIDetectionService.instance = new PIIDetectionService()
    }
    return PIIDetectionService.instance
  }

  // Main PII detection function
  detectPII(text: string, customPatterns?: Record<string, RegExp>): PIIResult {
    const entities: PIIEntity[] = []
    let sanitizedText = text

    // Detect NHS numbers
    entities.push(...this.detectPattern(
      text, 
      this.nhsNumberRegex, 
      'nhs_number',
      0.95
    ))

    // Detect UK postcodes
    entities.push(...this.detectPattern(
      text, 
      this.ukPostcodeRegex, 
      'postcode',
      0.9
    ))

    // Detect NI numbers
    entities.push(...this.detectPattern(
      text, 
      this.niNumberRegex, 
      'nhs_number', // NI numbers are sensitive like NHS numbers
      0.95
    ))

    // Detect phone numbers
    entities.push(...this.detectPattern(
      text, 
      this.phoneRegex, 
      'phone',
      0.85
    ))

    // Detect email addresses
    entities.push(...this.detectPattern(
      text, 
      this.emailRegex, 
      'email',
      0.9
    ))

    // Detect dates of birth
    entities.push(...this.detectPattern(
      text, 
      this.dobRegex, 
      'dob',
      0.8
    ))

    // Detect credit card numbers
    entities.push(...this.detectPattern(
      text, 
      this.creditCardRegex, 
      'phone', // Treat as sensitive
      0.9
    ))

    // Detect custom patterns if provided
    if (customPatterns) {
      Object.entries(customPatterns).forEach(([type, regex]) => {
        entities.push(...this.detectPattern(
          text, 
          regex, 
          type as PIIEntity['type'],
          0.8
        ))
      })
    }

    // Detect person names using simple heuristics
    entities.push(...this.detectPersonNames(text))

    // Sort entities by position and remove duplicates
    const uniqueEntities = this.deduplicateEntities(entities)
    uniqueEntities.sort((a, b) => a.start - b.start)

    // Create sanitized text
    if (uniqueEntities.length > 0) {
      sanitizedText = this.sanitizeText(text, uniqueEntities)
    }

    return {
      detected: uniqueEntities.length > 0,
      entities: uniqueEntities,
      sanitized_text: sanitizedText
    }
  }

  // Detect patterns using regex
  private detectPattern(
    text: string, 
    regex: RegExp, 
    type: PIIEntity['type'],
    confidence: number
  ): PIIEntity[] {
    const entities: PIIEntity[] = []
    let match

    // Reset regex to ensure global search works correctly
    regex.lastIndex = 0

    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        confidence
      })

      // Prevent infinite loop on zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++
      }
    }

    return entities
  }

  // Simple person name detection using common patterns
  private detectPersonNames(text: string): PIIEntity[] {
    const entities: PIIEntity[] = []
    
    // Common UK name patterns
    const namePatterns = [
      // Dr. Title Name
      /\bDr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      // Mr/Mrs/Ms Title Name
      /\b(?:Mr|Mrs|Ms|Miss)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      // Patient Name: Pattern
      /\bPatient\s*(?:Name)?:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
      // Name: Pattern at start of lines
      /^Name:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gm,
    ]

    namePatterns.forEach(pattern => {
      let match
      pattern.lastIndex = 0
      
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0]
        const nameOnly = match[1]
        
        // Calculate the actual position of the name within the match
        const nameStart = match.index + fullMatch.indexOf(nameOnly)
        
        entities.push({
          type: 'name',
          value: nameOnly,
          start: nameStart,
          end: nameStart + nameOnly.length,
          confidence: 0.7
        })

        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++
        }
      }
    })

    return entities
  }

  // Remove duplicate entities
  private deduplicateEntities(entities: PIIEntity[]): PIIEntity[] {
    const unique = new Map<string, PIIEntity>()

    entities.forEach(entity => {
      const key = `${entity.start}-${entity.end}-${entity.value}`
      const existing = unique.get(key)
      
      if (!existing || entity.confidence > existing.confidence) {
        unique.set(key, entity)
      }
    })

    return Array.from(unique.values())
  }

  // Create sanitized text by replacing PII
  private sanitizeText(text: string, entities: PIIEntity[]): string {
    let sanitized = text
    let offset = 0

    // Sort entities by start position
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start)

    sortedEntities.forEach(entity => {
      const replacement = this.getReplacementText(entity)
      const start = entity.start + offset
      const end = entity.end + offset
      
      sanitized = sanitized.slice(0, start) + replacement + sanitized.slice(end)
      offset += replacement.length - (entity.end - entity.start)
    })

    return sanitized
  }

  // Get appropriate replacement text for PII type
  private getReplacementText(entity: PIIEntity): string {
    switch (entity.type) {
      case 'nhs_number':
        return '[NHS_NUMBER]'
      case 'postcode':
        return '[POSTCODE]'
      case 'phone':
        return '[PHONE]'
      case 'email':
        return '[EMAIL]'
      case 'name':
        return '[PATIENT_NAME]'
      case 'address':
        return '[ADDRESS]'
      case 'dob':
        return '[DATE_OF_BIRTH]'
      default:
        return '[REDACTED]'
    }
  }

  // Check if text contains high-risk PII
  isHighRiskPII(entities: PIIEntity[]): boolean {
    const highRiskTypes = ['nhs_number', 'name', 'address', 'dob']
    return entities.some(entity => 
      highRiskTypes.includes(entity.type) && entity.confidence > 0.8
    )
  }

  // Get PII summary for logging/audit
  getPIISummary(result: PIIResult): {
    total_entities: number
    types_detected: string[]
    high_risk: boolean
    confidence_avg: number
  } {
    const types = [...new Set(result.entities.map(e => e.type))]
    const avgConfidence = result.entities.length > 0 
      ? result.entities.reduce((sum, e) => sum + e.confidence, 0) / result.entities.length
      : 0

    return {
      total_entities: result.entities.length,
      types_detected: types,
      high_risk: this.isHighRiskPII(result.entities),
      confidence_avg: Math.round(avgConfidence * 100) / 100
    }
  }

  // Validate UK NHS number format
  private isValidNHSNumber(value: string): boolean {
    // Remove spaces and hyphens
    const clean = value.replace(/[\s-]/g, '')
    
    if (clean.length !== 10 || !/^\d{10}$/.test(clean)) {
      return false
    }

    // NHS number check digit validation
    const digits = clean.split('').map(Number)
    const checkDigit = digits[9]
    
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i)
    }
    
    const remainder = sum % 11
    const expectedCheckDigit = remainder < 2 ? 0 : 11 - remainder
    
    return checkDigit === expectedCheckDigit
  }

  // Validate UK National Insurance number
  private isValidNINumber(value: string): boolean {
    const clean = value.replace(/\s/g, '').toUpperCase()
    
    // Basic format check
    if (!/^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(clean)) {
      return false
    }

    // Check for invalid prefixes
    const invalidPrefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ']
    const prefix = clean.substring(0, 2)
    
    return !invalidPrefixes.includes(prefix)
  }

  // Enhanced validation method
  validateDetectedPII(entities: PIIEntity[]): PIIEntity[] {
    return entities.map(entity => {
      let confidence = entity.confidence

      // Enhance confidence based on validation
      switch (entity.type) {
        case 'nhs_number':
          if (this.isValidNHSNumber(entity.value)) {
            confidence = Math.min(confidence + 0.1, 1.0)
          } else {
            confidence = Math.max(confidence - 0.2, 0.3)
          }
          break
        case 'postcode':
          // UK postcode validation could be added here
          break
      }

      return { ...entity, confidence }
    }).filter(entity => entity.confidence > 0.3) // Filter out low-confidence detections
  }
}