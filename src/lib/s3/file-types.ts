export const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'text/html': '.html',
  'text/css': '.css',
  'text/xml': '.xml',
  'application/json': '.json',
  'application/javascript': '.js',
  'application/typescript': '.ts',
  'application/x-yaml': '.yaml',
  'application/sql': '.sql',
  'application/x-sh': '.sh',
  'text/x-python': '.py',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export type FileCategory = 'image' | 'pdf' | 'text' | 'office'

export function isAllowedType(mimeType: string): boolean {
  return mimeType in ALLOWED_TYPES
}

export function getExtension(mimeType: string): string {
  return ALLOWED_TYPES[mimeType] || ''
}

export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (
    mimeType.includes('officedocument') ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint'
  ) return 'office'
  return 'text'
}

export function validateFile(fileName: string, fileType: string, fileSize: number): string | null {
  if (!isAllowedType(fileType)) return `File type "${fileType}" is not supported`
  if (fileSize > MAX_FILE_SIZE) return `File size exceeds 10MB limit`
  if (!fileName || fileName.length > 255) return `Invalid file name`
  return null // valid
}
