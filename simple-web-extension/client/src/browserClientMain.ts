import * as vscode from 'vscode';
import { LanguageClientOptions, LanguageClient as WorkerLanguageClient } from 'vscode-languageclient/browser';
import { BalFileSystemProvider } from './BalFileSystemProvider';

let client: WorkerLanguageClient | undefined;

const WEB_IDE_SCHEME = 'web-bala';
const STD_LIB_SCHEME = 'bala';
const fsProvider = new BalFileSystemProvider();

export async function activate(context: vscode.ExtensionContext) {

	// Test command
	context.subscriptions.push(vscode.commands.registerCommand('simple-web-extension.hello', () => {
		vscode.window.showInformationMessage('Hello from simple-web-extension!');
	}));

	// Register the file system provider
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(WEB_IDE_SCHEME, fsProvider, { isReadonly: false }),
		vscode.workspace.registerFileSystemProvider(STD_LIB_SCHEME, fsProvider, { isReadonly: true })
	);

	// Register the command to open a github repository
	context.subscriptions.push(vscode.commands.registerCommand('simple-web-extension.openGithubRepository', async () => {
		const repoUrl = await vscode.window.showInputBox({ placeHolder: 'Enter repository URL' });
		if (!repoUrl) {
			return;
		}
		const repoInfo = extractGitHubRepoInfo(repoUrl);
		if (!repoInfo) {
			vscode.window.showErrorMessage('Invalid repository URL');
			return;
		}
		vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders.length, 0, {
			uri: vscode.Uri.parse(`${WEB_IDE_SCHEME}:/${repoInfo.username}/${repoInfo.repo}`),
			name: `${repoInfo.username}/${repoInfo.repo}`
		});
		vscode.window.showInformationMessage('Cloning the repository...');
	}));

	// Start language client
	client = createWorkerLanguageClient(context);
	client.start().then(() => {
        console.log('Language client started successfully');
    }).catch((error) => {
        console.error('Failed to start language client:', error);
    });
	context.subscriptions.push(client);

	// Delete folder in the fs while removing folder from the workspace
	vscode.workspace.onDidChangeWorkspaceFolders(event => {
		if (event.removed.length > 0) {
		 	console.log("Removed folders:", event.removed);
			for (const folder of event.removed) {
				if (folder.uri.scheme === WEB_IDE_SCHEME) {
					fsProvider.delete(folder.uri);
				}
			}
		}
	});

}

function createWorkerLanguageClient(context: vscode.ExtensionContext): WorkerLanguageClient {
	const serverMain = vscode.Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));
	console.log('Worker created with script:', serverMain.toString(true));
	return new WorkerLanguageClient('ballerinalangClient', 'Ballerina Language Client', getClientOptions(), worker);
}

function getClientOptions(): LanguageClientOptions {
	return {
		documentSelector: [
            { scheme: 'file', language: "ballerina" },
            { scheme: 'file', language: "toml"},
			{ scheme: WEB_IDE_SCHEME, language: "ballerina" },
            { scheme: WEB_IDE_SCHEME, language: "toml"}
        ],
        synchronize: { configurationSection: "ballerina" },
        initializationOptions: {
            "enableSemanticHighlighting": <string>vscode.workspace.getConfiguration().get("kolab.enableSemanticHighlighting"),
			"enableInlayHints": <string>vscode.workspace.getConfiguration().get("kolab.enableInlayHints"),
			"supportBalaScheme": "true",
			"supportQuickPick": "true",
			"supportPositionalRenamePopup": "true"
        },
        outputChannel: vscode.window.createOutputChannel('Ballerina'),
        traceOutputChannel: vscode.window.createOutputChannel('Trace'),
	};
}

function extractGitHubRepoInfo(url: string): { username: string; repo: string } | null {
	const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/);
	return match ? { username: match[1], repo: match[2].replace(".git", "") } : null;
}

export async function deactivate(): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		for (const folder of workspaceFolders) {
			if (folder.uri.scheme === WEB_IDE_SCHEME) {
				fsProvider.delete(folder.uri);
			}
		}
	}
	if (client) {
        await client.stop();
        client = undefined;
    }
}
