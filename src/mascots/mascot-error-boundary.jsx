'use client';

import React from 'react';

export default class MascotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (typeof console !== 'undefined') console.error('BOOKNERD mascot module was disabled after an error.', error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
