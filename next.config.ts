import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer usa APIs de Node y no debe pasar por el bundler.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],

  // Las tipografías de los PDFs se abren del disco, así que el rastreo de
  // archivos no las ve venir y hay que subirlas a mano con la función.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/tipografias/**"],
  },
};

export default nextConfig;
