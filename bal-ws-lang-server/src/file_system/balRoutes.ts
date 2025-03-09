import express, { Request, Response, NextFunction } from 'express';
import { exec } from "child_process";

const balRouter = express.Router();

export const COMMAND_NOT_FOUND = "command not found";
export const NO_SUCH_FILE = "No such file or directory";
export const ERROR = "Error:";
const SWAN_LAKE_REGEX = /(s|S)wan( |-)(l|L)ake/g;

const balVersion = "2201.11.0"; // Default version
const BASE_URL = "https://api.central.ballerina.io";
const DOC_API_PATH = "/2.0/docs";
let LibrariesListEndpoint = `${BASE_URL}${DOC_API_PATH}/stdlib/${balVersion}`;
let LibrariesSearchEndpoint = `${LibrariesListEndpoint}/search`;
const options = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

balRouter.get("/libraryList/:kind", async (req: Request, res: Response) => {
    const { kind } = req.params
    const response = await fetch(LibrariesListEndpoint, options);

    if (!response.ok) {
        console.log(response);
        res.status(500).json("Failed to fetch the libraries list"); return;
    }

    const payload = await response.json();
    const librariesList = kind == "all"
        ? { librariesList: [...payload["langLibs"], ...payload["modules"]] }
        : { librariesList: payload[kind] }

    res.status(200).json(librariesList);
})

balRouter.get("/allResourses", async (req: Request, res: Response) => {
    const response = await fetch(LibrariesSearchEndpoint, options);

    if (!response.ok) {
        console.log(response.text())
        res.status(500).json("Failed to fetch the libraries list"); return;
    }

    const payload = await response.json();

    res.status(200).json(payload);
})

balRouter.get("/librarydata/:orgName/:moduleName/:version", async (req: Request, res: Response) => {
    const { orgName, version, moduleName } = req.params
    const response = await fetch(`${BASE_URL}${DOC_API_PATH}/${orgName}/${moduleName}/${version}`, options);

    if (!response.ok) {
        res.status(500).json("Failed to fetch the libraries list"); return;
    }

    const payload = await response.json();

    res.status(200).json(payload);
})

balRouter.post("/pull", (req: Request, res: Response) => {
    const { command } = req.body;
    exec(`${command}`, async (err, stdout, stderr) => {
        if (err) {
            res.status(500).json(stderr)
        } else {
            res.status(200).send(stdout);
        }
    });
})

export default balRouter;
