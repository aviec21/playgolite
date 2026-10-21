/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@playgolite/engine", "@playgolite/learn", "@playgolite/ai"],
  reactStrictMode: true,
  async headers() {
    return [
      // Cross-origin isolation lets the neural network use several threads (SharedArrayBuffer).
      // Everything the site loads is same-origin, so this is safe.
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      // The model and runtime never change under the same file name, so they can be cached for good.
      {
        source: "/models/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/ort/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};
export default nextConfig;
