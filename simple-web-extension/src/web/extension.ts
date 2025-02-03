import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('simple-web-extension.hello', () => {
		vscode.window.showInformationMessage('Hello from simple-web-extension!');
	});
	
	context.subscriptions.push(disposable);

}

export function deactivate() {}
