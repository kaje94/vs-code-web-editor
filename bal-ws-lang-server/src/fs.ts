import express, { Express, Request, Response, NextFunction } from 'express';
import * as path from "path";
import * as fs from "fs";
import cors from "cors";
import simpleGit, { SimpleGit } from "simple-git";

const app: Express = express();
const PORT: number = 9091;
const git: SimpleGit = simpleGit();
app.use(cors());
app.use(express.json());

const BASE_DIR: string = path.join(__dirname); // Base directory for all repos
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
        res.send({ isDirectory: false, ctime: 0, mtime: 0, size: 0 });
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
                return res.status(500).send('Unable to read directory');
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
    if (!fs.existsSync(userRepoPath)) {
        res.status(404).json({ error: "File not found." });
    }
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
