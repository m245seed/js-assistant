import * as p42 from "@p42/engine";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { findFilesInFolder } from "../fs/findFilesInFolder";
import { isDirectory } from "../fs/isDirectory";

export async function collectScanTargetUris({
  uris,
  logger,
  cancellationToken,
}: {
  uris: Array<vscode.Uri>;
  logger: OutputChannelLogger;
  cancellationToken?: vscode.CancellationToken;
}): Promise<vscode.Uri[]> {
  const supportedExtensions = p42.FileTypes.getAllSupportedFileExtensions();
  const globExtensions = Array.from(
    new Set(
      supportedExtensions.flatMap((extension) => [
        extension,
        extension.toUpperCase(),
      ])
    )
  );
  const supportedExtensionSet = new Set(
    supportedExtensions.map((extension) => extension.toLowerCase())
  );
  const collectedUris = new Map<string, vscode.Uri>();

  for (const uri of uris) {
    if (cancellationToken?.isCancellationRequested) {
      break;
    }

    try {
      const files = (await isDirectory(uri))
        ? await findFilesInFolder(uri, globExtensions, {
            cancellationToken,
          })
        : hasSupportedExtension(uri, supportedExtensionSet)
        ? [uri]
        : [];

      for (const fileUri of files) {
        if (cancellationToken?.isCancellationRequested) {
          break;
        }

        collectedUris.set(fileUri.toString(), fileUri);
      }
    } catch (error) {
      logger.error({
        message: "Failed to resolve scan target",
        path: uri.toString(),
        error,
      });
    }
  }

  return Array.from(collectedUris.values());
}

function hasSupportedExtension(
  uri: vscode.Uri,
  supportedExtensions: Set<string>
) {
  const path = uri.path.toLowerCase();
  const extensionIndex = path.lastIndexOf(".");

  if (extensionIndex === -1) {
    return false;
  }

  return supportedExtensions.has(path.substring(extensionIndex + 1));
}
