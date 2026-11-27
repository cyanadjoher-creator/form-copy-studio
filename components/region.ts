'use client';
import { useEffect, useState } from 'react';
import { REGIONS, type Region } from '@/lib/size-conversion';

const REGION_KEY = 'form.sizeRegion';
/** The region whose sizes the studio shows, remembered in this browser. */
export function useRegion(): [Region, (r: Region) => void] {
  const [r, setR] = useState<Region>('EU');
  useEffect(() => { try { const v = localStorage.getItem(REGION_KEY) as Region | null; if (v && REGIONS.includes(v)) setR(v); } catch { /* storage off */ } }, []);
  return [r, (v: Region) => { setR(v); try { localStorage.setItem(REGION_KEY, v); } catch { /* storage off */ } }];
}
