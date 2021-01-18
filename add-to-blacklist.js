"use strict";

const { sendBlacklistMessage } = require("./send-blacklist-message");

exports.addToBlacklist = async (channel, state, names) => {
    names.forEach(
        (name) => {
            if (state.blacklist.includes(name)) {
                return;
            }

            state.blacklist.push(name);
        },
    );
    await sendBlacklistMessage(channel, state);
};
