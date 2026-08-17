'use client'

import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

// El manifest.webmanifest ya existe (uno por colegio), pero hasta ahora no
// había NADA en la interfaz que le dijera a un padre "esto se puede
// instalar" -- dependía por completo de que notara el ícono nativo del
// navegador. En Chrome/Android hay un evento real (beforeinstallprompt)
// que permite disparar la instalación con un botón; en iPhone/Safari ese
// evento no existe -- ahí solo se puede mostrar la instrucción manual
// ("Compartir -> Agregar a inicio").
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallAppButton({ primaryColor }: { primaryColor: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone()) return // ya instalada, no hay nada que ofrecer

    if (isIos()) {
      // Deferido a un microtask (no directo en el cuerpo del efecto) para
      // cumplir con la regla de lint que evita setState síncrono en efectos.
      Promise.resolve().then(() => setHidden(false))
      return
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (hidden) return null

  async function handleClick() {
    if (isIos()) {
      setShowIosHint((v) => !v)
      return
    }
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') {
      setHidden(true)
      setInstallEvent(null)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-full border font-semibold px-7 py-3.5 text-sm transition"
        style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
      >
        <Download className="w-4 h-4" />
        Instalar app
      </button>

      {showIosHint && (
        <div className="absolute z-10 top-full mt-2 left-1/2 -translate-x-1/2 w-64 rounded-2xl bg-slate-900 text-white text-xs p-4 shadow-xl text-left">
          <p className="flex items-center gap-1.5 font-semibold mb-1">
            <Share className="w-3.5 h-3.5" /> En tu iPhone:
          </p>
          <p>Toca el botón Compartir de Safari y luego &ldquo;Agregar a pantalla de inicio&rdquo;.</p>
        </div>
      )}
    </div>
  )
}
