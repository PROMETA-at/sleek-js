import TomSelect from 'tom-select'
import {snakeToCamel} from "./chartjs-chart.js";
import {trySafeEval} from "../utils.js";

const tomSelectStyle = new URL('tom-select/dist/css/tom-select.bootstrap5.css', import.meta.url)

class SleekSelect extends HTMLElement {
  static formAssociated = true
  #selectElement
  #shadow
  #internals
  #value
  #options = {}
  tomSelect

  constructor() {
    super()
    this.#selectElement = document.createElement('select')
    this.#shadow = this.attachShadow({ mode: 'open' })
    this.#internals = this.attachInternals()
  }
  connectedCallback() {
    if (this.hasAttribute('name')) {
      this.#selectElement.name = this.getAttribute('name')
    }

    if (this.hasAttribute('multiple')) {
      this.#selectElement.setAttribute('multiple', '')
    }

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

    this.#value = this.#selectElement.value
    this.#internals.setFormValue(this.#value)

    this.#selectElement.addEventListener('change', (e) => this.#onChange(e))
  }


  #onChange(e) {
    const selectedOptions = Array.from(this.#selectElement.selectedOptions).map((o) => (o as HTMLOptionElement).value)
    this.#value = selectedOptions

    const formData = new FormData()
    for (const value of selectedOptions) {
      formData.append(this.#selectElement.name, value)
    }
    this.#internals.setFormValue(formData)
  }

  get value() {
    return this.#value
  }

  set value(val) {
    this.#value = val
    this.#selectElement.value = val
    this.#internals.setFormValue(val)
  }
}

customElements.define('sleek-select', SleekSelect)
