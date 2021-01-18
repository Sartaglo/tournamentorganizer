"use strict";

exports.getRoomResults = async (channel, state, roomNumber) => {
    if (!state.rounds.has(state.currentRoundNumber)) {
        await channel.send(
            "Round " + state.currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const { advancementsByRoom } = state.rounds.get(state.currentRoundNumber);

    await channel.send(
        "Room "
        + roomNumber
        + " of round "
        + state.currentRoundNumber
        + " has "
        + (advancementsByRoom.has(roomNumber)
            && advancementsByRoom.get(roomNumber).length > 0
            ? ("the following advancement"
                + (advancementsByRoom.get(roomNumber).length === 1 ? "" : "s")
                + ":\n"
                + advancementsByRoom.get(roomNumber).join("\n"))
            : "zero advancements."),
    );
};
