import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEME } from "./models";
import { BASE_DIR } from "../file_system/fsRoutes";

export const getLocalDirectory = (referenceUrl: string | URL) => {
  const __filename = fileURLToPath(referenceUrl);
  return dirname(__filename);
};

export const resolveAbsolutePath = (message: string) => {
  if (message.includes(`${SCHEME}:`)) { // messages from client
    message = message.replace(new RegExp(`${SCHEME}:`, 'g'), `file://${BASE_DIR}`);
  }
  else if (message.includes(`${BASE_DIR}`)) { // messages from lang server
    message = message.replace(new RegExp(`file://${BASE_DIR}`, 'g'), `${SCHEME}:`);
    message = message.replace(new RegExp(`${BASE_DIR}`, 'g'), "");
  }
  return JSON.parse(message);
}