# Retool CLI

A simple command line interface for [Retool](https://retool.com/). Run `retool signup` to create a Retool account in 20 seconds.

Open an issue in this repository for feature requests. PRs welcome!

![Screenshot of the retool help command](https://i.imgur.com/OJhsHiv.png)

## Installation

1. `npm install -g retool-cli`

Node.js is a requirement, it can be installed [here](https://nodejs.org/en/download). See [this guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) to resolve EACCES permissions errors.

## Usage Instructions

`retool --help`

`retool <command> --help`

## Building from Source

1. `git clone https://github.com/tryretool/retool-cli.git`
2. `cd retool-cli`
3. `npm i && npm run build`
4. `npm install -g .` Installs the `retool` command globally on your machine.

## How to add a new command

1. Add a new file to `src/commands`, it should export a `CommandModule`.
2. `npm run build && npm run dev`
3. `retool login`
4. `retool commandName`
