import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import * as XLSX from 'xlsx'
import PptxGenJS from 'pptxgenjs'

export async function generateDocument(
  content: string,
  format: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  switch (format) {
    case 'markdown':
      return {
        buffer: Buffer.from(content, 'utf-8'),
        mimeType: 'text/markdown',
      }
    case 'pdf':
      return generatePdf(content)
    case 'docx':
      return generateDocx(content)
    case 'xlsx':
      return generateXlsx(content)
    case 'pptx':
      return generatePptx(content)
    default:
      return {
        buffer: Buffer.from(content, 'utf-8'),
        mimeType: 'text/markdown',
      }
  }
}

async function generatePdf(markdown: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const chromium = await import('@sparticuz/chromium')
  const puppeteer = await import('puppeteer-core')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chr = chromium.default as any
  const browser = await puppeteer.default.launch({
    args: chr.args,
    defaultViewport: chr.defaultViewport ?? { width: 800, height: 600 },
    executablePath: await chr.executablePath(),
    headless: true,
  })

  const page = await browser.newPage()

  const html = markdownToHtml(markdown)
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; line-height: 1.6; color: #1a1a1a; }
        h1 { font-size: 24px; margin-top: 32px; }
        h2 { font-size: 20px; margin-top: 24px; }
        h3 { font-size: 16px; margin-top: 20px; }
        p { margin: 8px 0; }
        ul, ol { margin: 8px 0; padding-left: 24px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
        pre code { background: none; padding: 0; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f8f8f8; font-weight: 600; }
        hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
        blockquote { border-left: 3px solid #ddd; margin: 16px 0; padding: 8px 16px; color: #555; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `

  await page.setContent(styledHtml, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    printBackground: true,
  })

  await browser.close()

  return { buffer: Buffer.from(pdfBuffer), mimeType: 'application/pdf' }
}

async function generateDocx(markdown: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const lines = markdown.split('\n')
  const children: Paragraph[] = []

  for (const line of lines) {
    if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        children: [new TextRun(line.slice(2))],
        bullet: { level: 0 },
      }))
    } else if (line.match(/^\d+\.\s/)) {
      children.push(new Paragraph({
        children: [new TextRun(line.replace(/^\d+\.\s/, ''))],
        numbering: { reference: 'default-numbering', level: 0 },
      }))
    } else if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }))
    } else {
      const runs: TextRun[] = []
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g)
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }))
        } else if (part.startsWith('*') && part.endsWith('*')) {
          runs.push(new TextRun({ text: part.slice(1, -1), italics: true }))
        } else {
          runs.push(new TextRun(part))
        }
      }
      children.push(new Paragraph({ children: runs }))
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'start' as const }],
      }],
    },
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

async function generateXlsx(content: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const workbook = XLSX.utils.book_new()
  const lines = content.split('\n').filter(l => l.trim())

  const rows: string[][] = []
  for (const line of lines) {
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      if (!cells.every(c => c.match(/^[-:]+$/))) {
        rows.push(cells)
      }
    } else if (line.includes(',')) {
      rows.push(line.split(',').map(c => c.trim()))
    } else {
      rows.push([line])
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}

async function generatePptx(content: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const pptx = new PptxGenJS()

  const slideBlocks = content.split(/(?=^## |\n---\n)/m).filter(b => b.trim())

  for (const block of slideBlocks) {
    const slide = pptx.addSlide()
    const lines = block.split('\n').filter(l => l.trim())

    let title = ''
    const bodyLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('## ') && !title) {
        title = line.slice(3)
      } else if (line.startsWith('# ') && !title) {
        title = line.slice(2)
      } else if (line !== '---') {
        bodyLines.push(line.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^[-*]\s/, '  \u2022 '))
      }
    }

    if (title) {
      slide.addText(title, {
        x: 0.5, y: 0.5, w: 9, h: 1,
        fontSize: 28, bold: true, color: '1a1a1a',
      })
    }

    if (bodyLines.length > 0) {
      slide.addText(bodyLines.join('\n'), {
        x: 0.5, y: title ? 1.8 : 0.5, w: 9, h: 4.5,
        fontSize: 16, color: '333333', lineSpacingMultiple: 1.3,
      })
    }
  }

  if ((pptx as unknown as { slides: unknown[] }).slides.length === 0) {
    const slide = pptx.addSlide()
    slide.addText(content.slice(0, 2000), {
      x: 0.5, y: 0.5, w: 9, h: 6,
      fontSize: 14, color: '333333',
    })
  }

  const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
}

/** Simple markdown to HTML for PDF rendering */
function markdownToHtml(md: string): string {
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')

  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  html = html.split('\n').map(line => {
    if (line.trim() === '') return ''
    if (line.startsWith('<')) return line
    return `<p>${line}</p>`
  }).join('\n')

  return html
}
