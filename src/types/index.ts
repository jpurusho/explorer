export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_hidden: boolean;
  size: number;
  modified: string;
  file_type: FileType;
}

export type FileType =
  | "directory"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "code"
  | "markdown"
  | "json"
  | "yaml"
  | "html"
  | "text"
  | "archive"
  | "unknown";

export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  modified: string;
  created: string;
  is_dir: boolean;
  is_symlink: boolean;
  is_hidden: boolean;
  permissions: string;
}

export interface FileContent {
  content: string;
  mime_type: string;
  size: number;
  truncated: boolean;
}

export interface AppSettings {
  theme: "system" | "light" | "dark" | "material" | "github" | "monokai" | "atom";
  default_view: "list" | "grid";
  show_hidden_files: boolean;
  sort_by: "name" | "size" | "modified" | "type";
  sort_direction: "asc" | "desc";
  sidebar_width: number;
  preview_width: number;
  favorites: string[];
  recent_paths: string[];
  column_type_width: number;
  column_size_width: number;
  column_modified_width: number;
  show_row_lines: boolean;
  column_name_width: number;
  column_type_visible: boolean;
  column_size_visible: boolean;
  column_modified_visible: boolean;
  font_theme: string;
  index_paths: string[];
  show_favorites_section: boolean;
  show_folders_section: boolean;
  show_tags_section: boolean;
  show_snippets_section: boolean;
  favorites_height: number;
  folders_height: number;
  tags_height: number;
  preview_max_mb: number;
  grid_card_size: number;
  autosave: boolean;
  autosave_delay_ms: number;
}

export interface ExifData {
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: string | null;
  date_taken: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
}

export type ViewMode = "list" | "grid";

export type SortField = "name" | "size" | "modified" | "type";
export type SortDirection = "asc" | "desc";

export type SnippetTier = "local" | "secret" | "public";

export interface Snippet {
  id: string;
  title: string;
  tier: SnippetTier;
  gist_id: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}
