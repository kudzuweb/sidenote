// UploadForm.tsx
import { Upload } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { Button } from "./ui/button";

export default function UploadForm() {
  const [fileName, setFileName] = useState<string>("");

  return (
    <Form
      method="post"
      encType="multipart/form-data"
      action="/api/upload"
      className="rounded-xl border border-[#26224a]/70 bg-[#0b0618]/80 p-4 shadow-[0_12px_30px_rgba(10,0,28,0.35)]"
    >
      <input
        id="file"
        name="file"
        type="file"
        accept=".pdf,application/pdf,.epub,application/epub+zip"
        required
        className="sr-only"
        onChange={(event) => {
          const selectedFile = event.currentTarget.files?.[0];
          setFileName(selectedFile ? selectedFile.name : "");
        }}
      />
      <label
        htmlFor="file"
        className="flex cursor-pointer flex-col gap-3 rounded-lg border border-dashed border-[#343065]/70 bg-[#100825]/80 px-4 py-4 transition-all duration-200 ease-out hover:border-[#71fff6]/60 hover:bg-[#140c31]/90"
      >
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[#8ffcff]/70">
          {fileName ? "Selected Transmission" : "Drop A Read"}
        </span>
        <div className="flex items-center justify-between text-xs text-[#d9dcff]/85">
          <span className="truncate font-mono">
            {fileName || "Click or drag to upload"}
          </span>
          <Upload className="h-4 w-4 text-[#71fff6]" />
        </div>
      </label>
      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          variant="ghost"
          className="rounded-lg border border-[#ff5688]/70 bg-[#150c32]/90 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-white transition-all duration-200 ease-out hover:border-[#71fff6]/60 hover:bg-[#1d1040]/95 focus-visible:ring-2 focus-visible:ring-[#71fff6]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#070314]"
        >
          Transmit
        </Button>
      </div>
    </Form>
  );
}
