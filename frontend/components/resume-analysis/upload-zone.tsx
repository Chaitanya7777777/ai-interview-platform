/**
 * components/resume-analysis/upload-zone.tsx
 * -------------------------------------------
 * Drag-and-drop + click-to-upload zone.
 * Handles file validation, drag state, and calls onFileSelect with the
 * validated File object. Does NOT trigger upload — parent owns that.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/types/resume";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
];
const ACCEPTED_EXT = [".pdf", ".docx"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadZoneProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

export function UploadZone({ onFileSelect, disabled = false }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      return `Only .pdf and .docx files are accepted. You uploaded "${ext}".`;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && file.type !== "") {
      return `Unsupported file type: "${file.type}".`;
    }
    if (file.size > MAX_BYTES) {
      return `File is too large (${formatBytes(file.size)}). Max 5 MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(file);
    onFileSelect(file);
  }, [validate, onFileSelect]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset input so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const clear = () => {
    setSelected(null);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload resume file"
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all duration-200 select-none outline-none",
          dragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-60",
          selected && !error && "border-emerald-500/60 bg-emerald-500/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
          id="resume-file-input"
          aria-label="Resume file input"
        />

        {selected && !error ? (
          <>
            <div className="h-14 w-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="font-semibold text-foreground text-center">{selected.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{formatBytes(selected.size)}</p>
          </>
        ) : (
          <>
            <div className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center mb-4 transition-transform",
              dragging ? "scale-110 bg-primary/10" : "bg-muted"
            )}>
              <UploadCloud className={cn("h-7 w-7", dragging ? "text-primary" : "text-muted-foreground")} />
            </div>
            <p className="font-semibold text-foreground text-center">
              {dragging ? "Drop it here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">PDF or DOCX — max 5 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          <span className="shrink-0 mt-px">⚠</span>
          <span className="flex-1">{error}</span>
          <button onClick={clear} className="shrink-0 hover:opacity-70" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {selected && !error && (
        <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={clear} disabled={disabled}>
          <X className="mr-1.5 h-3.5 w-3.5" /> Remove file
        </Button>
      )}
    </div>
  );
}
