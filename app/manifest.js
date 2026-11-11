// Web app manifest: makes RailGo installable (Android/iOS home screen, desktop Chrome/Edge).
export default function manifest() {
  return {
    id: "/",
    name: "RailGo – Train tickets & PNR tracker",
    short_name: "RailGo",
    description: "Track your IRCTC tickets, live PNR status and running trains.",
    start_url: "/bookings",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#f8f9fc",
    theme_color: "#0b7a5c",
    categories: ["travel", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My bookings", url: "/bookings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Search trains", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Live info", url: "/live", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
