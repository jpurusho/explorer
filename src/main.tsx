import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Prevent browser default context menu globally — app provides its own
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Prevent browser from navigating when files are dropped. Must be set up
// before React mounts so the listeners are in place when the first drop happens.
// Using capture phase (true) to intercept before any child handlers.
document.addEventListener("dragover", (e) => {
  // Must preventDefault on dragover to signal "this is a valid drop target"
  // so the browser allows the drop event to fire (and reach our preventDefault below).
  e.preventDefault();
}, true);

document.addEventListener("drop", (e) => {
  // Always block the browser's default drop behavior (navigate to file).
  // Our folder cards have explicit onDrop handlers that will process valid
  // in-app drops; everything else should no-op.
  e.preventDefault();
  console.log("[main] Blocked external drop — Finder→Explorer import not yet supported");
}, true);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
