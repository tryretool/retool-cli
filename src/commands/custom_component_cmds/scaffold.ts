import { Argv } from "yargs";

exports.command = "scaffold";
exports.desc = "Scaffold a new custom component";
exports.builder = {};
exports.handler = function (argv: Argv) {
  console.log("scaffolding a new custom component");
};
