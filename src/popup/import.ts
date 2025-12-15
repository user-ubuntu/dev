import { MESSAGE_ACTIONS } from "@shared/constants/messages";
import { ChromeApiService } from "./services/chromeApi.service";
import { PopupService } from "./services/popup.service";
import { SessionData } from "@shared/types";
import { handleError } from "@shared/utils/errorHandling";

interface ImportData {
  sessions: SessionData[];
  exportDate: string;
  version: string;
}

interface SessionPreviewItem {
  id: string;
  name: string;
  domain: string;
  order: number;
  createdAt: number;
}

class ImportController {
  private chromeApi = new ChromeApiService();
  private popupService = new PopupService();
  private selectedFile: File | null = null;
  private importData: ImportData | null = null;

  // DOM elements
  private uploadArea!: HTMLElement;
  private jsonFileInput!: HTMLInputElement;
  private fileInfo!: HTMLElement;
  private fileName!: HTMLElement;
  private fileSize!: HTMLElement;
  private clearFileBtn!: HTMLElement;
  private sessionPreview!: HTMLElement;
  private previewSessionsList!: HTMLElement;
  private fileReadyMessage!: HTMLElement;
  private importBtn!: HTMLButtonElement;
  private backBtn!: HTMLButtonElement;
  private statusMessage!: HTMLElement;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
  }

  private initializeElements(): void {
    this.uploadArea = document.getElementById("uploadArea")!;
    this.jsonFileInput = document.getElementById("jsonFileInput") as HTMLInputElement;
    this.fileInfo = document.getElementById("fileInfo")!;
    this.fileName = document.getElementById("fileName")!;
    this.fileSize = document.getElementById("fileSize")!;
    this.clearFileBtn = document.getElementById("clearFileBtn")!;
    this.sessionPreview = document.getElementById("sessionPreview")!;
    this.previewSessionsList = document.getElementById("previewSessionsList")!;
    this.fileReadyMessage = document.getElementById("fileReadyMessage")!;
    this.importBtn = document.getElementById("importBtn") as HTMLButtonElement;
    this.backBtn = document.getElementById("backBtn") as HTMLButtonElement;
    this.statusMessage = document.getElementById("statusMessage")!;
  }

  private setupEventListeners(): void {
    // Upload area events
    this.uploadArea.addEventListener("click", () => {
      this.jsonFileInput.click();
    });

    this.uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.uploadArea.classList.add("drag-over");
    });

    this.uploadArea.addEventListener("dragleave", () => {
      this.uploadArea.classList.remove("drag-over");
    });

    this.uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove("drag-over");

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // File input change
    this.jsonFileInput.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // Clear file button
    this.clearFileBtn.addEventListener("click", () => {
      this.clearSelectedFile();
    });

    // Import button
    this.importBtn.addEventListener("click", () => {
      this.handleImport();
    });

    // Back button
    this.backBtn.addEventListener("click", () => {
      window.close();
    });
  }

  private async handleFileSelect(file: File): Promise<void> {
    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".json")) {
        this.showStatus("Please select a JSON file.", "error");
        return;
      }

      this.selectedFile = file;
      await this.processFile(file);
    } catch (error) {
      this.showStatus(handleError(error, "handleFileSelect"), "error");
      this.clearSelectedFile();
    }
  }

  private async processFile(file: File): Promise<void> {
    try {
      this.showStatus("Reading file...", "loading");

      const text = await file.text();
      const importData: ImportData = JSON.parse(text);

      // Validate import data structure
      if (!importData.sessions || !Array.isArray(importData.sessions)) {
        throw new Error("Invalid file format: missing sessions array");
      }

      this.importData = importData;

      // Display file info
      this.displayFileInfo(file);
      this.displaySessionsPreview(importData.sessions);
      this.showStatus("File loaded successfully!", "success");
    } catch (error) {
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private displayFileInfo(file: File): void {
    this.fileName.textContent = file.name;
    this.fileSize.textContent = this.formatFileSize(file.size);
    this.fileInfo.style.display = "block";
    this.fileReadyMessage.style.display = "flex";
    this.importBtn.disabled = false;
  }

  private displaySessionsPreview(sessions: SessionData[]): void {
    this.previewSessionsList.innerHTML = "";

    if (sessions.length === 0) {
      this.previewSessionsList.innerHTML = '<p class="no-sessions">No sessions found in file</p>';
      return;
    }

    sessions.forEach((session, index) => {
      const sessionItem = this.createSessionPreviewItem(session, index);
      this.previewSessionsList.appendChild(sessionItem);
    });
  }

  private createSessionPreviewItem(session: SessionData, index: number): HTMLElement {
    const item = document.createElement("div");
    item.className = "session-item";

    const icon = document.createElement("span");
    icon.className = "session-icon";
    icon.textContent = "📁";

    const details = document.createElement("div");
    details.className = "session-details";

    const name = document.createElement("div");
    name.className = "session-name";
    name.textContent = session.name || `Session ${index + 1}`;

    const meta = document.createElement("div");
    meta.className = "session-meta";
    meta.innerHTML = `
      <span>🌐 ${session.domain}</span>
      <span>📅 ${new Date(session.createdAt || Date.now()).toLocaleDateString()}</span>
    `;

    details.appendChild(name);
    details.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(details);

    return item;
  }

  private clearSelectedFile(): void {
    this.selectedFile = null;
    this.importData = null;
    this.jsonFileInput.value = "";
    this.fileInfo.style.display = "none";
    this.fileReadyMessage.style.display = "none";
    this.importBtn.disabled = true;
    this.hideStatus();
  }

  private async handleImport(): Promise<void> {
    if (!this.importData) {
      this.showStatus("No file selected", "error");
      return;
    }

    try {
      // Disable button immediately and show loading status
      this.importBtn.disabled = true;
      this.showStatus("Importing sessions...", "loading");

      // Small delay to ensure UI updates before heavy processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get import mode from UI (currently only merge mode)
      const importMode = "merge";

      // Convert import data to JSON string
      const jsonData = JSON.stringify(this.importData);

      // Use the existing import method from popup service
      await this.popupService.initialize();

      // For standalone import, we need to create a temporary service instance
      const response = await this.chromeApi.sendMessage({
        action: MESSAGE_ACTIONS.IMPORT_SESSIONS,
        jsonData,
        importMode,
      });

      if (!response.success) {
        throw new Error(response.error || "Import failed");
      }

      // Show success status
      this.showStatus("Sessions imported successfully! You can close this tab.", "success");

      // Update UI to show success state
      setTimeout(() => {
        this.clearSelectedFile();
      }, 3000);
    } catch (error) {
      // Show error status with clear message
      const errorMessage = handleError(error, "handleImport");
      this.showStatus(`❌ Import failed: ${errorMessage}`, "error");
      this.importBtn.disabled = false;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private showStatus(message: string, type: "success" | "error" | "loading"): void {
    const iconMap = {
      success: "✅",
      error: "❌",
      loading: "⏳",
    };

    this.statusMessage.className = `status-message show ${type}`;
    this.statusMessage.style.display = "flex";
    this.statusMessage.innerHTML = `
      <div class="status-message-content">
        <span class="status-icon">${iconMap[type]}</span>
        <span class="status-text">${message}</span>
      </div>
    `;
  }

  private hideStatus(): void {
    this.statusMessage.className = "status-message";
    this.statusMessage.style.display = "none";
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ImportController();
});
