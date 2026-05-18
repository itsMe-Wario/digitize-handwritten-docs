import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverComponentsExternalPackages: ["mongoose", "@mistralai/mistralai"],
};

export default nextConfig;
