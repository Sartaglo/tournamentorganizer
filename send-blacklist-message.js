"use strict";

exports.sendBlacklistMessage = async (channel, state) => {
    await channel.send(
        state.blacklist.length === 0
            ? "No players are banned for the next tournament."
            : ("The following "
                + state.blacklist.length
                + " player"
                + (state.blacklist.length === 1 ? " is" : "s are")
                + " banned from the next tournament: "
                + state.blacklist.join(", ")),
    );
}
