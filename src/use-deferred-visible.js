'use client';

import { useEffect, useRef, useState } from 'react';

export function useDeferredVisible(rootMargin = '800px 0px') {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setReady(true), 1200);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, rootMargin]);

  return [ref, ready];
}
