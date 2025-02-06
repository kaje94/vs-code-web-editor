import { ChildProcess, spawn } from "child_process";
import * as path from "path";
import treekill from "tree-kill";
import { toSocket } from "vscode-ws-jsonrpc";
// tslint:disable-next-line:no-submodule-imports
import * as serverRPC from "vscode-ws-jsonrpc/lib/server";
import { Server } from "ws";

export function spawnStdioServer(ballerinaHome: string): ChildProcess {
    const cmd = path.join(ballerinaHome, "bin", (process.platform === 'win32' ? 'bal.bat' : 'bal'));
    const args = ["start-language-server"];

    const env = { ...process.env };
    if (process.env.LS_EXTENSIONS_PATH !== "") {
        if (env.BALLERINA_CLASSPATH_EXT) {
            env.BALLERINA_CLASSPATH_EXT += path.delimiter + process.env.LS_EXTENSIONS_PATH;
        } else {
            env.BALLERINA_CLASSPATH_EXT = process.env.LS_EXTENSIONS_PATH;
        }
    }
    if (process.env.LSDEBUG === "true") {
        env.BAL_JAVA_DEBUG = "5005";
        env.BAL_DEBUG_OPTS = "-Xdebug -Xnoagent -Djava.compiler=NONE -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=5005,quiet=y";
    }
    return spawn(cmd, args, { env, shell: true });
}

export function spawnWSServer(ballerinaHome: string, port: number): Server {
    // start web-server
    const wsServer = new Server({ port });
    wsServer.on("connection", (socket: WebSocket) => {
        console.log("Client connected");
        const lsProcess = spawnStdioServer(ballerinaHome);
        const serverConnection = serverRPC.createProcessStreamConnection(lsProcess);
        const clientConnection = serverRPC.createWebSocketConnection(toSocket(socket));
        if (clientConnection && serverConnection) {
            console.log("Connections established between client and server.");
            serverRPC.forward(clientConnection, serverConnection);
        } else {
            console.error("Failed to create connections between client and server.");
        }
        const killLSProcess = () => {
            treekill(lsProcess.pid ? lsProcess.pid : -1);
            clientConnection.dispose();
        };
        socket.onclose = killLSProcess;
        socket.onerror = killLSProcess;
    });
    return wsServer;
}
