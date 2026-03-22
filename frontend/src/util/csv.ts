import { importStudentsForCourse } from "./api";

type ImportCsvHandlers = {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

const asMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  return String(value);
};

export const importCSV = (id: string | number, handlers: ImportCsvHandlers = {}) => {
  // Prompt the user to select a file
  const input = document.createElement("input");
  input.setAttribute("type", "file");

  // Handle the file selection event
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const text = reader.result?.toString();

      if (!text) {
        handlers.onError?.("Please select a file to upload");
        return;
      }

      try {
        const result = await importStudentsForCourse(Number(id), text);
        handlers.onSuccess?.(result.msg || "Students added successfully!");
      } catch (error) {
        handlers.onError?.(asMessage(error));
      }
    };

    if (!file) {
      handlers.onError?.("Please select a file to upload");
      return;
    }

    reader.readAsText(file);
  });

  input.click();
};