declare module "lang-map" {
  /** Returned by calling `map()` */
  interface MapReturn {
    /** All extensions keyed by language name */
    extensions: Record<string, string[]>
    /** All languages keyed by file-extension */
    languages: Record<string, string[]>
  }

  interface LangMap {
    /** Calling `map()` gives you the raw lookup tables: `{ extensions, languages }` */
    (): MapReturn
    /** Static method: get extensions for a given language */
    extensions(language: string): string[]
    /** Static method: get languages for a given extension */
    languages(extension: string): string[]
  }

  const map: LangMap
  export = map
}
