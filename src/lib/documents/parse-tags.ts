export interface DocumentTag {
  fileName: string
  content: string
}

/**
 * Parse [DOCUMENT: filename.ext] ... [/DOCUMENT] tags from Claude's response.
 * Returns the documents found and the response text with tags removed.
 */
export function parseDocumentTags(response: string): {
  documents: DocumentTag[]
  cleanedResponse: string
} {
  const documents: DocumentTag[] = []
  let cleanedResponse = response

  const regex = /\[DOCUMENT:\s*(.+?)\]\n([\s\S]*?)\[\/DOCUMENT\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(response)) !== null) {
    documents.push({
      fileName: match[1].trim(),
      content: match[2].trim(),
    })
    cleanedResponse = cleanedResponse.replace(match[0], `**Document generated: ${match[1].trim()}** (see attachment below)`)
  }

  return { documents, cleanedResponse }
}

export function getDocumentFormat(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md': return 'markdown'
    case 'pdf': return 'pdf'
    case 'docx': return 'docx'
    case 'xlsx': return 'xlsx'
    case 'pptx': return 'pptx'
    default: return 'markdown'
  }
}
