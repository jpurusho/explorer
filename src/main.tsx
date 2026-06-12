import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Prevent browser default context menu globally — app provides its own
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Block WebView default file-drop behavior. If a native macOS drag (e.g. our
// own drag-out, or a Finder drag) is released anywhere inside our window that
// doesn't explicitly handle the drop, the WebView would otherwise navigate
// the page to the file's contents — replacing our React UI with the raw file
// and giving no way back without relaunch. preventDefault on every dragover
// + drop at the document level disables that fallback. Element-level drop
// handlers (our internal folder drop targets) still run and call
// preventDefault themselves; this just covers everywhere else.
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
