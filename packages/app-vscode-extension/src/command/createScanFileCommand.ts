import * as vscode from "vscode";
import { LanguageServerFacade } from "../language-service-client/LanguageServerFacade";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ScanResultEditor } from "../panel/scan-result-editor/ScanResultEditor";
import { collectScanTargetUris } from "../util/scan/collectScanTargetUris";

export const createScanFileCommand =
  ({
    logger,
    languageServer,
    extensionUri,
  }: {
    logger: OutputChannelLogger;
    languageServer: LanguageServerFacade;
    extensionUri: vscode.Uri;
  }) =>
  async (uriOrUris?: vscode.Uri | Array<vscode.Uri>) => {
    const resolvedUris =
      uriOrUris == null
        ? [vscode.window.activeTextEditor?.document.uri].filter(
            (value): value is vscode.Uri => value != null
          )
        : Array.isArray(uriOrUris)
        ? uriOrUris
        : [uriOrUris];

    await vscode.window.withProgress(
      {
        title: "Scanning files with P42",
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
      },
      async (progress, cancellationToken) => {
        const targetUris = await collectScanTargetUris({
          uris: resolvedUris,
          logger,
          cancellationToken,
        });

        if (cancellationToken.isCancellationRequested) {
          logger.infoMessage("Scan cancelled.");
          return;
        }

        if (targetUris.length === 0) {
          logger.infoMessage("No supported files found to scan.");
          return;
        }

        let wasCancelled = false;
        let processed = 0;

        for (const documentUri of targetUris) {
          if (cancellationToken.isCancellationRequested) {
            wasCancelled = true;
            break;
          }

          processed += 1;
          progress.report({
            message: `Opening scan results (${processed}/${targetUris.length})`,
            increment: targetUris.length > 0 ? 100 / targetUris.length : undefined,
          });

          // TODO should spawn max one editor for each file (keep references by name somehow)
          await ScanResultEditor.create({
            languageServer,
            extensionUri,
            documentUri,
          });
        }

        if (wasCancelled) {
          logger.infoMessage("Scan cancelled.");
        }
      }
    );
  };

