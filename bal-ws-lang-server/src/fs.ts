import express, { Express, Request, Response, NextFunction } from 'express';
import * as path from "path";
import * as fs from "fs";
import cors from "cors";
import simpleGit, { SimpleGit } from "simple-git";
import { runBalServer } from './bal';
import { Server } from "node:http";

const app: Express = express();
const PORT: number = 9091;
const git: SimpleGit = simpleGit();
app.use(cors());
app.use(express.json());

export const BASE_DIR: string = path.join(path.resolve(__dirname, '..'), 'repos'); // Base directory for all repos
const getRepoPath = (userId: string, repoName: string): string => path.join(BASE_DIR, userId, repoName);

// cloning the repo
app.get('/github/clone/:userId/:repoName', async (req: Request, res: Response) => {
    const { userId, repoName } = req.params; 
    const userRepoPath = getRepoPath(userId, repoName);
    console.log("cloning into: ", userRepoPath)
    if (fs.existsSync(userRepoPath)) {
        res.send('Repo already exists');
        return;
    }

    try {
        await git.clone(`https://github.com/${userId}/${repoName}.git`, userRepoPath);
        res.send(`Repository cloned successfully for user: ${userId}`);
    } catch (error: any) {
        res.status(500).send(`Error cloning repo: ${error.message}`);
    }
});

// get the stat of the repo content
app.get('/github/stat', (req: Request, res: Response) => {
    const userRepoPath = path.join(BASE_DIR, req.query.url as string);
    if (!fs.existsSync(userRepoPath)) {
        res.status(404).send(`${req.query.url} not found.`);
    }
    const stats = fs.statSync(userRepoPath);
    res.send({ isDirectory: stats.isDirectory(), ctime: 0, mtime: 0, size: stats.size });
});

// get the files and folders in a repo
app.use('/github/repo', (req: Request, res: Response, next: NextFunction) => {
    const userRepoPath = path.join(BASE_DIR, req.query.url as string);;
    console.log("searching repo: ", userRepoPath)
    if (fs.statSync(userRepoPath).isDirectory()) {
        console.log("requested is a directory")
        fs.readdir(userRepoPath, (err, files) => {
            if (err) {
                res.status(500).send('Unable to read directory');
            }

            const fileList = files.map(file => {
                const filePath = path.join(userRepoPath, file);
                return {
                    name: file,
                    isDirectory: fs.statSync(filePath).isDirectory()
                };
            });

            res.status(200).json(fileList);
        });
    } else if (fs.statSync(userRepoPath).isFile()) {
        console.log("requested is a file: ", userRepoPath)
        fs.readFile(userRepoPath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).send('Unable to read file');
            }
            res.status(200).send(data);
        });
    }
});

// write to a file
app.post('/github/write', (req: Request, res: Response) => {
    const userRepoPath = path.join(BASE_DIR, req.query.url as string);
    const { content } = req.body;
    fs.writeFile(userRepoPath, content, (err) => {  
        if (err) {
            return res.status(500).send('Unable to write file');
        }
        res.status(200).send('File written successfully');
    });
});

// delete a file/folder
app.delete('/github/remove', (req: Request, res: Response) => {
    const inputPath = path.join(BASE_DIR, req.query.url as string);

    fs.rm(inputPath, { recursive: true, force: true }, (err) => {
        if (err) res.status(500).send(`Error removing path: ${err.message}`);
        res.send(`Path ${inputPath} removed successfully.`);
    });
});

// create directory
app.post('/github/mkdir', (req: Request, res: Response) => {
    const dirPath = path.join(BASE_DIR, req.query.url as string);

    // Check if the directory already exists
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true }); 
            console.log(`Directory created successfully: ${dirPath}`);
            res.status(200).send('Directory created successfully');
        } catch (err) {
            console.error(`Error creating directory.`);
            res.status(500).send('Unable to create directory');
        }
    }
    console.log(`Directory already exists: ${dirPath}`);
    res.status(403).send('Directory already exists');
});

// Renaming file
app.post('/github/rename', (req: Request, res: Response) => {
    const oldPath = path.join(BASE_DIR, req.query.oldUrl as string);
    const newPath = path.join(BASE_DIR, req.query.newUrl as string);

    // Check if the source file/folder exists
    if (!fs.existsSync(oldPath)) {
        res.status(404).send('Source file or folder not found');
    }

    try {
        fs.renameSync(oldPath, newPath); // Rename file or folder
        console.log(`Renamed: ${oldPath} -> ${newPath}`);
        res.status(200).send('Rename successful');
    } catch (err) {
        console.error(`Error renaming: ${err}`);
        res.status(500).send('Unable to rename file or folder');
    }
});

app.post('/github/copy', (req: Request, res: Response) => {
    const { source, destination, overwrite } = req.body;

    if (!source || !destination) {
        res.status(400).send('Source and destination paths are required.');
    }

    const sourcePath = path.join(BASE_DIR, source);
    const destinationPath = path.join(BASE_DIR, destination);

    if (!fs.existsSync(sourcePath)) {
        res.status(404).send('Source file or folder not found.');
    }

    if (fs.existsSync(destinationPath) && !overwrite) {
        res.status(409).send('Destination already exists and overwrite is not allowed.');
    }

    try {
        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
            fs.cpSync(sourcePath, destinationPath, { recursive: true });
        } else {
            fs.copyFileSync(sourcePath, destinationPath);
        }
        res.status(200).send('Copy successful');
    } catch (error) {
        console.error('Copy error:', error);
        res.status(500).send(`Failed to copy: ${error}`);
    }
});

const httpServer: Server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


runBalServer(httpServer)
