# Judge the Judge

A tool to test an LLM judge: you give it test cases with known errors, run your judge on them, and see how many of the errors it finds. It runs in the browser, and your data stays on your computer.

- Open the tool: https://wzlinedi.github.io/judge-the-judge/
- **More**, **Load demo…** opens a demo with book summaries.
- To start with your own data or a ready sample, read [Start with your own data](docs/start-with-your-own-data.md).
- To add your own metric, read [How to add a metric](docs/how-to-add-a-metric.md).

## Development

```
npm ci
npm run dev        # start the app
npm test           # unit and integration tests
npm run e2e        # browser tests
npm run demo       # rebuild examples/demo/
npm run samples    # rebuild examples/samples/
```
