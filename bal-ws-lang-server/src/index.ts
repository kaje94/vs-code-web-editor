import express, { Express } from 'express';
import cors from "cors";
import { Server } from "node:http";
import { runBalServer } from './bal_ls';
import fsRouter from "./file_system/fsRoutes"

const app: Express = express();
const PORT: number = 9091;
app.use(cors());
app.use(express.json());

app.use("/fs", fsRouter);

const httpServer: Server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


runBalServer(httpServer);
