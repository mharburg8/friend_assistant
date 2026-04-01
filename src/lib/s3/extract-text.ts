import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { getFileCategory } from './file-types'

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const category = getFileCategory(mimeType)

  if (category === 'text') {
    return buffer.toString('utf-8')
  }

  if (category === 'office') {
    return extractOfficeText(buffer, mimeType, fileName)
  }

  // Images and PDFs handled separately (sent as content blocks)
  return ''
}

async function extractOfficeText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  // Word documents
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return `[File: ${fileName}]\n${result.value}`
  }

  // Excel spreadsheets
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      sheets.push(`[Sheet: ${sheetName}]\n${csv}`)
    }
    return `[File: ${fileName}]\n${sheets.join('\n\n')}`
  }

  // PowerPoint presentations
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/vnd.ms-powerpoint'
  ) {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buffer)
      const slideTexts: string[] = []
      const slideFiles = Object.keys(zip.files)
        .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort()

      for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async('text')
        // Strip XML tags to get plain text
        const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (text) {
          const slideNum = slideFile.match(/slide(\d+)/)?.[1]
          slideTexts.push(`[Slide ${slideNum}]\n${text}`)
        }
      }
      return `[File: ${fileName}]\n${slideTexts.join('\n\n')}`
    } catch {
      return `[File: ${fileName}]\n(Could not extract text from PowerPoint file)`
    }
  }

  return `[File: ${fileName}]\n(Unsupported office format for text extraction)`
}
