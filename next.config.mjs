/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ship working over pretty — keep types strict, relax style nags during build.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
