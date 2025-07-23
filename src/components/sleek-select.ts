import TomSelect from 'tom-select'
import {snakeToCamel} from "./chartjs-chart.js";
import {trySafeEval} from "../utils.js";

const tomSelectStyle = new URL('tom-select/dist/css/tom-select.bootstrap5.css', import.meta.url)

class SleekSelect extends HTMLElement {
  static formAssociated = true

  #selectElement
  #shadow
  #internals
  #options = {}
  tomSelect

  connectedCallback() {
    this.#selectElement = document.createElement('select')
    this.#shadow = this.attachShadow({ mode: 'open' })
    this.#internals = this.attachInternals()

    if (this.hasAttribute('name'))     this.#selectElement.name = this.getAttribute('name')
    if (this.hasAttribute('multiple')) this.#selectElement.setAttribute('multiple', '')

    const styleLink = document.createElement('link')
    styleLink.setAttribute('rel', 'stylesheet')
    styleLink.setAttribute('href', tomSelectStyle.href)

    this.#shadow.appendChild(this.#selectElement)
    this.#shadow.appendChild(styleLink)

    try {
      this.#options = this.getAttributeNames()
        .filter((n) =>
          n === 'options' ||
          n === 'value-field' ||
          n === 'label-field' ||
          n === 'search-field' ||
          n === 'items' ||
          n === 'optgroup-field' ||
          n === 'optgroups'
        )
        .reduce((obj, path) => {
          const parts = path.split('.')
          const key = parts.pop()
          const value = this.getAttribute(path)
          const leaf = parts.reduce((obj, part) => {
            if (! (part in obj)) obj[part] = {}
            return obj[part];
          }, obj)

          leaf[snakeToCamel(key)] = trySafeEval(value)
          return obj
        }, {})
    } catch (error) {
      console.error('Invalid options JSON:', error)
      this.#options = {}
    }

    this.tomSelect = new TomSelect(this.#selectElement, {
      ...this.#options,
      plugins: ['remove_button', 'clear_button'],
      highlight: true
    })

    this.value = this.tomSelect.getValue()
    this.#selectElement.addEventListener('change', (e) => this.#onChange(e))
    this.dispatchEvent(new CustomEvent('upgrade'))
  }


  #onChange(e) {
    this.value = Array.from(this.#selectElement.selectedOptions).map((o) => (o as HTMLOptionElement).value) 
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
