# git-broadcast

Utility to merge outwards from one branch to all others, where cleanly possible

⚗️ This is a young project, but it's working for me. YMMV.

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
