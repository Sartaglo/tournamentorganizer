"use strict";

const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

const tokenPath = "googleapis-token.json";

const createToken = (oAuth2Client, callback) => {
    const authorizationUrl = oAuth2Client.generateAuthUrl(
        {
            access_type: 'offline',
            scope: ["https://www.googleapis.com/auth/documents.readonly"],
        },
    );
    console.log("Authorize this app by visiting this URL:", authorizationUrl);
    const readLineInterface = readline.createInterface(
        {
            input: process.stdin,
            output: process.stdout,
        },
    );
    readLineInterface.question(
        "Enter the code from that page here: ",
        (code) => {
            readLineInterface.close();
            oAuth2Client.getToken(
                code,
                (error, token) => {
                    if (error) {
                        console.error("Error retrieving access token:", error);

                        return;
                    }

                    oAuth2Client.setCredentials(token);
                    fs.writeFile(
                        tokenPath,
                        JSON.stringify(token),
                        (error) => {
                            if (error) {
                                console.error(error);

                                return;
                            }

                            console.log("Token stored to", tokenPath);
                        },
                    );
                    callback(oAuth2Client);
                }
            )
        }
    );
    readLineInterface.close();
};

const authorize = (credentials, callback) => {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0],
    );
    fs.readFile(
        tokenPath,
        (error, token) => {
            if (error) {
                return createToken(oAuth2Client, callback);
            }

            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client);
        },
    );
};

module.exports = {
    useDocs: () => {
        return new Promise(
            (resolve, reject) => {
                fs.readFile(
                    "googleapis-credentials.json",
                    (error, content) => {
                        if (error) {
                            reject(
                                "Error loading client secret file: " + error,
                            );

                            return;
                        }

                        authorize(
                            JSON.parse(content),
                            (auth) => {
                                resolve(
                                    google.docs({ version: 'v1', auth }),
                                );
                            },
                        );
                    },
                );
            },
        );
    },
};
