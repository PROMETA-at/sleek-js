export function trySafeEval(script: string) {
  try {
    return eval.call(null, `"use strict"; (${script})`)
  } catch (_) {
    return script
  }
}

