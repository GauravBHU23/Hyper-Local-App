/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendBase =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL ||
      "http://127.0.0.1:8001";

    return [
      {
        source: "/backend/:path*",
        destination: `${backendBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
