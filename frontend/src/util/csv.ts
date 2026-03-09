import { importStudentsForCourse } from "./api";

export const importCSV = (id: string | number) => {
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
        alert("Please select a file to upload");
        return;
      }

      try {
        const result = await importStudentsForCourse(Number(id), text);
        // ADD: Show success message from backend
        alert(result.msg || "Students added successfully!");
      } catch (error) {
        alert("Error: " + error);
      }
    };

    if (!file) {
      alert("Please select a file to upload");
      return;
    }

    reader.readAsText(file);
  });

  input.click();
};