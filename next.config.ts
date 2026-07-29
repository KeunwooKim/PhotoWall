import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  // onnxruntime-web uses wasm/dynamic imports — keep it client-only
  serverExternalPackages: ["onnxruntime-web"],
};

export default nextConfig;
