'use client';

import React from 'react';

export default class ReaderLevelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (typeof console !== 'undefined') console.error('BOOKNERD reader-level notice was disabled after an error.', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
