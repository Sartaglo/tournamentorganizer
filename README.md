# Tournament Organizer

This is a Discord bot (Tournament Organizer#7975) designed to ameliorate the
process of running a Mario Kart Wii tournament in Mogi Lounge
(https://discord.gg/HkbxJAM).

## Local Setup

If you wish to set up your own bot and run this code locally, here are the
prerequisites and the steps to do so:
- A local copy of the repository;
- Node.js and NPM;
- Google Docs API access; and
- a Discord bot.

1. Switch to the `local-setup` branch.
2. Download `credential.json` as explained [here](
https://developers.google.com/docs/api/quickstart/nodejs) and store it as
`googleapis-credentials.json` in this directory.
3. Create `discord-token.json` in this directory consisting of your Discord
bot's token surrounded by double quotes. You can find the token by going [here](
https://discord.com/developers/applications), selecting your bot, and then
navigating to the "Bot" tab in the left-hand sidebar.
4. Update [this line](
https://github.com/Sartaglo/tournamentorganizer/blob/811e24ed2bbae468eac6e55177d14b799cf5ab5e/act-on-message.js#L7)
in the code to whomever you wish the bot to respond to, in addition to anyone
with a role named "Boss", "Higher Tier Arbitrator", "Lower Tier Arbitrator", or
"Custom Track Arbitrator".
5. Run `npm install` in this directory and then run `npm start`.
6. Navigate to provided URL to authorize your Google account, bypassing
the verification warning as explained [here](
https://developers.google.com/docs/api/quickstart/nodejs#this_app_isnt_verified),
and then enter the provided access code. This will create
`googleapis-token.json` for repeated use.
7. Add your bot to a server and permit it to send and receive messages in the
channels of your choosing.

## Commands

Commands are executed by mentioning the bot and then providing the command and
any parameters as needed.

`,initialize <documentId> <teamSize> <hostCount> <nonHostCount>
[blacklistedPlayer,...]`

Loads registrations from the identified Google Doc according to the parameters.
Issues a warning about registrations that contain any of the blacklisted
players, provided as a comma-separated list.

`,rooms`

Randomly generates rooms for the current round, choosing the best number of
rounds corresponding to the number of players and team size that divides evenly
into a final room.

`,round <roundNumber>`

Switches to the identified round, mainly so that next round's rooms can be
generated and teams can start being advanced from that round.

```
,advance <roomNumber>
<registration>
[...]
```

Adds the given teams, each on its own line, in the identified room to next
round, so that they will be part of next round's next room generation.

```
,unadvance <roomNumber>
<registration>
[...]
```

Removes the given teams, each on its own line, in the identified room from next
round, so that they will not be part of next round's next room generation.

`,results <roundNumber>`

Displays the current advancements for the identified room in the current round.

`,status`

Displays how many rooms are done in the current round and lists the rooms that
aren't done.

`,blacklist [add|remove <blacklistedPlayer>,[...]]`

Adds to, removes from, or lists the players banned from the next tournament.
Note that this blacklist is independent of the list provided to `initialize`
that applies to the current tournament.

## Roadmap

- [x] A `status` command to provide a summary of rooms in the current round,
specifically how many rooms have the expected number of advancements and which
rooms do not.
- [x] The implementation of a simpler command prefix than mentioning.
- [x] Configuration of the bot to respond to tournament organizers.
- [x] Restructuring of the bot to support running it headless on a server.
- [x] Warn about a team being advanced in a room they were not in.
- [x] Prevent a team from being advanced more than once in the same round.
- [x] Warn about the registration of banned players.
- [x] Keeping track of banned players.
- [ ] The ability to register or unregister a team after initialization.
