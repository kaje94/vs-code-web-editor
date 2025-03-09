import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEME } from "./models";
import { BASE_DIR } from "../file_system/fsRoutes";
import * as path from "path";
import os from "os";
import { exec } from 'child_process';

export const COMMAND_NOT_FOUND = "command not found";
export const NO_SUCH_FILE = "No such file or directory";
export const ERROR = "Error:";

export interface BallerinaHome {
  userHome: string,
  ballerinaHome: string,
  distPath: string,
  ballerinaCmd: string,
  ballerinaVersionText: string,
  ballerinaVersion: string
}

export const getLocalDirectory = (referenceUrl: string | URL) => {
  const __filename = fileURLToPath(referenceUrl);
  return dirname(__filename);
};

// windows fix
// export const resolvePath = (message: string) => {
//   if (message.includes(`${SCHEME}:`)) { // messages from client
//     message = message.replace(new RegExp(`${SCHEME}:`, 'g'), `file:///${BASE_DIR}`);
//   }
//   else if (message.includes(`${BASE_DIR}`) || message.includes("bala:/") || message.includes("file:/")) { // messages from lang server
//     message = message.replace(new RegExp("bala:/", 'g'), "bala://");
//     message = message.replace(new RegExp(`file:///${BASE_DIR}`, 'g'), `${SCHEME}:`);
//     message = message.replace(new RegExp(`file:///`, 'g'), `bala://`);
//     message = message.replace(new RegExp(`${BASE_DIR}`, 'g'), "");
//   }
//   return JSON.parse(message);
// }

// linux fix
// export const resolvePath = (message: string) => {
//   if (message.includes(`${SCHEME}:`)) { // messages from client
//     message = message.replace(new RegExp(`${SCHEME}:`, 'g'), `file://${BASE_DIR}`);
//   }
//   else if (message.includes(`${BASE_DIR}`)) { // messages from lang server
//     message = message.replace(new RegExp(`file://${BASE_DIR}`, 'g'), `${SCHEME}:`);
//     message = message.replace(new RegExp(`${BASE_DIR}`, 'g'), "");
//   }
//   return JSON.parse(message);
// }

export const resolvePath = (message: string) => {
  const fileScheme = os.platform() === "win32" ? "file:///" : "file://";
  
  if (message.includes(`${SCHEME}:`)) { // messages from client
    message = message.replace(new RegExp(`${SCHEME}:`, 'g'), `${fileScheme}${BASE_DIR}`);
  } else if (message.includes(`${BASE_DIR}`) || 
             message.includes("bala:/") || 
             message.includes("file:/")) { // messages from lang server
    message = os.platform() === "win32" ? message.replace(new RegExp("bala:/", 'g'), "bala://") : message;
    message = message.replace(new RegExp(`${fileScheme}${BASE_DIR}`, 'g'), `${SCHEME}:`);
    message = os.platform() === "win32" ? message.replace(new RegExp(`${fileScheme}`, 'g'), `bala://`) : message;
    message = message.replace(new RegExp(`${BASE_DIR}`, 'g'), "");
  }
  return JSON.parse(message);
}

export function getBallerinaHome(): Promise<BallerinaHome | undefined> {
  return new Promise((resolve, reject) => {
    const userHome = os.homedir();
    const ballerinaUserHomeName = '.ballerina';
    const ballerinaUserHome = path.join(userHome, ballerinaUserHomeName);
    const ballerinaHomeCustomDirName = "ballerina-home";
    const ballerinaHome = path.join(ballerinaUserHome, ballerinaHomeCustomDirName);
    const distPath = path.join(ballerinaHome, "bin") + path.sep;
    const ballerinaExecutor = 'bal';
    let exeExtension = "";
    if (os.platform() === "win32") {
      exeExtension = ".bat";
    }
    const ballerinaCmd = (distPath + ballerinaExecutor + exeExtension).trim();

    exec(`${ballerinaCmd} version`, (err, stdout, stderr) => {
      if (stdout) console.log(`bal command stdout: ${stdout}`);
      if (stderr) console.log(`bal command stderr: ${stderr}`);
      if (err) {
        console.error(`bal command error: ${err}`);
        return reject(err);
      }

      try {
        const implVersionLine = stdout.split('\n')[0]; // e.g. Ballerina 2201.11.0
        const replacePrefix = implVersionLine.startsWith("jBallerina") ? /jBallerina / : /Ballerina /;
        const parsedVersion = implVersionLine.replace(replacePrefix, '').trim();

        resolve({
          userHome: userHome,
          ballerinaHome: ballerinaHome,
          distPath: distPath,
          ballerinaCmd: ballerinaCmd,
          ballerinaVersionText: parsedVersion,
          ballerinaVersion: parsedVersion.split(" ")[0]
        });
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  });
}
