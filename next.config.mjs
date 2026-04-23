/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep @react-pdf/renderer out of the server bundler. It ships its own
  // React reconciler and the elements it produces use the plain `react`
  // symbols. If Next bundles it into a route handler, the handler gets
  // Next's "react-server" React, whose $$typeof symbols are different —
  // the renderer then sees a valid React element as a bare object and
  // throws "Objects are not valid as a React child" (minified error #31).
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
