import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./prompts/**/*.md", "./schemas/**/*.json", "./fixtures/**/*.json"],
  },
};

export default nextConfig;
