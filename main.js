"use strict";

const readline = require("readline");
const { runBot } = require("./run-bot");

const main = async () => {
    const destroy = await runBot();
    const readLineInterface = readline.createInterface(
        {
            input: process.stdin,
            output: process.stdout,
        },
    );
    readLineInterface.once(
        "line",
        () => {
            destroy();
            readLineInterface.close();
        },
    );
};

main();
