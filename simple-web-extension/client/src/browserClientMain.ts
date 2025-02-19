import * as vscode from 'vscode';
import { LanguageClientOptions, LanguageClient as WorkerLanguageClient } from 'vscode-languageclient/browser';

let client: WorkerLanguageClient | undefined;
let repoInfo: { username: string, repo: string } | null = null;
const SCHEME = 'memory';

class BalFileSystemProvider implements vscode.FileSystemProvider {

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		console.log("stat: ", uri.toString());
		if (uri.path === "/") {
			console.log("Trying to open a repository");
			console.log("Starting to clone repository...");
			const cloneResponse = await fetch(`http://localhost:9091/github/clone/${repoInfo?.username}/${repoInfo?.repo}`);
			if (!cloneResponse.ok) {
				console.log(`Failed to clone repository: ${cloneResponse.statusText}`);
				throw new Error('Failed to fetch clone repository');
			}
			console.log("Clone success:", cloneResponse.status);
		}
		const statInfo = await fetch(`http://localhost:9091/github/stat?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		console.log("sending request to: ", `http://localhost:9091/github/stat?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		if (!statInfo.ok) {
			console.log(`Failed to fetch repo stats: ${statInfo.statusText}`);
			throw new Error('Failed to fetch repo stats');
		}
		const data = await statInfo.json();
		console.log(data);
		return { type: data.isDirectory ? vscode.FileType.Directory : vscode.FileType.File, ctime: 0, mtime: 0, size: data.size };
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		console.log("repoInfo: ", repoInfo);
		if (!repoInfo) {
			console.log("repo info not found");
			return [];
		}

		const directoryInfo = await fetch(`http://localhost:9091/github/repo?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		console.log("sending request to: ", `http://localhost:9091/github/repo?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
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
		const fileContent = await fetch(`http://localhost:9091/github/repo?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		console.log("sending request to: ", `http://localhost:9091/github/repo?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		if (!fileContent.ok) {
			console.log(`Failed to fetch file content: ${fileContent.statusText}`);
			throw new Error('Failed to fetch file content');
		}
		const data = await fileContent.text();
		console.log(data);
		return new TextEncoder().encode(data);
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
		console.log("writeFile: ", uri.toString());
		const response = await fetch(`http://localhost:9091/github/write?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				content: new TextDecoder().decode(content)   
			})
		});
		console.log("sending request to: ", `http://localhost:9091/github/write?url=${repoInfo?.username}/${repoInfo?.repo}${uri.path}`);
		if (!response.ok) {
			console.log(`Failed to write to the file: ${response.statusText}`);
			throw new Error('Failed to write to the file');
		}
		const data = await response.text();
		console.log(data);
		this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
	}

	delete(uri: vscode.Uri): void {
		// console.log("Attempting to delete: ", uri.toString());

		// if (!(uri.path in fileStore)) {
		// 	throw vscode.FileSystemError.FileNotFound(uri);
		// }

		// const entry = fileStore[uri.path];

		// if (entry.type === vscode.FileType.File) {
		// 	console.log(`Deleting file: ${uri.path}`);

		// 	const parent = uri.path.substring(0, uri.path.lastIndexOf('/')) || '/';
		// 	if (fileStore[parent] && fileStore[parent].type === vscode.FileType.Directory) {
		// 		fileStore[parent].children!.delete(uri.path);
		// 	}

		// 	delete fileStore[uri.path];
		// }
		// else if (entry.type === vscode.FileType.Directory) {
		// 	console.log(`Deleting directory: ${uri.path}`);

		// 	if (entry.children && entry.children.size > 0) {
		// 		throw vscode.FileSystemError.FileIsADirectory(uri); // If directory is not empty, we cannot delete it
		// 	}

		// 	const parent = uri.path.substring(0, uri.path.lastIndexOf('/')) || '/';
		// 	if (fileStore[parent] && fileStore[parent].type === vscode.FileType.Directory) {
		// 		fileStore[parent].children!.delete(uri.path); // Remove the directory reference from the parent
		// 	}

		// 	delete fileStore[uri.path]; // Delete the directory from fileStore
		// }

		// this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
		throw new Error('Method not implemented.');
	}

	createDirectory(uri: vscode.Uri): void {
		// console.log("createDirectory: ", uri.toString());

		// if (uri.path in fileStore) {
		// 	throw vscode.FileSystemError.FileExists(uri);
		// }

		// const parent = uri.path.substring(0, uri.path.lastIndexOf('/')) || '/';
		// if (!(parent in fileStore) || fileStore[parent].type !== vscode.FileType.Directory) {
		// 	throw vscode.FileSystemError.FileNotFound(`Parent folder does not exist: ${parent}`);
		// }

		// fileStore[uri.path] = { type: vscode.FileType.Directory, children: new Set() };
		// fileStore[parent].children!.add(uri.path);

		// this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
		throw new Error('Method not implemented.');
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
		throw new Error('Method not implemented.');
	}

	watch(uri: vscode.Uri, options: { recursive: boolean, excludes: string[] }): vscode.Disposable {
		return new vscode.Disposable(() => { });
	}

	copy?(source: vscode.Uri, destination: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

export async function activate(context: vscode.ExtensionContext) {

	// Test command
	context.subscriptions.push(vscode.commands.registerCommand('simple-web-extension.hello', () => {
		vscode.window.showInformationMessage('Hello from simple-web-extension!');
	}));

	// Register the file system provider
	const provider = new BalFileSystemProvider();
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: false })
	);
	console.log("Memory file system provider registered.");

	// Register the command to open a github repository
	context.subscriptions.push(vscode.commands.registerCommand('simple-web-extension.openGithubRepository', async () => {
		const repoUrl = await vscode.window.showInputBox({ placeHolder: 'Enter repository URL' });
		if (!repoUrl) {
			return;
		}
		repoInfo = extractGitHubRepoInfo(repoUrl);
		if (!repoInfo) {
			vscode.window.showErrorMessage('Invalid repository URL');
			return;
		}
		vscode.workspace.updateWorkspaceFolders(0, 0, {
			uri: vscode.Uri.parse(`${SCHEME}:/`),
			name: `${repoInfo.username}/${repoInfo.repo}`
		});
		vscode.window.showInformationMessage('Hello World from fs-web-extension in a web extension host!');
	}));

	// Start language client
	client = createWorkerLanguageClient(context);
	client.start().then(() => {
        console.log('Language client started successfully');
    }).catch((error) => {
        console.error('Failed to start language client:', error);
    });
	context.subscriptions.push(client);

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
	if (client) {
        await client.stop();
        client = undefined;
    }
}
