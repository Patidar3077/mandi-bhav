import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old addresses from when the app had a login (bookmarks, old emails) now go to the welcome screen.
  async redirects() {
    return [
      { source: "/login", destination: "/welcome", permanent: true },
      { source: "/onboarding", destination: "/welcome", permanent: true },
      { source: "/auth/:path*", destination: "/welcome", permanent: true },
      { source: "/signup", destination: "/welcome", permanent: true },
    ];
  },
};

export default nextConfig;
