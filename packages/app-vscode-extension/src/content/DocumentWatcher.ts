import { SerializedSuggestionCodeAssist } from "@p42/app-vscode-shared/build/code-assist/SerializedSuggestionCodeAssist";
import * as p42 from "@p42/engine";
import * as vscode from "vscode";
import { LanguageServerFacade } from "../language-service-client/LanguageServerFacade";

export class DocumentWatcher {
  private readonly eventEmitter = new vscode.EventEmitter<void>();
  readonly onSuggestionChange = this.eventEmitter.event;

  private documentUri: vscode.Uri | undefined = undefined;
  private documentUriString: string | undefined = undefined;

  constructor(private readonly languageServer: LanguageServerFacade) {
    languageServer.onDocumentUpdated(async (documentUri) => {
      if (documentUri === this.documentUriString) {
        this.update();
      }
    });
  }

  getDocumentUri() {
    return this.documentUri;
  }

  setDocumentUri(documentUri: vscode.Uri | undefined) {
    const newDocumentUriString = documentUri?.toString();
    if (newDocumentUriString === this.documentUriString) {
      return;
    }

    this.documentUri = documentUri;
    this.documentUriString = newDocumentUriString;
    this.update();
  }

  async getFunctionElements(): Promise<Array<p42.FunctionElement> | undefined> {
    return this.withDocumentUri((uri) =>
      this.languageServer.getFunctionElements(uri)
    );
  }

  async getSuggestions(): Promise<
    Array<SerializedSuggestionCodeAssist> | undefined
  > {
    return this.withDocumentUri((uri) =>
      this.languageServer.getSuggestions(uri)
    );
  }

  async getCodeAssistDiff(
    codeAssistId: string,
    contextLines?: number | undefined
  ) {
    return this.withDocumentUri((uri) =>
      this.languageServer.getCodeAssistDiff(uri, codeAssistId, contextLines)
    );
  }

  private async withDocumentUri<T>(
    callback: (documentUri: string) => Promise<T>
  ): Promise<T | undefined> {
    const { documentUriString } = this;
    return documentUriString != null ? await callback(documentUriString) : undefined;
  }

  private update() {
    this.eventEmitter.fire();
  }
}
