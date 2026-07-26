import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer usa APIs de Node y no debe pasar por el bundler.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
};

export default nextConfig;
