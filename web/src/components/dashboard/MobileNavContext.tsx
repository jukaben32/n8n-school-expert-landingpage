'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface MobileNavContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

/**
 * Estado compartido del menú móvil (el botón ☰ en TopBar, el cajón
 * deslizable en Sidebar). Son hermanos bajo el layout del dashboard (que
 * es un Server Component), así que necesitan un Context en vez de pasarse
 * props directamente entre ellos.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MobileNavContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav debe usarse dentro de <MobileNavProvider>')
  return ctx
}
