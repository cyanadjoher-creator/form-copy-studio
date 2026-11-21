'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ingestion } from '@/components/Ingestion';

function NewProduct() {
  const brand = useSearchParams().get('brand') || undefined;
  return <Ingestion key={'new-' + (brand || '')} brand={brand} />;
}
export default function Page() { return <Suspense><NewProduct /></Suspense>; }
