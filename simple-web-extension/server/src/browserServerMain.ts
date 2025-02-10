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

connection.onInitialize((_params: InitializeParams): Promise<InitializeResult> => {
    console.log(_params);
	return new Promise((resolve, reject) => {
        // Handler for messages from WebSocket server
        const handleMessage = (event: MessageEvent) => {
            try {
                const response = JSON.parse(event.data);
                console.log('Received response from WebSocket server:', response);

                if (response.id === 1 && response.result?.capabilities) {
                    ws.removeEventListener('message', handleMessage); // Remove listener after response
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
	sendNotificationToWS("textDocument/didOpen", params);
})
connection.onDidCloseTextDocument((params) => {
	sendNotificationToWS("textDocument/didClose", params);
})

connection.onDidChangeTextDocument((params) => {
	sendNotificationToWS("textDocument/didChange", params);
})

connection.onRequest((method, params) => {
	return sendRequestToWS(method, params);
});

function sendInitRequest(params: InitializeParams) {
	const initRequest = JSON.stringify({
		jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: params
    });
	
    ws.send(initRequest);
    console.log('Sent initialization request:', initRequest);
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
	const requestId = Date.now(); // Generate a unique ID
    const request = JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: method,
        params: params
    });
	ws.send(request);
	console.log('Sent request:', request);
}

// connection.onRequest((method, params) => {
//     console.log(`Forwarding request: ${method}`, params);

//     return new Promise((resolve, reject) => {
//         const requestId = Math.floor(Math.random() * 100000); // Generate unique ID
//         const request = JSON.stringify({
//             jsonrpc: "2.0",
//             id: requestId,
//             method: method,
//             params: params
//         });

//         // Handle response from WebSocket server
//         const handleMessage = (event: MessageEvent) => {
//             try {
//                 const response = JSON.parse(event.data);
//                 if (response.id === requestId) {
//                     console.log(`Received response for ${method}:`, response);
//                     ws.removeEventListener('message', handleMessage);
//                     resolve(response.result);
//                 }
//             } catch (error) {
//                 console.error(`Error processing response for ${method}:`, error);
//                 reject(error);
//             }
//         };

//         ws.addEventListener('message', handleMessage);

//         if (ws.readyState === WebSocket.OPEN) {
//             ws.send(request);
//         } else {
//             reject(new Error(`WebSocket not open. Cannot send request: ${method}`));
//         }

//         // Timeout for safety
//         setTimeout(() => {
//             reject(new Error(`Timeout waiting for response from WebSocket for ${method}`));
//         }, 5000);
//     });
// });

// connection.onNotification((method, params) => {
// 	console.log(`received notification: ${method}`, params);
// })

// Listen on the connection
