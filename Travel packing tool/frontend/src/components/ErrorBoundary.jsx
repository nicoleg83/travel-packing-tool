import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="eb-fallback">
          <p className="eb-title">Something went wrong.</p>
          <p className="eb-detail">{this.state.error.message}</p>
          <div className="eb-actions">
            <button className="eb-btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            {this.props.onReset && (
              <button className="eb-btn eb-btn--primary" onClick={this.props.onReset}>
                Start over
              </button>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
