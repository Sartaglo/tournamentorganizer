"use strict";

exports.unregister = async (channel, state, registration) => {
    const hostIndex = state.allHostTeams.findIndex(
        (hostTeam) => hostTeam === registration,
    );

    if (hostIndex !== -1) {
        state.allHostTeams.splice(hostIndex, 1);
        await channel.send(
            "`" + registration + "` is no longer a host registration.",
        );
    }

    const nonHostIndex = state.allNonHostTeams.findIndex(
        (nonHostTeam) => nonHostTeam === registration,
    );

    if (nonHostIndex !== -1) {
        state.allNonHostTeams.splice(nonHostIndex, 1);
        await channel.send(
            "`" + registration + "` is no longer a non-host registration.",
        );
    }

    if (hostIndex === -1 && nonHostIndex === -1) {
        await channel.send("`" + registration + "` is not registered.");
    }
};
