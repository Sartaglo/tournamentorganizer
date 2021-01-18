"use strict";

exports.getRoundStatus = async (channel, state) => {
    if (!state.rounds.has(state.currentRoundNumber)) {
        await channel.send(
            "Round " + state.currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const {
        advancementsByRoom,
        advancementCount,
    } = state.rounds.get(state.currentRoundNumber);

    if (advancementsByRoom.size === 0 || advancementCount === null) {
        await channel.send(
            "Rooms have not been made for round "
            + state.currentRoundNumber
            + ".",
        );

        return;
    }

    const advancingTeamCount = advancementCount / state.currentTeamSize;
    const notDoneRoomNumbers = Array.from(advancementsByRoom)
        .filter(
            ([_, advancements]) => advancements.length !== advancingTeamCount,
        )
        .map(([roomNumber]) => roomNumber);

    const countIndicator = (notDoneRoomNumbers.length === 1 ? " is" : "s are");
    await channel.send(
        "Round "
        + state.currentRoundNumber
        + " has "
        + (advancementsByRoom.size - notDoneRoomNumbers.length)
        + " out of "
        + advancementsByRoom.size
        + " rooms with "
        + advancingTeamCount
        + "/"
        + advancingTeamCount
        + " "
        + state.unitName
        + (advancingTeamCount === 1 ? "" : "s")
        + " advanced"
        + "."
        + (notDoneRoomNumbers.length === 0
            ? ""
            : (" The following room"
                + countIndicator
                + " not done: "
                + notDoneRoomNumbers.reduce(
                    (accumulator, roomNumber, index, self) => {
                        if (self.length === 2) {
                            return accumulator + " and " + roomNumber;
                        }

                        if (index < self.length - 1) {
                            return accumulator + ", " + roomNumber;
                        }

                        return accumulator + ", and " + roomNumber;
                    },
                )
                + "."
            )
        ),
        {
            files: [
                channel.id
                + "-round-"
                + state.currentRoundNumber
                + "-rooms.txt",
            ],
        },
    );
};
