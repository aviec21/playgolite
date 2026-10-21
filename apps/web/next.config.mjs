/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@playgolite/engine", "@playgolite/learn", "@playgolite/ai"],
  reactStrictMode: true,
};
export default nextConfig;
