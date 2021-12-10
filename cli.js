#!/usr/bin/env node
const { program } = require('commander');
program
  .option('-p, --port <port>', 'port')
  .option('-h, --host <host>', 'host');

program.parse(process.argv);
const options = program.opts();

if (options.port !== undefined) {
  process.env.PORT = parseInt(options.port);
}
if (options.host !== undefined) {
  process.env.HOST = parseInt(options.host);
}
require('./server');
