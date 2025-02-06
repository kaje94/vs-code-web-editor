import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

export function detectBallerinaHome(): string {
    const platform: string = process.platform;
    let balHome = "";
    switch (platform) {
        case "win32": // Windows
            if (process.env.BALLERINA_HOME) {
                return process.env.BALLERINA_HOME;
            }
            try {
                balHome = execSync("where ballerina").toString().trim();
            } catch (error) {
                return balHome;
            }
            if (path) {
                balHome = balHome.replace(/bin\\ballerina.bat$/, "");
            }
            break;
        case "darwin": // Mac OS
        case "linux": // Linux
            // lets see where the ballerina command is.
            try {
                const output = execSync("which ballerina");
                balHome = fs.realpathSync(output.toString().trim());
                // remove ballerina bin from path
                if (path) {
                    balHome = balHome.replace(/bin\/ballerina$/, "");
                }
                break;
            } catch {
                return balHome;
            }
    }

    // If we cannot find ballerina home return empty.
    return balHome;
}
