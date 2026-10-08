/**
 * Lets any section on the page hand a prompt to the homepage studio
 * (blocks/image-studio) — e.g. a showcase card's "Use this prompt".
 */
const EVENT = 'studio:prompt';

export function sendPromptToStudio(prompt: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prompt }));
  document
    .getElementById('create')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function onStudioPrompt(handler: (prompt: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
