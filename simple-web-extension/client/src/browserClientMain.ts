import { ExtensionContext, Uri, commands, window } from 'vscode';
import { LanguageClientOptions, MessageTransports } from 'vscode-languageclient';

import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { LanguageClient as WorkerLanguageClient } from 'vscode-languageclient/browser';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';

let client: LanguageClient | WorkerLanguageClient | undefined;

export async function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('simple-web-extension.hello', () => {
		window.showInformationMessage('Hello from simple-web-extension!');
	}));

	// const ws = new WebSocket(`ws://localhost:30001/bal`);
    // const iWebSocket = toSocket(ws);
    // const reader = new WebSocketMessageReader(iWebSocket);
    // const writer = new WebSocketMessageWriter(iWebSocket);

    // client = createLanguageClient(reader, writer);
    // await client.start();
    // context.subscriptions.push(client);

	client = createWorkerLanguageClient(context);
	client.start().then(() => {
        console.log('Language client started successfully');
    }).catch((error) => {
        console.error('Failed to start language client:', error);
    });
	context.subscriptions.push(client);
}

function createWorkerLanguageClient(context: ExtensionContext): WorkerLanguageClient {
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));
	console.log('Worker created with script:', serverMain.toString(true));
	return new WorkerLanguageClient('ballerinalangClient', 'Ballerina Language Client', getClientOptions(), worker);
}

function createLanguageClient(reader: WebSocketMessageReader, writer: WebSocketMessageWriter) : LanguageClient {
    const serverOptions: ServerOptions = () => Promise.resolve({
        reader: reader,
        writer: writer
    })
    return new LanguageClient('ballerinalangClient', 'Ballerina Language Client', serverOptions, getClientOptions())
}

function getClientOptions(): LanguageClientOptions {
	return {
		documentSelector: [{ scheme: 'file', language: "ballerina" }],
	};
}

export async function deactivate(): Promise<void> {
	if (client) {
        await client.stop();
        client = undefined;
    }
}
