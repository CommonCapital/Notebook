"use client";

import { useCallback, useEffect, useState } from "react";
import Editor from "@/components/Editor";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { FileDetail, FileSummary, Folder } from "@/lib/types";
import styles from "./page.module.css";

export default function Home() {
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState<FileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [f, fo] = await Promise.all([api.listFiles(), api.listFolders()]);
      setFiles(f);
      setFolders(fo);
      setError(null);
      return f;
    } catch (e) {
      setError(`Cannot reach the API. Is the backend running? (${(e as Error).message})`);
      return [] as FileSummary[];
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const open = useCallback(async (id: number) => {
    try { setActive(await api.getFile(id)); }
    catch (e) { setError((e as Error).message); }
  }, []);

  const createFile = useCallback(async (folderId: number | null) => {
    const name = window.prompt("New file name:", "Untitled");
    if (name === null) return;
    const file = await api.createFile(name.trim() || "Untitled", "#ffffff", folderId);
    await refresh();
    setActive(file);
  }, [refresh]);

  const deleteFile = useCallback(async (id: number) => {
    await api.deleteFile(id);
    if (active?.id === id) setActive(null);
    refresh();
  }, [active, refresh]);

  const renameFile = useCallback(async (id: number, name: string) => {
    await api.updateFile(id, { name });
    if (active?.id === id) setActive({ ...active, name });
    refresh();
  }, [active, refresh]);

  const moveFile = useCallback(async (fileId: number, folderId: number | null) => {
    await api.moveFile(fileId, folderId);
    refresh();
  }, [refresh]);

  const createFolder = useCallback(async (parentId: number | null) => {
    const name = window.prompt("New folder name:", "New folder");
    if (name === null) return;
    await api.createFolder(name.trim() || "New folder", parentId);
    refresh();
  }, [refresh]);

  const renameFolder = useCallback(async (id: number, name: string) => {
    await api.renameFolder(id, name);
    refresh();
  }, [refresh]);

  const deleteFolder = useCallback(async (id: number) => {
    await api.deleteFolder(id);
    const remaining = await refresh();
    if (active && !remaining.some((f) => f.id === active.id)) setActive(null);
  }, [active, refresh]);

  return (
    <div className={styles.app}>
      <Sidebar
        files={files}
        folders={folders}
        activeId={active?.id ?? null}
        onOpen={open}
        onCreateFile={createFile}
        onDeleteFile={deleteFile}
        onRenameFile={renameFile}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onMoveFile={moveFile}
      />
      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}
        {active ? (
          <Editor key={active.id} file={active} onSaved={refresh} />
        ) : (
          <div className={styles.placeholder}>
            <div>
              <h1>Drawing Desk</h1>
              <p>Figma for engineers &amp; STEM students — diagrams, blueprints, and LaTeX math.</p>
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
                Select a file on the left, or create a new one to start.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
