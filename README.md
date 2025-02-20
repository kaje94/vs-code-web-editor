## How to run?

1. Install dependencies

- In root directory
```bash
npm install
```

- Inside web extension directory
```bash
cd ./simple-web-extension
npm install
```
- Inside web extension client
```bash
cd ./simple-web-extension/client
npm install
```

- Inside web extension server
```bash
cd ./simple-web-extension/server
npm install
```

- Inside ballerina web socket language server
```bash
cd ./bal-ws-lang-server
npm install
```

2. Start file server
```bash
cd ./bal-ws-lang-server
npm run start-fs
```

2. Start ballerina web socket language server
```bash
cd ./bal-ws-lang-server
npm run start-bal
```

3. Start vscode server
```bash
cd ./
npm run dev
```

Visit `http://localhost:3000/` in the browser.
