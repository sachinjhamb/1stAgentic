# Testing Standards

## Output Rules
- Always summarize test results: PASS/FAIL counts, key errors only (first 3 lines max), no full logs.
- Use format: "Tests: X/Y passed. Failures: [file:line - error summary]."
- Skip verbose traces; redirect detailed logs to `test-logs/` folder.

## Execution
- Run tests with `--silent` or `--summary` flags when available.
- For Jest/Pytest: `jest --verbose=false` or `pytest -q`.
