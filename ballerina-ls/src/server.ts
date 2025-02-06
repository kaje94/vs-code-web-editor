import { Server } from "ws";

import { spawnWSServer } from "./ws";
import { detectBallerinaHome } from "./utils";

export class WSBallerinaLangServer {

    private wsServer: Server | undefined;

    constructor(
        private port: number = 0,
        private ballerinaHome: string = detectBallerinaHome()
    ) {
    }

    public start(): void {
        console.log(`Starting WS Server on port ${this.port}`);
        this.wsServer = spawnWSServer(this.ballerinaHome, this.port);
        console.log(`WS Server started on port ${this.port}`);
    }

    public shutdown(): void {
        if (this.wsServer) {
            this.wsServer.removeAllListeners();
            this.wsServer.close();
        }
    }
}
