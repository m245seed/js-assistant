import { LogLevel } from "@p42/app-vscode-shared/build/logger/Logger";
import * as _ from "lodash";
import * as vscode from "vscode";
import { LanguageServerFacade } from "../language-service-client/LanguageServerFacade";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { collectScanTargetUris } from "../util/scan/collectScanTargetUris";
import { executeCodeAssistCommand } from "./CodeAssistCommand";

type ApplySafeSuggestionsOptions = {
  documentUri: vscode.Uri;
  logger: OutputChannelLogger;
  languageServer: LanguageServerFacade;
  cancellationToken: vscode.CancellationToken;
};

export const createApplyAllSafeSuggestionsCommand =
  (logger: OutputChannelLogger, languageServer: LanguageServerFacade) =>
  async (uriOrUris?: vscode.Uri | vscode.Uri[]) => {
    const resolvedUris =
      uriOrUris == null
        ? [vscode.window.activeTextEditor?.document.uri].filter(
            (value): value is vscode.Uri => value != null
          )
        : Array.isArray(uriOrUris)
        ? uriOrUris
        : [uriOrUris];

    if (resolvedUris.length === 0) {
      logger.infoMessage("No file selected to apply safe suggestions.");
      return;
    }

    logger.showOutput();

    await vscode.window.withProgress(
      {
        title: "Applying safe suggestions with P42",
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
      },
      async (progress, cancellationToken) => {
        progress.report({
          message: "Collecting files to apply safe suggestions",
        });

        const targetUris = await collectScanTargetUris({
          uris: resolvedUris,
          logger,
          cancellationToken,
        });

        if (cancellationToken.isCancellationRequested) {
          logger.infoMessage("Applying safe suggestions cancelled.");
          return;
        }

        if (targetUris.length === 0) {
          logger.infoMessage(
            "No supported files found to apply safe suggestions."
          );
          return;
        }

        let processed = 0;
        let appliedTotal = 0;

        for (const documentUri of targetUris) {
          if (cancellationToken.isCancellationRequested) {
            break;
          }

          processed += 1;
          progress.report({
            message: `Applying safe suggestions (${processed}/${targetUris.length})`,
            increment:
              targetUris.length > 0 ? 100 / targetUris.length : undefined,
          });

          appliedTotal += await applySafeSuggestionsForDocument({
            documentUri,
            logger,
            languageServer,
            cancellationToken,
          });
        }

        if (cancellationToken.isCancellationRequested) {
          logger.infoMessage("Applying safe suggestions cancelled.");
          return;
        }

        if (targetUris.length > 1) {
          logger.log(LogLevel.INFO, {
            message: `Applied ${appliedTotal} safe suggestion${
              appliedTotal === 1 ? "" : "s"
            } across ${processed} file${processed === 1 ? "" : "s"}.`,
          });
        }
      }
    );
  };

async function applySafeSuggestionsForDocument({
  documentUri,
  logger,
  languageServer,
  cancellationToken,
}: ApplySafeSuggestionsOptions): Promise<number> {
  const path = vscode.workspace.asRelativePath(documentUri);
  let appliedCount = 0;
  let finished = false;

  return new Promise<number>((resolve) => {
    const listenerDisposable = languageServer.onDocumentUpdated(
      async (changedDocumentUri: string) => {
        if (changedDocumentUri === documentUri.toString()) {
          await applyNextSuggestion();
        }
      }
    );

    const cancellationDisposable = cancellationToken.onCancellationRequested(
      () => {
        finish({ message: "Cancelled applying safe suggestions." });
      }
    );

    let isApplying = false;

    const finish = ({ message }: { message?: string } = {}) => {
      if (finished) {
        return;
      }

      finished = true;
      listenerDisposable.dispose();
      cancellationDisposable.dispose();

      if (message != null) {
        logger.log(LogLevel.INFO, { path, message });
      }

      resolve(appliedCount);
    };

    const applyNextSuggestion = async () => {
      if (finished || isApplying) {
        return;
      }

      if (cancellationToken.isCancellationRequested) {
        finish({ message: "Cancelled applying safe suggestions." });
        return;
      }

      isApplying = true;

      try {
        const suggestions = await languageServer.getSuggestions(
          documentUri.toString()
        );

        if (finished) {
          return;
        }

        const safeSuggestions = suggestions
          ?.filter((suggestion) => suggestion.safetyLevel === "SAFE");

        if (safeSuggestions == null || safeSuggestions.length === 0) {
          finish({ message: "Finished applying safe suggestions." });
          return;
        }

        const nextSuggestion = _.sortBy(
          safeSuggestions,
          (finding) => finding.suggestionLine
        )[0];

        if (nextSuggestion == null) {
          finish({ message: "Finished applying safe suggestions." });
          return;
        }

        await vscode.window.showTextDocument(documentUri, {
          preview: false,
        });

        if (finished) {
          return;
        }

        if (cancellationToken.isCancellationRequested) {
          finish({ message: "Cancelled applying safe suggestions." });
          return;
        }

        await executeCodeAssistCommand(
          nextSuggestion.id,
          "applyAllSafeSuggestions"
        );

        if (finished) {
          return;
        }

        appliedCount += 1;

        logger.log(LogLevel.INFO, {
          path,
          message: `Line ${nextSuggestion.suggestionLine}: ${nextSuggestion.actionLabel}`,
        });
      } catch (error: any) {
        logger.error({
          path,
          message: "Applying suggestions failed",
          error,
        });
        finish();
      } finally {
        isApplying = false;
      }
    };

    logger.log(LogLevel.INFO, {
      path,
      message: "Start applying safe suggestions.",
    });

    void applyNextSuggestion();
  });
}
