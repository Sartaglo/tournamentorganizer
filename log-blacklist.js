"use strict";

exports.logBlacklist = async (botChannel, state) => {
    const logChannel = await botChannel.client.channels.fetch(
        "805586975280594975",
        false,
        true,
    );
    await logChannel.send(
        "#"
        + botChannel.name
        + ": "
        + (state.blacklist.length === 0
            ? "No players are banned for the next tournament."
            : ("The following "
                + state.blacklist.length
                + " player"
                + (state.blacklist.length === 1 ? " is" : "s are")
                + " banned from the next tournament: "
                + state.blacklist.join(", "))),
    );
}
