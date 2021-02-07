"use strict";

const fs = require("fs");

exports.sendOutput = async (
    channel,
    baseContent,
    messages,
    fileName,
    files,
) => {
    if (baseContent.length + 1 + messages.join("\n").length > 2000) {
        fs.writeFileSync(fileName, messages.join("\r\n") + "\r\n");
        files.unshift(fileName);
        await channel.send(
            baseContent + " Check `" + fileName + "` for additional output.",
            { files: [...files, fileName] },
        );
    } else {
        await channel.send([baseContent, ...messages].join("\n"), { files });
    }
};

