import type { FileDetail, FileSummary, Folder, Scene } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5199";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listFiles: () => http<FileSummary[]>("/api/files"),

  getFile: (id: number) => http<FileDetail>(`/api/files/${id}`),

  createFile: (name: string, backgroundColor: string, folderId?: number | null) =>
    http<FileDetail>("/api/files", {
      method: "POST",
      body: JSON.stringify({ name, backgroundColor, folderId }),
    }),

  // Move a file into a folder, or to the root when folderId is null.
  moveFile: (id: number, folderId: number | null) =>
    http<FileDetail>(`/api/files/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ folderId }),
    }),

  // Autosave: send any subset of { name, backgroundColor, scene }.
  updateFile: (
    id: number,
    patch: { name?: string; backgroundColor?: string; scene?: Scene },
  ) =>
    http<FileDetail>(`/api/files/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  deleteFile: (id: number) =>
    http<void>(`/api/files/${id}`, { method: "DELETE" }),

  // ---- Folders ----
  listFolders: () => http<Folder[]>("/api/folders"),

  createFolder: (name: string, parentFolderId?: number | null) =>
    http<Folder>("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentFolderId }),
    }),

  renameFolder: (id: number, name: string) =>
    http<Folder>(`/api/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  deleteFolder: (id: number) =>
    http<void>(`/api/folders/${id}`, { method: "DELETE" }),
};
