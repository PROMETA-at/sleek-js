import { trySafeEval } from '../utils.js'
// @ts-ignore Typescript does not like the .js ending, since it conflicts with explicit module imports
import {Chart, ChartTypeRegistry} from 'chart.js/auto'
// @ts-ignore
import 'chartjs-adapter-date-fns'
// @ts-ignore
import autocolors from 'chartjs-plugin-autocolors'
// @ts-ignore
import annotations from 'chartjs-plugin-annotation'
// @ts-ignore
import zoom from 'chartjs-plugin-zoom'

Chart.register(autocolors, zoom, annotations)
Chart.defaults.maintainAspectRatio = false
Chart.defaults.datasets.line.spanGaps = true

export class ChartElement extends HTMLElement {
  #chart: Chart = null

  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'

    const canvas = document.createElement('canvas');
    this.appendChild(canvas);

    const options = this.getAttributeNames()
      .filter(n => n.startsWith('plugins')
        || n.startsWith('interaction')
        || n.startsWith('scales')
        || n === 'responsive')
      .reduce((obj, path) => {
        const parts = path.split('.')
        const key = parts.pop()
        const value = this.getAttribute(path)
        const leaf = parts.reduce((obj, part) => {
          if (! (part in obj)) obj[part] = {}
          return obj[part];
        }, obj)

        leaf[key] = trySafeEval(value)
        return obj
      }, {})

    this.#chart = new Chart(canvas, {
      type: this.getAttribute('type') as keyof ChartTypeRegistry,
      data: { datasets: [] },
      options,
    })
  }

  set data(data) {
    this.#chart.data = data
    this.update()
  }

  set options(options) {
    this.#chart.options = options
  }

  addOrReplaceDataset(predicate, dataset) {
    const existingDatasetIndex = this.#chart.data.datasets.findIndex(predicate)
    if (existingDatasetIndex === -1)
      this.#chart.data.datasets = [...this.#chart.data.datasets, dataset]
    else
      this.#chart.data.datasets.splice(existingDatasetIndex, 1, dataset)

    this.update()
  }

  removeDataset(predicate) {
    this.#chart.data.datasets = this.#chart.data.datasets.filter(x => !predicate(x))
    this.update()
  }

  addOrReplaceAnnotation(predicate, annotation) {
    if (!this.#chart.options.plugins) {
      this.#chart.options.plugins = {}
    }
    if (!this.#chart.options.plugins.annotation) {
      this.#chart.options.plugins.annotation = { annotations: {} }
    }
    const annos = this.#chart.options.plugins.annotation.annotations
    const existingAnnotationIndex = Object.values(annos).findIndex(predicate)
    if (existingAnnotationIndex === -1) {
      const id = Object.keys(annos).length
      annos[id] = annotation
    } else {
      const id = Object.keys(annos)[existingAnnotationIndex]
      annos[id] = annotation
    }
  }

  removeAnnotation(predicate) {

  }

  #pendingUpdate = false

  /**
   * Force an update to the underlying chart.
   *
   * Using a simple debounce implementation, since multiple datasets could change at the same time,
   * and we don't want to spam updates.
   */
  update() {
    if (this.#pendingUpdate) return
    this.#pendingUpdate = true
    setTimeout(() => {
      this.#chart.update('none')
      this.#pendingUpdate = false
    }, 100)
  }
}
customElements.define('chartjs-chart', ChartElement)

export class ChartDataset extends HTMLElement {
  /** @var {ChartElement | null} */
  #chart

  connectedCallback() {
    if (this.getAttribute('included') === "false") return

    this.#chart = this.closest('chartjs-chart')
    this.syncDataset()

    const observer = new MutationObserver(() => this.syncDataset())
    observer.observe(this, { attributes: true })

    const dataNode = this.getAttribute('data-from')
    if (dataNode) {
      const dataObserver = new MutationObserver((records) => {
        this.syncDataset()
      })
      dataObserver.observe(
        this.closest('chartjs-chart'),
        { childList: true, attributes: true, subtree: true }
      )
    }
  }

  disconnectedCallback() {
    this.#chart?.removeDataset(ds => ds.owner === this)
    this.#chart = null
  }

  syncDataset() {
    const options = this.getAttributeNames()
      .filter(x => !x.startsWith('data') && !x.startsWith(':'))
      .map(x => [sanitizeFieldNames(snakeToCamel(x)), this.getAttribute(x)])
      .reduce((obj, [key, value]) => {
        obj[key] = trySafeEval(value)
        return obj
      }, {})
    const data = this.data

    this.#chart?.addOrReplaceDataset(ds => ds.owner === this, {...options, data, owner: this})
  }

  #dataCache = null
  get data() {
    // if (this.#dataCache) return this.#dataCache

    const dataAttribute = this.getAttribute('data')
    if (dataAttribute) return this.#dataCache = JSON.parse(dataAttribute)

    const dataFromAttribute = this.getAttribute('data-from')
    if (dataFromAttribute) {
      const dataElement: ChartElement = this.closest('chartjs-chart').querySelector(`chartjs-dataset${dataFromAttribute}`)
      if (dataElement) return this.#dataCache = dataElement.data
    }
  }
}
customElements.define('chartjs-dataset', ChartDataset)

function sanitizeFieldNames(key: string) {
  if (key === 'xAxisId') return 'xAxisID'
  if (key === 'yAxisId') return 'yAxisID'
  return key
}

export function snakeToCamel(str: string) {
  return str.replace(/([-_][a-z])/g, group =>
    group
      .toUpperCase()
      .replace('-', '')
      .replace('_', '')
  );
}