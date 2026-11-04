"use client";

import { Component, type ReactNode } from "react";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="app-error" role="alert"><strong>This app needs a quick restart.</strong><p>Your desktop is still here.</p><button onClick={() => this.setState(s => ({ failed: false, attempt: s.attempt + 1 }))}>Restart app</button></div>;
    return <div className="app-boundary" key={this.state.attempt}>{this.props.children}</div>;
  }
}
