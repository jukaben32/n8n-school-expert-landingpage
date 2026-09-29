'use client'

import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <input
        // Al mostrar la contraseña el campo pasa a ser de texto normal y el
        // iPhone/Android le aplica mayúscula inicial, autocorrección y
        // espacio final. Eso cambia lo que se guarda sin que la persona lo
        // note y luego "la contraseña no funciona". Se desactiva siempre;
        // va ANTES de {...props} por si algún formulario necesita otra cosa.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
        type={showPassword ? 'text' : 'password'}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShowPassword((value) => !value)}
        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
