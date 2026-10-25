import { Component } from "react";

/**
 * Catches render errors in the storefront so a crash shows a recoverable
 * message instead of a blank screen.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[storefront] Render error", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="mobile-shell"
        role="alert"
        style={{ padding: "2rem 1.25rem", textAlign: "center" }}
      >
        <h2
          style={{
            fontSize: "1.15rem",
            fontWeight: 800,
            marginBottom: "0.6rem",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: "0.88rem",
            color: "var(--mob-muted, #666)",
            lineHeight: 1.5,
            marginBottom: "1.25rem",
          }}
        >
          Please reload the page and try again. If you were placing an order,
          check My Orders before retrying.
        </p>
        <button
          type="button"
          className="mob-btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
