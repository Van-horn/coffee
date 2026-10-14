'use client';

import dynamic from 'next/dynamic';

// The form sits far below the fold: it stays in the server HTML but ships as its own async chunk,
// so React hydrates it after the hero instead of competing with it.
const LeadForm = dynamic(() => import('@/components/LeadForm'));

export default function LazyLeadForm() {
  return <LeadForm />;
}
