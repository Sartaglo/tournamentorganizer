"use strict";

const { sendBlacklistMessage } = require("./send-blacklist-message");

exports.removeFromBlacklist = async (channel, state, names) => {
    names.forEach(
        (name) => {
            const index = state.blacklist.findIndex(
                (item) => item.toLowerCase().replace(/\s+/g, "")
                    === name.toLowerCase().replace(/\s+/g, ""),
            );

            if (index === -1) {
                return;
            }

            state.blacklist.splice(index, 1);
        },
    );
    await sendBlacklistMessage(channel, state);
};
