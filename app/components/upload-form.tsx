// UploadForm.tsx
import { useState } from "react";
import { Form } from "react-router";
import { Upload } from "lucide-react";

type UploadFormProps = {
  disabled?: boolean;
};

export default function UploadForm({ disabled }: UploadFormProps) {
  const [fileName, setFileName] = useState<string>("");
  const isDisabled = !!disabled;

  return (
    <Form method="post" encType="multipart/form-data" action="/api/upload" className="space-y-2">
      <div className="flex flexbox justify-between px-2.5 ml-2">
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,application/pdf,.epub,application/epub+zip"
          required
          className="sr-only"
          disabled={isDisabled}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            setFileName(f ? f.name : "");
          }}
        />
        <div className="text-xs rounded-md font-medium text-gray-400 min-h-[1rem] min-w-45">
          {fileName ? `selected: ${fileName}` : "Upload Read"}
        </div>

        <label
          htmlFor="file"
          className={`inline-flex items-center text-sm cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring ${isDisabled ? "pointer-events-none opacity-50" : ""
            }`}
        >
          <Upload className="h-4 w-4" />
        </label>
      </div>
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-md bg-[#a87af5] text-white px-2 py-1 text-xs hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Upload
        </button>
      </div>
    </Form>
  );
}
