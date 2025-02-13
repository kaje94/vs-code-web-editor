import { ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import { LanguageClientOptions, MessageTransports } from 'vscode-languageclient';

import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { LanguageClient as WorkerLanguageClient } from 'vscode-languageclient/browser';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';

let client: LanguageClient | WorkerLanguageClient | undefined;

export async function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('simple-web-extension.hello', () => {
        console.log(workspace.workspaceFolders);
		window.showInformationMessage('Hello from simple-web-extension!');
	}));

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

function getClientOptions(): LanguageClientOptions {
	return {
		documentSelector: [
            { scheme: 'file', language: "ballerina" },
            { scheme: 'file', language: "toml"}
        ],
        synchronize: { configurationSection: "ballerina" },
        initializationOptions: {
            "enableSemanticHighlighting": <string>workspace.getConfiguration().get("kolab.enableSemanticHighlighting"),
			"enableInlayHints": <string>workspace.getConfiguration().get("kolab.enableInlayHints"),
			"supportBalaScheme": "true",
			"supportQuickPick": "true",
			"supportPositionalRenamePopup": "true"
        },
        outputChannel: window.createOutputChannel('Ballerina'),
        traceOutputChannel: window.createOutputChannel('Trace')
	};
}

export async function deactivate(): Promise<void> {
	if (client) {
        await client.stop();
        client = undefined;
    }
}
