import express from "express";
import { WebSocketServer, type ServerOptions } from "ws";
import { IncomingMessage, Server } from "node:http";
import { URL } from "node:url";
import { Socket } from "node:net";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cp from "node:child_process";
import {
  type IWebSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from "vscode-ws-jsonrpc";
import {
  createConnection,
  createServerProcess,
  forward,
} from "vscode-ws-jsonrpc/server";
import {
  Message,
  InitializeRequest,
  type InitializeParams,
  type RequestMessage,
  type ResponseMessage,
} from "vscode-languageserver-protocol";

export enum LanguageName {
  bal = "bal",
}

export interface LanguageServerRunConfig {
  serverName: string;
  pathName: string;
  serverPort: number;
  runCommand: LanguageName | string;
  runCommandArgs: string[];
  wsServerOptions: ServerOptions;
  spawnOptions?: cp.SpawnOptions;
  logMessages?: boolean;
  requestMessageHandler?: (message: RequestMessage) => RequestMessage;
  responseMessageHandler?: (message: ResponseMessage) => ResponseMessage;
}

export const getLocalDirectory = (referenceUrl: string | URL) => {
  const __filename = fileURLToPath(referenceUrl);
  return dirname(__filename);
};

/**
 * start the language server inside the current process
 */
export const launchLanguageServer = (
  runconfig: LanguageServerRunConfig,
  socket: IWebSocket
) => {
  const { serverName, runCommand, runCommandArgs, spawnOptions } = runconfig;
  // start the language server as an external process
  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);
  const socketConnection = createConnection(reader, writer, () =>
    socket.dispose()
  );
  const serverConnection = createServerProcess(
    serverName,
    runCommand,
    runCommandArgs,
    spawnOptions
  );
  if (serverConnection !== undefined) {
    forward(socketConnection, serverConnection, (message) => {
      if (Message.isRequest(message)) {
        if (message.method === InitializeRequest.type.method) {
          const initializeParams = message.params as InitializeParams;
          initializeParams.processId = process.pid;
        }

        if (runconfig.logMessages ?? false) {
          console.log(`${serverName} Server received: ${message.method}`);
          console.log(message);
        }
        if (runconfig.requestMessageHandler !== undefined) {
          return runconfig.requestMessageHandler(message);
        }
      }
      if (Message.isResponse(message)) {
        if (runconfig.logMessages ?? false) {
          console.log(`${serverName} Server sent:`);
          console.log(message);
        }
        if (runconfig.responseMessageHandler !== undefined) {
          return runconfig.responseMessageHandler(message);
        }
      }
      return message;
    });
  }
};

export const upgradeWsServer = (
  runconfig: LanguageServerRunConfig,
  config: {
    server: Server;
    wss: WebSocketServer;
  }
) => {
  config.server.on(
    "upgrade",
    (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const baseURL = `http://${request.headers.host}/`;
      const pathName =
        request.url !== undefined
          ? new URL(request.url, baseURL).pathname
          : undefined;

      if (pathName === runconfig.pathName) {
        config.wss.handleUpgrade(request, socket, head, (webSocket) => {
          const socket: IWebSocket = {
            send: (content) =>
              webSocket.send(content, (error) => {
                if (error) {
                  throw error;
                }
              }),
            onMessage: (cb) =>
              webSocket.on("message", (data) => {
                cb(data);
              }),
            onError: (cb) => webSocket.on("error", cb),
            onClose: (cb) => webSocket.on("close", cb),
            dispose: () => webSocket.close(),
          };
          // launch the server when the web socket is opened
          if (webSocket.readyState === webSocket.OPEN) {
            launchLanguageServer(runconfig, socket);
          } else {
            webSocket.on("open", () => {
              launchLanguageServer(runconfig, socket);
            });
          }
        });
      }
    }
  );
};

/** LSP server runner */
export const runLanguageServer = (
  languageServerRunConfig: LanguageServerRunConfig
) => {
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception: ", err.toString());
    if (err.stack !== undefined) {
      console.error(err.stack);
    }
  });

  // create the express application
  const app = express();
  // start the http server
  const httpServer: Server = app.listen(languageServerRunConfig.serverPort);
  const wss = new WebSocketServer(languageServerRunConfig.wsServerOptions);
  // create the web socket
  upgradeWsServer(languageServerRunConfig, {
    server: httpServer,
    wss,
  });
};

export const runBalServer = () => {
  runLanguageServer({
    serverName: "bal",
    pathName: "/bal",
    serverPort: 30001,
    runCommand: LanguageName.bal,
    runCommandArgs: ["start-language-server"],
    wsServerOptions: {
      noServer: true,
      perMessageDeflate: false,
      clientTracking: true,
      // Uncomment incase we need to authorize the request
      // verifyClient: (
      //   clientInfo: { origin: string; secure: boolean; req: IncomingMessage },
      //   callback
      // ) => {
      //   const parsedURL = new URL(
      //     `${clientInfo.origin}${clientInfo.req.url ?? ""}`
      //   );
      //   const authToken = parsedURL.searchParams.get("authorization");
      //   if (authToken === "UserAuth") {
      //     callback(true);
      //   } else {
      //     callback(false);
      //   }
      // },
    },
    logMessages: true,
  });
};

runBalServer();
