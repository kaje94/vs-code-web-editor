import { 
	ExtensionContext, 
	RelativePattern, 
	Uri, 
	commands, 
	window, 
	workspace 
} from 'vscode';
import { 
	LanguageClientOptions, 
	ProtocolNotificationType0, 
	LanguageClient as WorkerLanguageClient 
} from 'vscode-languageclient/browser';

let client: WorkerLanguageClient | undefined;

export async function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('simple-web-extension.hello', () => {
		window.showInformationMessage('Hello from simple-web-extension!');
	}));
	// resolveWorkspaceFolderPaths();

	client = createWorkerLanguageClient(context);
	client.start().then(() => {
        console.log('Language client started successfully');
    }).catch((error) => {
        console.error('Failed to start language client:', error);
    });
	context.subscriptions.push(client);

	// workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
	// 	console.log("onDidChangeConfiguration: ", e)
	// })

	// workspace.onDidChangeWorkspaceFolders(async (e) => {
	// 	console.log("onDidChangeWorkspaceFolders: ", e)
	// 	resolveWorkspaceFolderPaths();
	// })

}

interface WorkspaceFolderPath {
	relativePath: string,
	absolutePath: string
}

function resolveWorkspaceFolderPaths() {
	const workspaceFolders = workspace.workspaceFolders;
	console.log("workspaceFolders: ", workspaceFolders);
	const details: WorkspaceFolderPath[] = [];
	workspaceFolders.forEach(async (folder) => {
		const files: Uri[] = await workspace.findFiles(new RelativePattern(folder, 'Config.toml'), null, 1);
		console.log("config file in folder ", folder.name, ": ", files);
		if (files.length > 0) {
			const fileContent = await workspace.fs.readFile(files[0]);
			const decoder = new TextDecoder('utf-8');
			const contentAsString = decoder.decode(fileContent);
			const localFolderPath = parseToml(contentAsString)["localPath"];
			console.log('Ballerina.toml Content:', contentAsString);
			details.push({
				relativePath: `file:///${folder.name}`,
				absolutePath: `file:///${localFolderPath}`
			});
			storeDataInCache("/workspaceFolders", details);
		} else {
			// TODO: Handle when no config file found
		}
	});
	console.log("final workspace details: ", details);
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
        traceOutputChannel: window.createOutputChannel('Trace'),
	};
}

function parseToml(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines or comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        // Match key-value pairs (e.g., key = "value")
        const keyValueMatch = trimmedLine.match(/^([\w\-\.]+)\s*=\s*["']?([^"']+)["']?$/);
        if (keyValueMatch) {
            const key = keyValueMatch[1];
            let value: any = keyValueMatch[2];

            // Convert value to boolean, number, or keep as string
            if (value === 'true' || value === 'false') {
                value = value === 'true';
            } else if (!isNaN(Number(value))) {
                value = Number(value);
            }

            // Add the key-value pair to the result object
            result[key] = value;
        }
    }

    return result;
}

async function storeDataInCache(key: string, data: any) {
	const cache = await caches.open("custom-cache");
  
	// Convert the key to an absolute URL
	const url = new URL(key, self.location.origin);
  
	const response = new Response(JSON.stringify(data), {
	  headers: { "Content-Type": "application/json" },
	});
  
	await cache.put(url, response);
}

async function getDataFromCache(key: string): Promise<WorkspaceFolderPath[] | null> {
    const cache = await caches.open("custom-cache");
    const url = new URL(key, self.location.origin);
    const response = await cache.match(url);

    if (response) {
        return response.json() as Promise<WorkspaceFolderPath[]>;
    }
    return null;
}

export async function deactivate(): Promise<void> {
	// TODO: clear workspace folder details fron cache here
	if (client) {
        await client.stop();
        client = undefined;
    }
}
