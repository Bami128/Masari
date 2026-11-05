/** Hand a generated file to the user: share sheet on phones (Save to Files / Drive), download elsewhere. */
export async function deliverFile(filename: string, content: string, mime: string): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([content], { type: mime })
  const file = new File([blob], filename, { type: mime })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      // User cancelled the sheet → fall through to a plain download
      if (e instanceof Error && e.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const r of rows) lines.push(r.map(csvEscape).join(','))
  // BOM so Excel opens UTF-8 (Arabic merchant names) correctly
  return '﻿' + lines.join('\r\n')
}
