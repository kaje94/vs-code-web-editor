import {
    BrowserMessageReader,
    BrowserMessageWriter,
    createConnection,
    InitializeParams,
    InitializeResult,
    TextDocuments
} from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';

const ws = new WebSocket(`ws://localhost:9090/bal`);

ws.onopen = () => {
    console.log('Connected to WebSocket server');
};

const browserReader = new BrowserMessageReader(self);
const browserWriter = new BrowserMessageWriter(self);
const connection = createConnection(browserReader, browserWriter);

// TODO: Need to figure out how to detect this actual path programatically
const sampleFileRootPath = "file:///home/dharshi/Documents/ballerina/";
interface WorkSpaceFolderPathMap {
    relativeFolderName: string;
    absoluteFolderName: string;
}

// file:///folder/main.bal
// file:///home/dharshi/Documents/ballerina/folder/main.bal

connection.onInitialize(async (_params: InitializeParams): Promise<InitializeResult> => {
    console.log(_params);
    // const workspaceFolders = _params.workspaceFolders;
    // if (workspaceFolders) {
    //     workspaceFolders.forEach((folder) => {
    //         const relativeFolderName = folder.name
    //         const absoluteFolderName = `${sampleFileRootPath}${relativeFolderName}`
    //         folder.uri = absoluteFolderName;
    //     });
    //     _params.workspaceFolders = workspaceFolders;
    // }
    const request = getRpcRequest(1, "initialize", await resolveAbsolutePath(_params))
    return sendRequestToWS(request) as Promise<InitializeResult>;
});

connection.onInitialized(() => {
    console.log('Connection initialized');
    sendNotificationToWS("initialized", {});
});

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

connection.listen();

connection.onDidOpenTextDocument(async (params) => {
    sendNotificationToWS("textDocument/didOpen", await resolveAbsolutePath(params));
})

connection.onDidCloseTextDocument(async (params) => {
    sendNotificationToWS("textDocument/didClose", await resolveAbsolutePath(params));
})

connection.onDidChangeTextDocument(async (params) => {
    sendNotificationToWS("textDocument/didChange", await resolveAbsolutePath(params));
})

connection.onRequest(async (method, params) => {
    // TODO: find a proper id generating way
    const requestId = Math.floor(Math.random() * 100000);
    const request = getRpcRequest(requestId, method, await resolveAbsolutePath(params));
    return sendRequestToWS(request);
});

connection.onNotification(async (method, params) => {
    if (params && "textDocument" in params && "uri" in (params.textDocument as any)) {
        return sendNotificationToWS(method, await resolveAbsolutePath(params));
    }
    sendNotificationToWS(method, params);
});

ws.onmessage = async (event) => {
    const response = await resolveRelativePath(event.data);
    if (response.method && response.id) {
        console.log('Received request from WebSocket server:', response);
        connection.sendRequest(response.method, response.params).then((result) => {
            console.log(`Forwarding response for request ${response.method} to WebSocket server: `, result);
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                id: response.id,
                result: result
            }));
        });
    } else if (!response.id) {
        console.log('Received notification from WebSocket server:', response);
        connection.sendNotification(response.method, response.params);
    }
}

function sendRequestToWS(request: any) {
    console.log(`Forwarding request to WebSocket server: ${request.method}`, request.params);
    return new Promise((resolve, reject) => {
        const handleMessage = async (event: MessageEvent) => {
            try {
                const response = await resolveRelativePath(event.data);
                if (response.id === request.id) {
                    console.log(`Received response for ${request.method}:`, response);
                    ws.removeEventListener('message', handleMessage);
                    resolve(response.result);
                }
            } catch (error) {
                console.error(`Error processing response for ${request.method}:`, error);
                reject(error);
            }
        };

        ws.addEventListener('message', handleMessage);

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(request));
        } else {
            ws.onopen = () => {
                console.log('Connected to WebSocket server');
                ws.send(JSON.stringify(request));
            };
        }
        // setTimeout(() => {
        //     reject(new Error(`Timeout waiting for response from WebSocket for ${method}`));
        // }, 5000);
    });
}
function sendNotificationToWS(method: string, params: object | any[] | undefined) {
    console.log(`Forwarding notification to WebSocket server: ${method}`, params);
    const request = getRpcNotification(method, params)
    ws.send(request);
    console.log('Sent notification:', request);
}

function getRpcNotification(method: string, params: object | any[] | undefined) {
    return JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: params
    });
}

function getRpcRequest(id: number, method: string, params: object | any[] | undefined) {
    return {
        id: id,
        jsonrpc: "2.0",
        method: method,
        params: params
    };
}

interface WorkspaceFolderPath {
	relativePath: string,
	absolutePath: string
}

async function getDataFromCache(key: string): Promise<WorkspaceFolderPath[]> {
    const cache = await caches.open("custom-cache");
    const url = new URL(key, self.location.origin);
    const response = await cache.match(url);

    if (response) {
        return response.json() as Promise<WorkspaceFolderPath[]>;
    }
    return [];
}

async function resolveAbsolutePath(params: object | any | undefined) {
    let paramsStr = JSON.stringify(params);
    // const workspaceDetails = await getDataFromCache("/workspaceFolders");
    // console.log("workspace details from cache: ", workspaceDetails);
    // workspaceDetails.forEach(folder => {
    //     paramsStr = paramsStr.replace(new RegExp(folder.relativePath, 'g'), folder.absolutePath);
    // });
    return JSON.parse(paramsStr);
}

async function resolveRelativePath(data: any) {
    let responseStr = data as string;
    // const workspaceDetails = await getDataFromCache("/workspaceFolders");
    // console.log("workspace details from cache: ", workspaceDetails);
    // workspaceDetails.forEach(folder => {
    //     responseStr = responseStr.replace(new RegExp(folder.absolutePath, 'g'), folder.relativePath);
    // });
    return JSON.parse(responseStr);
}



