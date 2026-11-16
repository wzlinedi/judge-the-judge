# Start with your own data

You do not need the demo to use the tool. A **test project** is one JSON file that holds the judge, the test cases and the metric. You can load a file that someone made, or build your own.

## Open a ready sample

Download a sample, then use **More**, **Load test project…**. Each has ten test cases and carries its metric, so nothing else is needed.

- [Completeness](../examples/samples/completeness-test-project.json): does the judge find the facts that a summary leaves out?
- [Bias](../examples/samples/bias-test-project.json): does the judge find the sentences that are biased against a group?

A sample has no test run. Run each case with your own model, then paste its reply into the case window.

## Use your own test cases

1. Prepare a CSV or JSON file with one row per test case. The examples are in [examples/files/](../examples/files/).
2. Use **More**, **Import test cases…**.
3. Write or paste your judge prompt on the **Judge** step. Use `{{name}}` for each field of your test cases.

## Use your own metric

A metric is data only. [How to add a metric](how-to-add-a-metric.md) shows how to put its definition in a test project file. Accuracy, the default, is only what a new test project starts with.
