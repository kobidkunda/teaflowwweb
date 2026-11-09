import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Deployments can publish immutable assets under a release-specific URL
  // before switching traffic, without reusing a CDN-cached error response.
  assetPrefix: process.env.NEXT_ASSET_PREFIX || undefined,
  compress: true,
  serverExternalPackages: ["better-sqlite3", "pg"],
  poweredByHeader: false,
  // Include metadata in the initial head for every consumer, including clients
  // that inspect the document without processing streamed body metadata.
  htmlLimitedBots: /.*/,
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.1:3000",
    "localhost",
    "localhost:3000",
    "192.168.88.81",
    "192.168.88.81:3000",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 80, 85],
    // 1440w variant serves near-exact widths for ~1350px hero displays
    // instead of jumping to the 1920w file (≈40 KiB saved on LCP).
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Upload URLs are content-hashed per upload, so a long TTL is safe and
    // speeds up repeat visits (efficient cache lifetimes).
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "teafloww.com",
      },
      {
        protocol: "https",
        hostname: "www.teafloww.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/learn",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/learn/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/logo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.cache = { type: "memory" };
    if (isServer) {
      webpackConfig.plugins = webpackConfig.plugins || [];
      webpackConfig.plugins.push({
        apply(compiler: { hooks: { afterEmit: { tap: (name: string, callback: () => void) => void } }; options: { output: { path?: string } } }) {
          compiler.hooks.afterEmit.tap("LinkMiddlewarePlugin", () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const fs = require("fs");
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const path = require("path");
              const outputPath = compiler.options.output.path;
              if (outputPath) {
                const target = path.join(outputPath, "middleware.js");
                const srcDir = path.join(outputPath, "src");
                const dest = path.join(srcDir, "middleware.js");
                if (fs.existsSync(target)) {
                  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
                  if (!fs.existsSync(dest) || !fs.readFileSync(target).equals(fs.readFileSync(dest))) {
                    fs.copyFileSync(target, dest);
                  }
                }
              }
            } catch {
              // ignore
            }
          });
        },
      });
    }
    return webpackConfig;
  },
};

export default config;
