import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Los PDF oficiales de la base de conocimiento se leen del disco en tiempo de ejecución
  outputFileTracingExcludes: { "*": [".pnpm-store/**", "data/uploads/**", "data/evaluacion/**", "scripts/**"] },
  outputFileTracingIncludes: { "/api/kb/[...ruta]": ["./data/kb/**/*"] },
  async redirects() {
    return [{ source: "/", destination: "/eu", permanent: false }];
  },
};

export default nextConfig;
