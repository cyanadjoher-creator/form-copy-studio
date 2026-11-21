import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  // The seed photos are read from disk by the API (hashing, model calls), so ship them with the functions.
  outputFileTracingIncludes: { '/api/**': ['./public/seed/**'] },
  experimental: { serverActions: { bodySizeLimit: '20mb' } },
};
export default config;
