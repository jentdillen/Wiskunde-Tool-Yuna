import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when another lockfile exists on the machine
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
