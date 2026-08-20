import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required by the multi-stage Dockerfile (AITJ-M0-05): the runner stage
  // copies `.next/standalone`, which Next.js only emits when this is set.
  output: 'standalone',
};

export default nextConfig;
