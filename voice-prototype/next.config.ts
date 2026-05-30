import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 wraps pdfjs-dist, which resolves its worker file via a path
  // relative to its own install location. Bundling it through Turbopack breaks
  // that resolution. Keep both packages as runtime externals so the worker
  // stays findable at node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
