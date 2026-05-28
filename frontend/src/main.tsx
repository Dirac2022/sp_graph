/**
 * React entry point. Mounts `<App />` into the `#root` div from `index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root mount point in index.html");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
