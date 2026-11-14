import { createSignal, ErrorBoundary, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"

// olliEcode ambient background layer for animated themes. Rendered into
// <body> via a Portal so it can never affect the stacking / layout /
// clipping of vendor panels (file explorer, chat pane, dialogs). Behind
// everything with z-index: 0 + isolation: isolate — children can't
// escape this stacking context, siblings never see them.
//
// Only runs when the picked theme is in the animated set. Static themes
// render nothing (no DOM, no listeners, no cost). Switching themes is a
// Solid signal update + <Show> remount; no full reload needed.
//
// If any decoration throws during paint (rare but possible on exotic
// drivers / GPU memory pressure), the ErrorBoundary catches it and
// renders nothing — the app keeps working, the theme just loses its
// atmospheric layer. Better than a runtime that takes down the whole
// window.

function readTheme(): string {
  if (typeof document === "undefined") return ""
  return document.documentElement.getAttribute("data-theme") ?? ""
}

export function OlliecodeFxAmbient() {
  const [theme, setTheme] = createSignal<string>(readTheme())

  onMount(() => {
    const html = document.documentElement
    setTheme(html.getAttribute("data-theme") ?? "")
    const obs = new MutationObserver(() => {
      const t = html.getAttribute("data-theme") ?? ""
      if (t !== theme()) setTheme(t)
    })
    obs.observe(html, { attributes: true, attributeFilter: ["data-theme"] })
    onCleanup(() => obs.disconnect())
  })

  const kit = () => theme()

  return (
    <ErrorBoundary fallback={<></>}>
      <Portal mount={document.body}>
        <div
          class="olliE-ambient pointer-events-none fixed inset-0 overflow-hidden"
          style={{ "z-index": "0", isolation: "isolate" }}
          aria-hidden="true"
        >
          <Show when={kit() === "frost"}>
            <div class="olliE-orb olliE-orb-a" />
            <div class="olliE-orb olliE-orb-b" />
            <div class="olliE-orb olliE-orb-c" />
          </Show>
          <Show when={kit() === "porcelain"}>
            <div class="olliE-blob olliE-blob-a" />
            <div class="olliE-blob olliE-blob-b" />
            <div class="olliE-blob olliE-blob-c" />
          </Show>
          <Show when={kit() === "prism"}>
            <div class="olliE-aura olliE-aura-a" />
            <div class="olliE-aura olliE-aura-b" />
          </Show>
          <Show when={kit() === "vapor"}>
            <div class="olliE-sky" />
          </Show>
          <Show when={kit() === "obsidian"}>
            <div class="olliE-grain" />
          </Show>
        </div>
      </Portal>
    </ErrorBoundary>
  )
}
