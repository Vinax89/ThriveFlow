import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow Firebase Studio’s preview origin during dev
  allowedDevOrigins: [
    'localhost',
    '0.0.0.0',
    // Seen in your logs (both Studio proxy ports you used)
    '6000-firebase-studio-1756575296916.cluster-pb4ljhlmg5hqsxnzpc56r3prxw.cloudworkstations.dev',
    '9000-firebase-studio-1756575296916.cluster-pb4ljhlmg5hqsxnzpc56r3prxw.cloudworkstations.dev',
    // (Optional) allow any Workstations preview during dev:
    '*.cloudworkstations.dev',
  ],

  async redirects() {
    return [
      { source: '/', destination: '/dashboard', permanent: false },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
