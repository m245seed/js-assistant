import * as vscode from "vscode";

type FindFilesOptions = {
  cancellationToken?: vscode.CancellationToken;
};

export function findFilesInFolder(
  folderUri: vscode.Uri,
  fileExtensions: string[],
  options: FindFilesOptions = {}
): Thenable<vscode.Uri[]> {
  const pattern =
    fileExtensions.length === 0
      ? "**/*"
      : `**/*.{${fileExtensions.join(",")}}`;

  const includePattern = new vscode.RelativePattern(folderUri, pattern);

  return vscode.workspace.findFiles(
    includePattern,
    // Workspace exclusions (files.exclude, search.exclude, .gitignore) are
    // respected by vscode.workspace.findFiles when no explicit exclude is
    // provided.
    undefined,
    undefined,
    options.cancellationToken
  );
}
