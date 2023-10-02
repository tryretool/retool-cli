# Retool CLI

A simple command line interface for [Retool](https://retool.com/). Run `retool signup` to create a Retool account in 20 seconds.

Open an issue in this repository for feature requests. PRs welcome!

![Screenshot of the retool help command](https://i.imgur.com/ojYlw0i.png)

## Installation & Updating

1. `npm install -g retool-cli`

Node.js is a requirement, it can be installed [here](https://nodejs.org/en/download). See [this guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) to resolve EACCES permissions errors.

## Usage Instructions

`retool --help`

`retool <command> --help`

## Building from Source

1. `git clone https://github.com/tryretool/retool-cli.git`
2. `cd retool-cli`
3. `npm i && npm run dev`
4. `npm install -g .` Installs the `retool` command globally on your machine.

## Contribution Guide

### Extending an existing command

1. Locate the command file in `src/commands/`.
2. Add a new flag to the `builder` object and provide a clear description. This description will be displayed to the user in the help command.
3. Handle the new flag by adding an `else if (argv.newFlag)` statement to the handler function.

### Adding a new command

1. Create a new file in the `src/commands` directory, ensure it exports a `CommandModule`.
2. `npm run dev` to start TS compiler.
3. `retool login` to authenticate.
4. `retool commandName` to test command.

### General guidelines

- Retool CLI adheres to the principles outlined in [this](https://clig.dev/) CLI guide:
  - Keep output succinct.
  - In help output:
    - Use `<>` to indicate required params and `[]` for optional params.
    - Provide a usage example if appropriate.
  - Errors should be presented in a human-readable format.
  - Hide debug output behind a `process.env.DEBUG` check.
- Any files in `src/commands/` directory will become a top-level commands.
- Shared logic should be placed in `src/utils/` directory.
