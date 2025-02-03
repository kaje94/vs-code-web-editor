const { open } = require('@vscode/test-web');

open({
    quality: "stable",
    browserType: "none",
    extensionPaths: ["./simple-web-extension"],
    port: 3001
}).then(() => {
    console.log("done!")
}).catch((err) => {
    console.log(err)
})
