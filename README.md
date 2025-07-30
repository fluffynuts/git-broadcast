# git-broadcast

Utility to merge outwards from one branch to all others, where cleanly possible

## Usage
Run via `npx`, eg `npx -y git-broadcast`

### Commandline options:
Run `npx -y git-broadcast --help` to get help at the cli. Other options include:

- `-f|--from {branchName}` specify the source branch (default: 'master')
- `-t|--to {branchName}` specify the target branch(es) (default: '*' - selects all branches except the source)
- `--ignore-missing-branches` - when a branch explicitly specified at the cli is not found, do not error
- `-i|--in` - run in the specified folder instead of the current working directory
- `-v|--verbose` - output more logging info (default: off)
- `-p|--push` - attempt to push back to the remote after a successful merge (default: on)
- `--git-user` - specify the username for git
- `--git-token` - provide an auth token for git
- `--print-summary` - print a summary at the end, useful for reporting elsewhere (default: off)
- `--pretty` - enable pretty logging (emoji, formatting with backticks, etc) for forwarding to, eg, slack
- `--show-version` - show the version of git-broadcast during normal operations
- `--suppress-log-prefixes` - suppress log prefixes like timestamp and log level for cleaner output
- `--prefix-logs-with` - prefix all logging with this string, eg your repo name to disambiguate outputs
- `--ignore` - one or more space-separated branch names to ignore (don't update them), can be specified more than once 
- `--version` - print out the current version of the tool
- `--help` - get this help in a console

`git-broadcast` will also honor the GIT_BROADCAST_IGNORE_BRANCHES environment variable
which can contain a comma-separated list of branches to always ignore, _in addition to_
any branches specified with `-i` on the cli.


## Configuring at GitHub Actions so you have to merge less into feature branches

See the example workflow file to have your master branch merged
out to satellite branches whenever it's updated or satellites
are updated (just in case a prior run had failed but now could
be completed):

Note that the following uses (and pipes through) `slack-webhook-say`
to provide real-time(-ish) feedback in a slack channel.

```yaml
name: Broadcast master updates to satellites

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2-beta
      with:
        node-version: '12'
    - name: broadcast master changes to satellite branches
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        RUN_NUMBER: ${{ github.run_number }}
      run: |
        git config --global user.name "Git Broadcast"
        git config --global user.email "git-broadcast@no-reply.com"
        npx slack-webhook-say -m "Starting Git-Broadcast run #$RUN_NUMBER on $GITHUB_REPOSITORY"
        npx git-broadcast@latest --from master --push --pretty --suppress-log-prefixes --prefix-logs-with $GITHUB_REPOSITORY | npx slack-webhook-say --echo
        npx slack-webhook-say -m "Git-Broadcust run #$RUN_NUMBER on $GITHUB_REPOSITORY completed"

```
