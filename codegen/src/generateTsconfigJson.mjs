import * as fs from "fs";

export function generateTsconfigJson(filename, codeActionIds) {
  function generateCodeAssistEntries() {
    let content = "";
    for (const codeAssistId of codeActionIds) {
      content += `      "@p42/code-assist-${codeAssistId}": ["packages/code-assist/${codeAssistId}/src/*"],
`;
    }
    return content;
  }

  fs.writeFileSync(
    filename,
    `{
  "compilerOptions": {
    "target": "ES2020",
    "types": ["node", "jest"],
    "jsx": "react",
    "baseUrl": "./",
    "paths": {

${generateCodeAssistEntries()}
      "@p42/app-vscode-shared": ["packages/app-vscode-shared/src/*"],
      "@p42/bundle": ["packages/bundle/src/*"],
      "@p42/engine": ["packages/engine/src/*"]
    }
  }
}
`
  );

  // eslint-disable-next-line no-console
  console.log(`generated ${filename}`);
}
