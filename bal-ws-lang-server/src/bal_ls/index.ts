import { WebSocketServer } from "ws";
import { IncomingMessage, Server } from "node:http";
import { URL } from "node:url";
import { Socket } from "node:net";
import { type IWebSocket, WebSocketMessageReader, WebSocketMessageWriter } from "vscode-ws-jsonrpc";
import { createConnection, createServerProcess, forward } from "vscode-ws-jsonrpc/lib/server";
import { Message, InitializeRequest, type InitializeParams, RegistrationParams, RegistrationRequest } from "vscode-languageserver-protocol";
import { LanguageName, LanguageServerRunConfig, SCHEME } from "./models";
import { resolveAbsolutePath } from "./utils";

export const runBalServer = (httpServer: Server) => {
  runLanguageServer({
    serverName: "bal",
    pathName: "/bal",
    serverPort: 9090,
    runCommand: "cmd.exe",
    runCommandArgs: ["/c", "bal.bat", "start-language-server"],
    spawnOptions: {
      shell: true,
    },
    wsServerOptions: {
      noServer: true,
      perMessageDeflate: false,
      clientTracking: true,
    },
    logMessages: true,
  }, httpServer = httpServer);
};

export const runLanguageServer = (
  languageServerRunConfig: LanguageServerRunConfig,
  httpServer: Server
) => {
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception: ", err.toString());
    if (err.stack !== undefined) {
      console.error(err.stack);
    }
  });

  const wss = new WebSocketServer(languageServerRunConfig.wsServerOptions);
  upgradeWsServer(languageServerRunConfig, {
    server: httpServer,
    wss,
  });
};

export const upgradeWsServer = (runconfig: LanguageServerRunConfig, config: { server: Server; wss: WebSocketServer; }) => {
  config.server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
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

export const launchLanguageServer = (runconfig: LanguageServerRunConfig, socket: IWebSocket) => {

  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);
  const socketConnection = createConnection(reader, writer, () =>
    socket.dispose()
  );

  const { serverName, runCommand, runCommandArgs, spawnOptions } = runconfig;
  const serverConnection = createServerProcess(serverName, runCommand, runCommandArgs, spawnOptions);

  if (serverConnection !== undefined) {
    forward(socketConnection, serverConnection, (message) => {
      message = resolveAbsolutePath(JSON.stringify(message));

      if (Message.isRequest(message)) {
        if (message.method === InitializeRequest.type.method) {
          const initializeParams = message.params as InitializeParams;
          initializeParams.processId = process.pid;
        } else if (message.method === RegistrationRequest.method) {
          const registrationParams = message.params as RegistrationParams;
          if (registrationParams.registrations.length > 0) {
            registrationParams.registrations[0].registerOptions
              .documentSelector.push({ language: LanguageName.ballerina, scheme: `${SCHEME}` })
          }
        }
        if (runconfig.logMessages ?? false) {
          console.log(`${serverName} Server received: ${message.method}`);
          console.log(message);
        }
        if (runconfig.requestMessageHandler !== undefined) {
          return runconfig.requestMessageHandler(message);
        }
      }

      else if (Message.isResponse(message)) {
        if (runconfig.logMessages ?? false) {
          console.log(`${serverName} Server sent:`);
          console.log(message);
        }
        if (runconfig.responseMessageHandler !== undefined) {
          return runconfig.responseMessageHandler(message);
        }
      }

      else if (Message.isNotification(message)) {
        if (runconfig.logMessages ?? false) {
          console.log(`${serverName} Server sent/received notification:`);
          console.log(message);
        }
        if (runconfig.NotificationMessageHandler !== undefined) {
          return runconfig.NotificationMessageHandler(message);
        }
      }
      return message;
    });
  }
};
