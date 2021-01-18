"use strict";

exports.registerHost = async (channel, state, registration) => {
    if (state.allHostTeams.includes(registration)) {
        await channel.send("That is already a host registration.");
    }

    if (state.allNonHostTeams.includes(registration)) {
        await channel.send("That is already a non-host registration.");
    }

    state.allHostTeams.push(registration);
    await channel.send(
        "`"
        + registration
        + "` is now registered as a host "
        + state.unitName
        + ".",
    );
};
