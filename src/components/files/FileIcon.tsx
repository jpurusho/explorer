import {
  Folder,
  Image,
  Film,
  Music,
  FileText,
  FileCode2,
  FileJson2,
  File,
  Archive,
  FileType2,
  type LucideIcon,
} from "lucide-react";
import type { FileType } from "../../types";

const iconMap: Record<FileType, LucideIcon> = {
  directory: Folder,
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  code: FileCode2,
  markdown: FileType2,
  json: FileJson2,
  yaml: FileCode2,
  text: FileText,
  archive: Archive,
  unknown: File,
};

const colorMap: Record<FileType, string> = {
  directory: "text-folder",
  image: "text-pink-400",
  video: "text-purple-400",
  audio: "text-green-400",
  document: "text-orange-400",
  code: "text-yellow-400",
  markdown: "text-sky-400",
  json: "text-amber-300",
  yaml: "text-rose-300",
  text: "text-text-secondary",
  archive: "text-amber-500",
  unknown: "text-text-muted",
};

interface FileIconProps {
  fileType: FileType;
  size?: number;
}

export function FileIcon({ fileType, size = 16 }: FileIconProps) {
  const Icon = iconMap[fileType] || File;
  const colorClass = colorMap[fileType] || "text-text-muted";

  return <Icon size={size} className={colorClass} strokeWidth={1.75} />;
}
