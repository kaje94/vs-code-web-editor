# Sample Ballerina WS based LS

To run:

```
npm run start
```

To test:

```
WS URL: ws://localhost:30001/bal
sample message:
{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
        "processId":null,
        "rootUri":null,
        "capabilities":{}
    }
}
```

Sample referred from

- https://github.com/TypeFox/monaco-languageclient#examples-overview
- https://github.com/TypeFox/monaco-languageclient/blob/main/packages/examples/src/python/server/main.ts
