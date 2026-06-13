import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Snippet, SnippetTier } from "../types";

interface SnippetsState {
  snippets: Snippet[];
  loading: boolean;

  loadSnippets: () => Promise<void>;
  createSnippet: (title: string, tier: SnippetTier, content: string, language?: string) => Promise<Snippet>;
  deleteSnippet: (id: string) => Promise<void>;
  updateSnippetContent: (id: string, content: string) => Promise<void>;
  moveSnippetTier: (id: string, newTier: SnippetTier) => Promise<Snippet>;
  saveAndPushSnippet: (id: string, content: string) => Promise<void>;
}

export const useSnippetsStore = create<SnippetsState>((set, get) => ({
  snippets: [],
  loading: false,

  loadSnippets: async () => {
    set({ loading: true });
    try {
      // The DB path is the existing tags.db (we reuse it per ADR 0004)
      const dbPath = await getDbPath();
      const snippets = await invoke<Snippet[]>("list_snippets", { dbPath });
      set({ snippets, loading: false });
    } catch (err) {
      console.error("Failed to load snippets:", err);
      set({ loading: false });
    }
  },

  createSnippet: async (title, tier, content, language) => {
    try {
      const dbPath = await getDbPath();
      console.log("Creating snippet:", { dbPath, title, tier, content: content.substring(0, 50) });
      const snippet = await invoke<Snippet>("create_snippet", {
        dbPath,
        title,
        tier,
        content,
        language: language || null,
      });
      console.log("Snippet created:", snippet);
      set({ snippets: [snippet, ...get().snippets] });
      return snippet;
    } catch (err) {
      console.error("createSnippet store error:", err);
      throw err;
    }
  },

  deleteSnippet: async (id) => {
    const dbPath = await getDbPath();
    await invoke("delete_snippet", { dbPath, id });
    set({ snippets: get().snippets.filter((s) => s.id !== id) });
  },

  updateSnippetContent: async (id, content) => {
    const dbPath = await getDbPath();
    await invoke("update_snippet_content", { dbPath, id, content });
    // Update the updated_at field locally (server sets it but we don't re-fetch)
    set({
      snippets: get().snippets.map((s) =>
        s.id === id ? { ...s, updated_at: new Date().toISOString() } : s
      ),
    });
  },

  moveSnippetTier: async (id, newTier) => {
    const dbPath = await getDbPath();
    const updatedSnippet = await invoke<Snippet>("move_snippet_tier", {
      dbPath,
      id,
      newTier,
    });
    set({
      snippets: get().snippets.map((s) => (s.id === id ? updatedSnippet : s)),
    });
    return updatedSnippet;
  },

  saveAndPushSnippet: async (id, content) => {
    const dbPath = await getDbPath();
    await invoke("save_and_push_snippet", { dbPath, id, content });
    // Update the updated_at field locally
    set({
      snippets: get().snippets.map((s) =>
        s.id === id ? { ...s, updated_at: new Date().toISOString() } : s
      ),
    });
  },
}));

async function getDbPath(): Promise<string> {
  // The DB is at ~/.config/explorer/explorer.db (see src-tauri/src/db.rs get_db_path)
  const { homeDir } = await import("@tauri-apps/api/path");
  const home = await homeDir();
  return `${home}/.config/explorer/explorer.db`;
}
