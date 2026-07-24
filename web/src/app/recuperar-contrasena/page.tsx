"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Recuperar contraseña — envía un email de restablecimiento.
 * Nota: Requiere que en Supabase -> Authentication -> URL Configuration
 * tengas permitido http://localhost:3000 en Site URL y Redirect URLs.
 */
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/actualizar-contrasena` : undefined,
      });
      if (error) throw error;
      setStatus("done");
      setMsg(
        "Si el correo existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña."
      );
    } catch (err) {
      setStatus("error");
      setMsg("No pudimos enviar el correo. Verifica el email o inténtalo más tarde.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary/10 via-white to-accent/10 dark:from-slate-950 dark:via-slate-900 dark:to-primary-dark/20">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight text-center">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
          Ingresa tu correo y te enviaremos un enlace para restablecerla.
        </p>

        <form onSubmit={handleReset} className="mt-6 space-y-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-white/70 dark:border-slate-800 rounded-3xl shadow-soft p-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {msg && (
            <div
              role="status"
              className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm border ${
                status === "done"
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                  : status === "error"
                  ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                  : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
              }`}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 text-sm transition shadow-glow disabled:opacity-60"
          >
            {status === "loading" ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : (
              "Enviar enlace de restablecimiento"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
