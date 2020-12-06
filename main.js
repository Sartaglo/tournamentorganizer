"use strict";

const { useDocs } = require("./use-docs");

const tryUseDocs = async () => {
    try {
        return await useDocs();
    } catch (error) {
        console.error("Error using Docs:", error);

        return null;
    }
}

const main = async () => {
    const docs = await tryUseDocs();

    if (docs === null) {
        return;
    }

    docs.documents.get(
        { documentId: "1WipN6JeuMbRtMNn3iJngNJvqB8omr0Z2qWWuIDXuP1g" },
        (error, response) => {
            if (error) {
                console.error("The API returned an error:", error);

                return;
            }

            console.log(response.data.title);
        },
    );
};

main();
