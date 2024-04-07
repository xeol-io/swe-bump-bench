# SWE-bump-bench

## Overview

SWE-bump-bench is a benchmark for evaluating large language models on real world breaking-change dependency upgrade tasks collected from GitHub. Given a _codebase_, a _package_ to bump, and _package version_ to bump to, a language model is tasked with generating a patch that resolves any breaking changes for the upgrade.

# Data Collection

## Stage 1 - BigQuery Public Dataset Results

We run the query inside `query.sql` on the `githubarchive` public BigQuery dataset. More information about the github archive project [here](https://www.gharchive.org/).

This narrows PRs down to ones that
- were opened by dependabot
- are a major version bump
- were successfully merged
- have more than 2 files changed, meaning there were some code changes

## Stage 2 - Filtering Down The Results

During the second stage of validation, we take the CSV list of repos and validate
- that the repo has a tsconfig
- that the repo has an .nvmrc file
- that the PR modified some code files (tsx, jsx, ts, etc)
- that the PR contains only one line change in the package.json, meaning only one package has been upgraded

The resulting data is what we use as our evaluation dataset.

# Directories

- `data`: contains csv files by year that are the result of running the query.sql per year.
- `results`: contains the evaluation dataset, which is a list of csvs broken down by year.



# License

`MIT`