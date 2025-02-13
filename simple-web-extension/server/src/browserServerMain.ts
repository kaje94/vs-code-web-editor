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

// todo: Need to figure out how to detect this actual path programatically
const sampleFileRootPath = "/home/dharshi/Documents/ballerina/";

connection.onInitialize((_params: InitializeParams): Promise<InitializeResult> => {
    console.log(_params);
    const workspaceFolders = _params.workspaceFolders;
    let firstFolder = ""
    if (workspaceFolders) {
        // Dealing with one folder for testing. todo: Need to change into the loop later
        firstFolder = sampleFileRootPath + workspaceFolders[0].name;
        workspaceFolders[0].name = firstFolder;
        workspaceFolders[0].uri = "file://" + firstFolder;
    }
	return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
            try {
                const response = JSON.parse(event.data);
                console.log('Received response from WebSocket server:', response);

                if (response.id === 1 && response.result?.capabilities) {
                    ws.removeEventListener('message', handleMessage); 
                    resolve({ capabilities: response.result.capabilities });
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
                reject(error);
            }
        };

		ws.addEventListener('message', handleMessage);

        if (ws.readyState === WebSocket.OPEN) {
            sendInitRequest(_params);
        } else {
            ws.onopen = () => {
				console.log('Connected to WebSocket server');
                sendInitRequest(_params);
            };
        }
	})

});

connection.onInitialized(() => {
    console.log('Connection initialized');
    sendNotificationToWS("initialized", {});
});

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

connection.listen();

connection.onDidOpenTextDocument((params) => {
    const uriParts = params.textDocument.uri.split("///");
    const newUri = "file://" + sampleFileRootPath + uriParts[1];
    params.textDocument.uri = newUri;
	sendNotificationToWS("textDocument/didOpen", params);
})

connection.onDidCloseTextDocument((params) => {
    const uriParts = params.textDocument.uri.split("///");
    const newUri = "file://" + sampleFileRootPath + uriParts[1];
    params.textDocument.uri = newUri;
	sendNotificationToWS("textDocument/didClose", params);
})

connection.onDidChangeTextDocument((params) => {
    const uriParts = params.textDocument.uri.split("///");
    const newUri = "file://" + sampleFileRootPath + uriParts[1];
    params.textDocument.uri = newUri;
	sendNotificationToWS("textDocument/didChange", params);
})

connection.onRequest((method, params) => {
    if (params && "textDocument" in params && "uri" in (params.textDocument as any)) {
        const uriParts = (params.textDocument as { uri: string }).uri.split("///");
        const newUri = "file://" + sampleFileRootPath + uriParts[1];
        (params.textDocument as { uri: string }).uri = newUri;
        return sendRequestToWS(method, params);
    }
    return sendRequestToWS(method, params);
});

connection.onNotification((method, params) => {
    if (params && "textDocument" in params && "uri" in (params.textDocument as any)) {
        const uriParts = (params.textDocument as { uri: string }).uri.split("///");
        const newUri = "file://" + sampleFileRootPath + uriParts[1];
        (params.textDocument as { uri: string }).uri = newUri;
        return sendRequestToWS(method, params);
    }
    sendNotificationToWS(method, params);
});

ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    if(response.method && response.id) {
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

function sendInitRequest(params: InitializeParams) {
	const initRequest = JSON.stringify({
		jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: params
    });
	
    ws.send(initRequest);
    console.log('Sent initialization request:', JSON.parse(initRequest));
}

function sendRequestToWS(method: string, params: object | any[] | undefined) {
	console.log(`Forwarding request to WebSocket server: ${method}`, params);

    return new Promise((resolve, reject) => {
        const requestId = Math.floor(Math.random() * 100000); // Generate unique ID
        const request = JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            method: method,
            params: params
        });

        // Handle response from WebSocket server
        const handleMessage = (event: MessageEvent) => {
            try {
                const response = JSON.parse(event.data);
                if (response.id === requestId) {
                    console.log(`Received response for ${method}:`, response);
                    ws.removeEventListener('message', handleMessage);
                    resolve(response.result);
                }
            } catch (error) {
                console.error(`Error processing response for ${method}:`, error);
                reject(error);
            }
        };

        ws.addEventListener('message', handleMessage);

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(request);
        } else {
            reject(new Error(`WebSocket not open. Cannot send request: ${method}`));
        }

        // Timeout for safety
        setTimeout(() => {
            reject(new Error(`Timeout waiting for response from WebSocket for ${method}`));
        }, 5000);
    });
}
function sendNotificationToWS(method: string, params: object | any[] | undefined) {
	console.log(`Forwarding notification to WebSocket server: ${method}`, params);
    const request = JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: params
    });
	ws.send(request);
	console.log('Sent notification:', request);
}
