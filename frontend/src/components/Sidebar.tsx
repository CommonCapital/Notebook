"use client";

import { useMemo, useState } from "react";
import type { FileSummary, Folder } from "@/lib/types";
import styles from "./Sidebar.module.css";

interface Props {
  files: FileSummary[];
  folders: Folder[];
  activeId: number | null;
  onOpen: (id: number) => void;
  onCreateFile: (folderId: number | null) => void;
  onDeleteFile: (id: number) => void;
  onRenameFile: (id: number, name: string) => void;
  onCreateFolder: (parentId: number | null) => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number) => void;
  onMoveFile: (fileId: number, folderId: number | null) => void;
}

export default function Sidebar(p: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | "root" | null>(null);

  const childFolders = useMemo(() => {
    const map = new Map<number | null, Folder[]>();
    for (const f of p.folders) {
      const key = f.parentFolderId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [p.folders]);

  const filesByFolder = useMemo(() => {
    const map = new Map<number | null, FileSummary[]>();
    for (const f of p.files) {
      const key = f.folderId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [p.files]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const drop = (folderId: number | null) => {
    if (dragId != null) p.onMoveFile(dragId, folderId);
    setDragId(null);
    setDropTarget(null);
  };

  const renderFile = (f: FileSummary, depth: number) => (
    <div
      key={`file-${f.id}`}
      className={`${styles.item} ${f.id === p.activeId ? styles.active : ""}`}
      style={{ paddingLeft: 10 + depth * 16 }}
      draggable
      onDragStart={() => setDragId(f.id)}
      onDragEnd={() => { setDragId(null); setDropTarget(null); }}
      onClick={() => p.onOpen(f.id)}
    >
      <span className={styles.swatch} style={{ background: f.backgroundColor }} />
      <span
        className={styles.name}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const name = window.prompt("Rename file:", f.name);
          if (name && name.trim()) p.onRenameFile(f.id, name.trim());
        }}
      >
        {f.name}
      </span>
      <button className={styles.del} title="Delete file"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete "${f.name}"?`)) p.onDeleteFile(f.id);
        }}>×</button>
    </div>
  );

  const renderFolder = (folder: Folder, depth: number) => {
    const isOpen = expanded.has(folder.id);
    const kids = childFolders.get(folder.id) ?? [];
    const kidFiles = filesByFolder.get(folder.id) ?? [];
    return (
      <div key={`folder-${folder.id}`}>
        <div
          className={`${styles.folder} ${dropTarget === folder.id ? styles.dropOver : ""}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => toggle(folder.id)}
          onDragOver={(e) => { e.preventDefault(); setDropTarget(folder.id); }}
          onDragLeave={() => setDropTarget((t) => (t === folder.id ? null : t))}
          onDrop={(e) => { e.preventDefault(); drop(folder.id); }}
        >
          <span className={styles.caret}>{isOpen ? "▾" : "▸"}</span>
          <span className={styles.folderIcon}>🗀</span>
          <span
            className={styles.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const name = window.prompt("Rename folder:", folder.name);
              if (name && name.trim()) p.onRenameFolder(folder.id, name.trim());
            }}
          >{folder.name}</span>
          <button className={styles.folderAdd} title="New file in folder"
            onClick={(e) => { e.stopPropagation(); p.onCreateFile(folder.id); }}>＋</button>
          <button className={styles.folderAdd} title="New subfolder"
            onClick={(e) => { e.stopPropagation(); p.onCreateFolder(folder.id); }}>🗀</button>
          <button className={styles.del} title="Delete folder (and contents)"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete folder "${folder.name}" and everything in it?`))
                p.onDeleteFolder(folder.id);
            }}>×</button>
        </div>
        {isOpen && (
          <div>
            {kids.map((c) => renderFolder(c, depth + 1))}
            {kidFiles.map((f) => renderFile(f, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = childFolders.get(null) ?? [];
  const rootFiles = filesByFolder.get(null) ?? [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Notebook</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.new} onClick={() => p.onCreateFile(null)}>+ File</button>
        <button className={styles.newAlt} onClick={() => p.onCreateFolder(null)}>+ Folder</button>
      </div>

      <div
        className={`${styles.list} ${dropTarget === "root" ? styles.dropOver : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDropTarget("root"); }}
        onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
        onDrop={(e) => { e.preventDefault(); drop(null); }}
      >
        {p.folders.length === 0 && p.files.length === 0 && (
          <p className={styles.empty}>No files yet. Create one →</p>
        )}
        {rootFolders.map((f) => renderFolder(f, 0))}
        {rootFiles.map((f) => renderFile(f, 0))}
      </div>

      <div className={styles.footer}>Drag a file onto a folder to move it</div>
    </aside>
  );
}
