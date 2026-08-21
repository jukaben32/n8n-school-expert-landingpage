'use client'

import { useState } from 'react'

export default function PublicRegistrationLinkButton({ subdomain }: { subdomain: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const link = `${siteUrl}/colegio/${subdomain}/registro-personal`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copia el enlace:', link)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
    >
      {copied ? '✓ Copiado' : '🔗 Enlace de registro'}
    </button>
  )
}
