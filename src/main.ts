export * from './utils.js'

export function loadCustomElements(
  mapping: CustomElementLoaderMapping,
  {
    resolveTagName = inferTagName,
    watch = true,
  }: { resolveTagName?: (key: string) => string, watch?: boolean } = {}
): Handle {
  const emitter = new EventTarget()
  const elementDefinitions = Object.fromEntries(
    Object.entries(mapping)
      .map(([key, loader]) => [resolveTagName(key), loader])
  )

  scanAndLoadElements();
  watch && observeDOMForNewElements();

  function loadCustomElement(tagName: string) {
    if (elementDefinitions[tagName]) {
      const result = fire('element:load-start', { tagName }, { cancelable: true })
      if (result === false) return

      elementDefinitions[tagName]()
        .then(() => fire('element:loading', { tagName }))
        .catch(error => fire('element:load-error', { tagName, error }))
        .then(() => fire('element:load-end', { tagName }))
    } else {
      // TODO: fire some event
    }
  }

  function scanAndLoadElements(root: ParentNode = document) {
    root.querySelectorAll(Object.keys(elementDefinitions).join(',')).forEach(el => {
      if (isCustomElement(el.tagName.toLowerCase())) {
        loadCustomElement(el.tagName.toLowerCase());
      }
    });
  }

  function observeDOMForNewElements() {
    const observer = new MutationObserver(mutations => {
      fire('observer:scan-start')

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const elementNode = node as Element

            fire('observer:scan-node', { node: elementNode })
            const tagName = elementNode.tagName.toLowerCase();
            if (isCustomElement(tagName)) {
              loadCustomElement(tagName);
            }
            scanAndLoadElements(elementNode);
          }
        });
      });

      fire('observer:scan-end');
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function fire(eventName: string, detail: object = {}, config: CustomEventInit = {}) {
    return emitter.dispatchEvent(new CustomEvent(eventName, { detail, ...config }))
  }

  return {
    addEventListener: emitter.addEventListener.bind(emitter),
    on: emitter.addEventListener.bind(emitter),
    removeEventListener: emitter.removeEventListener.bind(emitter),
    off: emitter.removeEventListener.bind(emitter),
  }
}

type CustomElementLoaderMapping = Record<string, () => Promise<unknown>>
type Handle = {
  addEventListener: EventTarget['addEventListener']
  on: EventTarget['addEventListener']
  removeEventListener: EventTarget['removeEventListener']
  off: EventTarget['removeEventListener']
}

function isCustomElement(tagName: string) {
  return tagName.includes('-') && !customElements.get(tagName);
}

function inferTagName(path: string) {
  return path.split('/').pop().split('.').shift().toLowerCase();
}
