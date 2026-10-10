import { Component } from 'react'

// If anything crashes, show a friendly message instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error('App error:', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-cream/70">Please refresh the page. If it keeps happening, message us on Instagram.</p>
        <button onClick={() => window.location.assign('/')} className="min-h-12 rounded-xl border border-rose/30 bg-rose px-6 font-semibold text-ink">Back to home</button>
      </div>
    )
  }
}
