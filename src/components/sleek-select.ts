import TomSelect from 'tom-select'
import {snakeToCamel} from "./chartjs-chart.js";
import {trySafeEval} from "../utils.js";

const tomSelectStyle = new URL('tom-select/dist/css/tom-select.bootstrap5.css', import.meta.url)

let globalSheets = null;
function getGlobalStyleSheets() {
    if (globalSheets === null) globalSheets = document.querySelectorAll('head > link[rel=stylesheet]')
    return globalSheets
}

class SleekSelect extends HTMLElement {
  static formAssociated = true

  #selectElement
  #shadow
  #internals
  #options = {}
  tomSelect

  connectedCallback() {
    this.style.display = 'block'

    const control = this.#buildFormControl()

    this.#shadow = this.attachShadow({ mode: 'open' })
    this.#internals = this.attachInternals()

    const styleLink = document.createElement('link')
    styleLink.setAttribute('rel', 'stylesheet')
    styleLink.setAttribute('href', tomSelectStyle.href)

    this.#shadow.appendChild(control)
    this.#shadow.appendChild(styleLink)
    getGlobalStyleSheets().forEach(sheet => {
        this.#shadow.appendChild(sheet.cloneNode());
    });

    this.#options = this.getAttributeNames()
      .filter((n) =>
        !['name', 'multiple'].includes(n)
      )
      .reduce((obj, path) => {
        const parts = path.split('.')
        const key = parts.pop()
        const value = this.getAttribute(path)
        const leaf = parts.reduce((obj, part) => {
          if (! (part in obj)) obj[part] = {}
          return obj[part];
        }, obj)

        // For render.* keys we skip snakeToCamel because TomSelect expects keys like 'no_results' exactly as is.
        // Converting to camelCase would break functionality, so we keep the original key.
        if (parts[0] === 'render') {
          leaf[key] = trySafeEval(value)
        } else {
          leaf[snakeToCamel(key)] = trySafeEval(value)
        }

        return obj
      }, {})

    this.tomSelect = new TomSelect(this.#selectElement, {
      ...this.#options,
      plugins: ['clear_button']
        .concat(
          this.hasAttribute('multiple')
            ? ['remove_button']
            : []
        ),
      highlight: true
    })
    this.#fixBootstrapStyling()

    this.value = this.tomSelect.getValue()
    this.tomSelect.on('change', this.#onChange.bind(this))
    this.dispatchEvent(new CustomEvent('upgrade'))
  }


  #onChange(newValue) {
    this.value = newValue
    this.dispatchEvent(new Event('change'))
  }

  get value() {
    let v = this.tomSelect.getValue()
    // We shallow-copy arrays here, because in "multiple"-mode, tom-select actually modifies and returns the *same*
    // array, even when a new array is set as it's value.
    if (Array.isArray(v)) v = [...v]
    return v
  }

  set value(val) {
    // Silent update here to prevent loops. However, this means that consumers of this component must manually trigger
    // change events when updating the value from outside.
    if (!valueEqual(this.value, val)) this.tomSelect.setValue(val, true)

    if (Array.isArray(val)) {
      const formData = new FormData()
      for (const value of val) {
        formData.append(this.#selectElement.name, value)
      }
      this.#internals.setFormValue(formData)
    } else {
      this.#internals.setFormValue(val)
    }
  }

  #buildFormControl() {
    const control = document.createElement('div')
    control.classList.add('form-floating')
    this.#selectElement = document.createElement('select')
    control.appendChild(this.#selectElement)
    const label = document.createElement('label')
    const labelSlot = document.createElement('slot')
    labelSlot.setAttribute('name', 'label')
    labelSlot.innerHTML = this.getAttribute('label')
    label.appendChild(labelSlot)
    control.appendChild(label)

    if (this.hasAttribute('name'))     this.#selectElement.name = this.getAttribute('name')
    if (this.hasAttribute('multiple')) this.#selectElement.setAttribute('multiple', '')

    return control
  }

  #fixBootstrapStyling() {
    this.#shadow.querySelector('.ts-wrapper').classList.add('form-control')
    this.#shadow.querySelector('.ts-wrapper').style = `
      --ts-pr-caret: 1rem;
      height: unset;
      min-height: calc(3.5rem + calc(var(--bs-border-width) * 2));
    `
    this.#shadow.querySelector('.ts-control').style = `
      padding-top: 1.625rem;
      padding-bottom: 0.625rem;
    `
  }
}

function valueEqual(v1, v2) {
  if (Array.isArray(v1) !== Array.isArray(v2)) return false
  if (Array.isArray(v1)) {
    const v2Set = new Set(v2)
    return v1.length === v2.length && v1.every(e => v2Set.has(e))
  }
  return v1 === v2
}

customElements.define('sleek-select', SleekSelect)
