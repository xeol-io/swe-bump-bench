# SWE-bump-bench

## Overview

SWE-bump-bench is a benchmark for evaluating large language models on real world breaking-change dependency upgrade tasks collected from GitHub. Given a _codebase_, a _package_ to bump, and _package version_ to bump to, a language model is tasked with generating a patch that resolves any breaking changes for the upgrade.

The dataset contains only repositories consisting primarily of typescript.

# Data Collection

First, we collect a list of repos where `strict: true` is set in a projects `tsconfig.json`. These repos are added to `raw/repos.csv`. Next we filter the list to repositories that have at least one major package version to upgrade and which contains breaking changes.

Breaking changes are defined as changes that cause `tsc` to fail after the package is updated in the repository.

The collect script does this filtering for us:
```
pnpm run data collect -i raw/repos.csv -o tasks.json
```

The final output, `tasks.json` is a JSON file with a collection of valid tasks.

# License

`MIT`