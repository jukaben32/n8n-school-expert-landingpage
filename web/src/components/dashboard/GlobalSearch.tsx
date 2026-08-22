'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { globalSearchAction, type SearchResult } from './globalSearchAction'

const typeLabels: Record<SearchResult['type'], string> = {
  estudiante: 'Estudiante',
  familia: 'Familia',
  factura: 'Factura',
}
const typeIcons: Record<SearchResult['type'], string> = {
  estudiante: '🎒',
  familia: '👨‍👩‍👧',
  factura: '💳',
}

/**
 * Búsqueda global de la barra superior. Solo se renderiza para roles que
 * tienen al menos un módulo buscable (ver TopBar) -- para el resto ni
 * siquiera se monta.
 */
export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const found = await globalSearchAction(query)
      setResults(found)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(result: SearchResult) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(result.href)
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-faint pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar estudiante, familia, factura..."
          className="w-full rounded-full border border-dash-border bg-dash-surface pl-10 pr-4 py-2 text-sm text-dash-text placeholder-dash-text-faint focus:outline-none focus:ring-2 focus:ring-dash-accent/50 focus:border-transparent transition"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-dash-border bg-dash-surface-raised shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-3 text-sm text-dash-text-faint">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-dash-text-faint">Sin resultados para &quot;{query}&quot;.</p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-dash-surface transition border-b border-dash-border last:border-0"
              >
                <span aria-hidden="true">{typeIcons[r.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dash-text truncate">{r.label}</p>
                  <p className="text-xs text-dash-text-faint truncate">
                    {typeLabels[r.type]}{r.sublabel ? ` · ${r.sublabel}` : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
