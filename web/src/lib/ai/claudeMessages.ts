/**
 * Cliente mínimo de la API de mensajes de Anthropic, con ciclo de herramientas (tool use).
 *
 * `fetch` crudo y no el SDK, igual que el resto del proyecto (ver answerFamilyQuestion.ts), para no
 * tener dos formas de hablar con Anthropic. Módulo PURO (sin imports del proyecto, `fetch` inyectable)
 * para poder probar el ciclo con respuestas simuladas en scripts/test-claude-tool-loop.mjs.
 */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ToolHandler {
  tools: readonly unknown[]
  run: (name: string, input: unknown) => Promise<{ ok: boolean; message: string }>
}

export interface CallClaudeOptions {
  apiKey: string
  model: string
  maxOutputTokens: number
  // Vueltas máximas modelo -> herramienta -> modelo antes de forzar una respuesta de texto.
  maxToolRounds: number
  system: string
  messages: ChatTurn[]
  toolHandler?: ToolHandler
  fetchImpl?: typeof fetch
}

interface ClaudeResponse {
  content?: ContentBlock[]
  stop_reason?: string
}

async function requestClaude(opts: CallClaudeOptions, turns: ChatTurn[], forceText: boolean): Promise<ClaudeResponse> {
  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxOutputTokens,
      system: opts.system,
      messages: turns,
      // La API exige declarar `tools` mientras la conversación tenga bloques tool_use/tool_result,
      // así que en la última vuelta no se quitan: se prohíbe usarlas con tool_choice "none".
      ...(opts.toolHandler
        ? { tools: opts.toolHandler.tools, ...(forceText ? { tool_choice: { type: 'none' } } : {}) }
        : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API respondió ${res.status}: ${body.slice(0, 300)}`)
  }
  return (await res.json()) as ClaudeResponse
}

const REPLY_NUDGE = 'Ahora respóndele a la familia, en una o dos frases, según el resultado de la herramienta.'

// Agrega la indicación al ÚLTIMO turno (el del tool_result), después de los resultados: la API exige que
// los tool_result vayan primero dentro del mismo mensaje de usuario.
function withReplyNudge(turns: ChatTurn[]): ChatTurn[] {
  const last = turns[turns.length - 1]
  const blocks: ContentBlock[] = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content
  return [...turns.slice(0, -1), { role: 'user', content: [...blocks, { type: 'text', text: REPLY_NUDGE }] }]
}

export async function callClaude(opts: CallClaudeOptions): Promise<string> {
  let turns = opts.messages
  let toolsRan = false
  let nudged = false

  for (let round = 0; round <= opts.maxToolRounds; round++) {
    const isLastRound = round === opts.maxToolRounds
    const data = await requestClaude(opts, turns, isLastRound)
    const blocks = data.content ?? []
    const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')

    if (opts.toolHandler && data.stop_reason === 'tool_use' && toolUses.length > 0 && !isLastRound) {
      const results: ContentBlock[] = []
      for (const use of toolUses) {
        const outcome = await opts.toolHandler.run(use.name, use.input)
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: outcome.message,
          ...(outcome.ok ? {} : { is_error: true }),
        })
      }
      turns = [...turns, { role: 'assistant', content: blocks }, { role: 'user', content: results }]
      toolsRan = true
      continue
    }

    // Llegar aquí con un tool_use pendiente significa que el modelo ignoró la prohibición de la última
    // vuelta. Su texto sería solo un "voy a avisar..." sin acción detrás: devolverlo le haría creer a la
    // familia que se avisó cuando no ocurrió. Mejor fallar.
    if (toolUses.length > 0) {
      throw new Error('El modelo no devolvió una respuesta final.')
    }

    const text = blocks
      .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (!text) {
      // Visto con Claude real (7 de 31 pruebas): tras el resultado de una herramienta a veces responde
      // VACÍO aunque la acción ya se hizo. Se reintenta UNA vez pidiendo explícitamente que responda;
      // sin esto la familia vería un error aunque su aviso sí llegó a la secretaría.
      if (toolsRan && !nudged && !isLastRound) {
        nudged = true
        turns = withReplyNudge(turns)
        continue
      }
      throw new Error('Respuesta del modelo sin contenido de texto.')
    }
    return text
  }

  throw new Error('El modelo no devolvió una respuesta final.')
}
