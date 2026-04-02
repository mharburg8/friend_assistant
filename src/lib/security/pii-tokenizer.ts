/**
 * PII Tokenizer — replaces sensitive data with tokens before sending to Claude,
 * then restores originals in the response.
 *
 * Detected PII types:
 * - SSN (xxx-xx-xxxx)
 * - Credit card numbers (13-19 digits)
 * - Email addresses
 * - Phone numbers (US formats)
 * - IP addresses
 * - Street addresses (number + street name + type)
 * - Dates of birth (common formats)
 * - Bank account / routing numbers (labeled)
 */

interface TokenMap {
  [token: string]: string
}

// Patterns ordered from most specific to least to avoid partial matches
const PII_PATTERNS: Array<{ name: string; regex: RegExp; prefix: string }> = [
  {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    prefix: 'SSN',
  },
  {
    name: 'credit_card',
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    prefix: 'CC',
  },
  {
    name: 'email',
    regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    prefix: 'EMAIL',
  },
  {
    name: 'phone',
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    prefix: 'PHONE',
  },
  {
    name: 'ip_address',
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    prefix: 'IP',
  },
  {
    name: 'street_address',
    regex: /\b\d{1,6}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place|Cir|Circle)\b\.?/g,
    prefix: 'ADDR',
  },
  {
    name: 'date_of_birth',
    regex: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g,
    prefix: 'DOB',
  },
  {
    name: 'account_number',
    regex: /(?:account|acct|routing)[\s#:]*\d{6,17}\b/gi,
    prefix: 'ACCT',
  },
]

let counter = 0

export function tokenizePII(text: string): { tokenized: string; tokenMap: TokenMap } {
  const tokenMap: TokenMap = {}
  let result = text

  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, (match) => {
      // Skip if it's clearly not PII (e.g., short number sequences that are years or counts)
      if (pattern.name === 'credit_card') {
        const digits = match.replace(/\D/g, '')
        if (digits.length < 13) return match
      }

      const token = `[${pattern.prefix}_${++counter}]`
      tokenMap[token] = match
      return token
    })
  }

  return { tokenized: result, tokenMap }
}

export function detokenizePII(text: string, tokenMap: TokenMap): string {
  let result = text
  for (const [token, original] of Object.entries(tokenMap)) {
    // Replace all occurrences — Claude might repeat the token
    result = result.split(token).join(original)
  }
  return result
}

/**
 * Tokenize an array of chat messages, returning new messages + combined token map.
 */
export function tokenizeMessages(
  messages: Array<{ role: string; content: string }>
): { messages: Array<{ role: string; content: string }>; tokenMap: TokenMap } {
  const combinedMap: TokenMap = {}

  const tokenizedMessages = messages.map(m => {
    const { tokenized, tokenMap } = tokenizePII(m.content)
    Object.assign(combinedMap, tokenMap)
    return { ...m, content: tokenized }
  })

  return { messages: tokenizedMessages, tokenMap: combinedMap }
}

/**
 * Reset counter between requests to keep tokens predictable per-request.
 */
export function resetTokenCounter() {
  counter = 0
}
