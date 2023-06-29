# Retool CLI

A CLI tool to interface with [Retool](https://retool.com/). A Retool account is required to use. Run `retool signup` to create an account in 20 seconds.

## Installation

1. `npm install -g retool-cli`

See [this guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) to resolve EACCES permissions errors.

## Usage Instructions

`retool --help`

## Building from Source

1. `git clone https://github.com/tryretool/retool-cli.git`
2. `cd retool-cli`
3. `npm i && npm run build`
4. `npm install -g .` Installs the `retool` command globally on your machine.

## How to add a new command

1. Add a new file to `src/commands`, here's a [good template](https://gist.github.com/PeteTheHeat/7bbbfa31af6cd51096f2e9e1889aac7e).
2. `npm run build`
3. `retool login` Protip: login once, then save the `lib/utils/.retool_cli_credentials` file somewhere on disk to
   use in the future. I set up this alias `alias login='cp ~/workspace/.retool-cli-credentials ./lib/utils/'` so
   step 2/3 become `npm run build && login`
4. `retool commandName`
