import * as vscode from 'vscode';
import { LanguageClientOptions, LanguageClient as WorkerLanguageClient } from 'vscode-languageclient/browser';

let client: WorkerLanguageClient | undefined;
const FS_BASE_URL = "http://localhost:9091/github";

class BalFileSystemProvider implements vscode.FileSystemProvider {

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		console.log("stat: ", uri.toString());
		const pathSegments = uri.path.split("/").filter(segment => segment.length > 0);

		if (pathSegments.length === 2) {
			console.log("Starting to clone repository...");
			const cloneResponse = await fetch(`http://localhost:9091/github/clone${uri.path}`);
			if (!cloneResponse.ok) {
				console.log(`Failed to clone repository: ${cloneResponse.statusText}`);
				throw new Error('Failed to fetch clone repository');
			}
			console.log("Clone success:", cloneResponse.status);
		}

		const statInfo = await fetch(`http://localhost:9091/github/stat?url=${uri.path}`);
		console.log("sending request to: ", `http://localhost:9091/github/stat?url=${uri.path}`);
		if (statInfo.status == 404) {
			throw vscode.FileSystemError.FileNotFound(uri);
		} else if (!statInfo.ok) {
			console.log(`Failed to fetch repo stats: ${statInfo.statusText}`);
			throw new Error('Failed to fetch repo stats');
		}
		const data = await statInfo.json();
		console.log(data);
		return { type: data.isDirectory ? vscode.FileType.Directory : vscode.FileType.File, ctime: 0, mtime: 0, size: data.size };
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		console.log("read directory: ", uri.path);

		const directoryInfo = await fetch(`${FS_BASE_URL}/repo?url=${uri.path}`);
		console.log("sending request to: ", `${FS_BASE_URL}/repo?url=${uri.path}`);
		if (!directoryInfo.ok) {
			console.log(`Failed to fetch repo contents: ${directoryInfo.statusText}`);
			return [];
		}

		const files = await directoryInfo.json();
		console.log("Repo files:", files);
		const children = files.map((file: { name: string; isDirectory: boolean }) => {
			return [file.name, file.isDirectory ? vscode.FileType.Directory : vscode.FileType.File];
		});

		return children;
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		console.log("readFile: ", uri.path);
		const fileContent = await fetch(`${FS_BASE_URL}/repo?url=${uri.path}`);
		console.log("sending request to: ", `${FS_BASE_URL}/repo?url=${uri.path}`);
		if (!fileContent.ok) {
			console.log(`Failed to fetch file content: ${fileContent.statusText}`);
			throw new Error('Failed to fetch file content');
		}
		const data = await fileContent.text();
		console.log(`${uri.path} read successfully!`);
		return new TextEncoder().encode(data);
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
		console.log("writeFile: ", uri.toString(), " ", options);

		const response = await fetch(`${FS_BASE_URL}/write?url=${uri.path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				content: new TextDecoder().decode(content)   
			})
		});
		console.log("sending request to: ", `${FS_BASE_URL}/write?url=${uri.path}`);
		if (!response.ok) {
			console.log(`Failed to write to the file: ${response.statusText}`);
			throw new Error('Failed to write to the file');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
	}

	async delete(uri: vscode.Uri): Promise<void> {
		console.log("Attempting to delete: ", uri.path);

		const response = await fetch(`${FS_BASE_URL}/remove?url=${uri.path}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json"
			}
		});
		console.log("sending request to: ", `${FS_BASE_URL}/remove?url=${uri.path}`);
		if (!response.ok) {
			console.log(`Failed to remove the file: ${response.statusText}`);
			throw new Error('Failed to remove the file');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
	}

	async createDirectory(uri: vscode.Uri): Promise<void> {
		console.log("creating directory: ", uri.path)
		const response = await fetch(`${FS_BASE_URL}/mkdir?url=${uri.path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			}
		});
		console.log("sending request to: ", `${FS_BASE_URL}/mkdir?url=${uri.path}`);
		if (!response.ok) {
			console.log(`Failed to create file: ${response.statusText}`);
			throw new Error('Failed to create file');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
	}

	async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		console.log("creating directory: ", oldUri.path)
		const response = await fetch(`${FS_BASE_URL}/rename?oldUrl=${oldUri.path}&newUrl=${newUri.path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			}
		});
		console.log("sending request to: ", `${FS_BASE_URL}/rename?oldUrl=${oldUri.path}&newUrl=${newUri.path}`);
		if (!response.ok) {
			console.log(`Failed to rename: ${response.statusText}`);
			throw new Error('Failed to rename');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		]);
	}

	watch(uri: vscode.Uri, options: { recursive: boolean, excludes: string[] }): vscode.Disposable {
		return new vscode.Disposable(() => { });
	}

	async copy(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean }): Promise<void> {		console.log("copying: ", source, destination, options);

		const response = await fetch(`${FS_BASE_URL}/copy`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				source: source.path,
				destination: destination.path,
				overwright: options.overwrite
			})
		});
		console.log("sending request to: ", `${FS_BASE_URL}/copy`);
		if (!response.ok) {
			console.log(`Failed to copy: ${response.statusText}`);
			throw new Error('Failed to copy');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([
			{ type: vscode.FileChangeType.Created, uri: destination },
			{ type: vscode.FileChangeType.Changed, uri: source }
		]);
	}
}

const SCHEME = 'bala';
const fsProvider = new BalFileSystemProvider();

export async function activate(context: vscode.ExtensionContext) {

	// Test command
	context.subscriptions.push(vscode.commands.registerCommand('simple-web-extension.hello', () => {
		vscode.window.showInformationMessage('Hello from simple-web-extension!');
	}));

	// Register the file system provider
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(SCHEME, fsProvider, { isReadonly: false })
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
			uri: vscode.Uri.parse(`${SCHEME}:/${repoInfo.username}/${repoInfo.repo}`),
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
				if (folder.uri.scheme === SCHEME) {
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
			{ scheme: SCHEME, language: "ballerina" },
            { scheme: SCHEME, language: "toml"}
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
			if (folder.uri.scheme === SCHEME) {
				fsProvider.delete(folder.uri);
			}
		}
	}
	if (client) {
        await client.stop();
        client = undefined;
    }
}
