import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    const socketPort = Number(process.env.SOCKET_PORT || 4000);
    if (!Number.isInteger(socketPort) || socketPort < 1 || socketPort > 65535) {
      throw new Error("SOCKET_PORT must be a valid TCP port.");
    }
    return [{
      source: "/api/socket/:path*",
      destination: `http://127.0.0.1:${socketPort}/api/socket/:path*`,
    }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
