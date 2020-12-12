# Tournament Organizer

This is a Discord bot designed to ameliorate the process of running a Mario Kart
Wii tournament in Mogi Lounge (https://discord.gg/HkbxJAM).

## Setup

Currently, I am running the bot locally during development and relying on local
file storage to send text files on Discord and keep back-ups of the current
state in case something goes wrong. The bot also only responds to me and cannot
be added to servers by anyone else.

Nevertheless, the code can still be ran by anyone with the proper setup. Here
are the prerequisites:
- A local copy of the repository;
- Node.js and NPM;
- Google Docs API access; and
- a Discord bot.

1. Download `credential.json` as explained [here](
https://developers.google.com/docs/api/quickstart/nodejs) and store it as
`googleapis-credentials.json` in this directory.
2. Create `discord-token.json` in this directory consisting of your Discord
bot's token surrounded by double quotes. You can find the token by going [here](
https://discord.com/developers/applications), selecting your bot, and then
navigating to the "Bot" tab in the left-hand sidebar.
3. Update [this line](
https://github.com/Sartaglo/tournamentorganizer/blob/541b5ae1b7a97f774146ed3340f0c794c04c020d/act-on-message.js#L551)
in the code to whomever you wish the bot to respond to.
3. Run `npm install` in this directory and then run `npm start`.
4. Navigate to provided URL to authorize your Google account, bypassing
the verification warning as explained [here](
https://developers.google.com/docs/api/quickstart/nodejs#this_app_isnt_verified),
and then enter the provided access code. This will create
`googleapis-token.json` for repeated use.
5. Add your bot to a server and permit it to send and receive messages in the
channels of your choosing.

## Commands

Commands are executed by mentioning the bot and then providing the command and
any parameters as needed.

`initialize <documentId> <teamSize> <hostCount> <nonHostCount>`

Loads registrations from the identified Google Doc according to the parameters.

`rooms`

Randomly generates rooms for the current round, choosing the best number of
rounds corresponding to the number of players and team size that divides evenly
into a final room.

`round <roundNumber>`

Switches to the identified round, mainly so that next round's rooms can be
generated and teams can start being advanced from that round.

```
advance <roomNumber>
<registration>
[...]
```

Adds the given teams, each on its own line, to next round, so that they will be
part of next round's next room generation.

```
unadvance <roomNumber>
<registration>
[...]
```

Removes the given teams, each on its own line, from next round, so that they
will not be part of next round's next room generation.

## Roadmap

- [ ] A `status` command to provide a summary of rooms in the current round,
specifically how many rooms have the expected number of advancements and which
rooms do not.
- [ ] The implementation of a simpler command prefix than mentioning.
- [ ] Configuration of the bot to respond to tournament organizers.
- [ ] The ability to restore the state of the bot after it is restarted.
- [ ] Restructuring of the bot to support running it headless on a server.
- [ ] Preventing a team from being advanced in a room they were not in.
- [ ] The ability to register or unregister a team after initialization.
- [ ] Keeping track of no-shows.
