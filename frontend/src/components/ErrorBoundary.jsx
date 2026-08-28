import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('Application error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ paddingTop: 100 }}>
          <h1>Something went wrong</h1>
          <p>Please refresh the page. If the problem persists, contact your administrator.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
