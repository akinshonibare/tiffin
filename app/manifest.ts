import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tiffin — Expense Tracker",
    short_name: "Tiffin",
    description:
      "A private, offline-first expense tracker. Categories, budgets, and trends — all stored on your device.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf7",
    theme_color: "#0a0a0a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Add expense",
        short_name: "Add",
        url: "/?add=1",
        description: "Quickly add a new expense",
      },
      {
        name: "Budgets",
        short_name: "Budgets",
        url: "/budgets",
      },
    ],
  };
}
