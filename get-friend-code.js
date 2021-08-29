"use strict";

const axios = require("axios").default;

exports.getFriendCode = async (userId) => {
    const response = await axios.get(
        "https://mariokartboards.com/lounge/api/hostfc.php?discord_guild_id="
        + "387347467332485122"
        + "&discord_user_id="
        + userId,
    );
    const results = response.data.results;

    if (results.length !== 1) {
        return null;
    }

    return results[0].fc;
};
