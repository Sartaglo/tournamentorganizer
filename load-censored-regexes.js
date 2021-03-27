"use strict";

const fs = require("fs");

exports.loadCensoredRegexes = async (channel, state, verbose) => {
    const fileName = "censored-regex.txt";

    if (!fs.existsSync(fileName)) {
        if (verbose) {
            await channel.send("File " + fileName + " not found.");
        }

        return;
    }

    const content = fs.readFileSync(fileName).toString("utf-8");
    const regexes = content.split("\n").filter((regex) => regex.length > 0);
    const censoredRegex = regexes.length > 0
        ? new RegExp(regexes.join("|"), "ig")
        : null;
    state.censoredRegex = censoredRegex;

    if (verbose) {
        await channel.send(
            "Loaded "
            + regexes.length
            + " censored regular expression"
            + (regexes.length === 1 ? "" : "s")
            + ".",
        );
    }
};
