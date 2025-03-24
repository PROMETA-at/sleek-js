export function importCustomElements() {
  return import.meta.glob(['./*', '!./index.ts'])
}
