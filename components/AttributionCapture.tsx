'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

export function AttributionCapture() {
  useEffect(() => {
    try {
      captureAttribution(
        window.location.search,
        document.referrer,
        window.location.href,
        window.sessionStorage,
      );
    } catch {
      // Accessing sessionStorage can throw; attribution is best-effort.
    }
  }, []);
  return null;
}

export default AttributionCapture;
