# Tournament Organizer 3.0

This is a Discord bot designed to ameliorate the process of running a Mario Kart
Wii tournament in Mogi Lounge (https://discord.gg/HkbxJAM).

## Bot Setup
1. Open the Windows Start menu (Windows key on your keyboard) and search for Windows PowerShell.
1. Click Run as Administrator on the right-hand side and then click Yes when prompted.
1. Type the following command into the window and then press Enter to run it: `wsl --install`
1. Restart your machine. Visit https://learn.microsoft.com/en-us/windows/wsl/install if you wish to see more detailed instructions.
1. After restarting, open the Windows Start menu again and search WSL.
1. Run the following command to retrieve the application code from the GitHub repository and create a local copy on your computer, within the Windows Subsystem for Linux.: `git clone https://github.com/sartaglo/tournamentorganizer`
1. Run the following command to move to your new local copy of the application code folder: `cd tournamentorganizer`
1. Run the following command to open File Explorer in this folder, including the period at the end of the command (it means the current folder): `explorer.exe .`

    We will be saving a Google Cloud credential file to this location later.
1. Visit https://console.cloud.google.com/apis/library/docs.googleapis.com
1. Accept the Google Cloud Terms of Service if prompted.
1. Click Enable and then log into your Google account if prompted. Note that if you are already signed into at least one Google account, it will use the first one you logged into. The easiest way to change this is to log out of all your accounts and then log into the one you want to use here.
1. If you weren't logged into a Google account already, click Enable again afterward when prompted.
1. Go to Credentials in the left-hand navigation list (if you don't see this, visit https://console.cloud.google.com/apis/credentials first).
1. Click Create Credentials and then Service Account.
1. Enter a service account ID, e.g., service-account.
1. Click Done.
1. **Note the service account email in the list. You will need to grant Editor access to any Google Docs registration documents when running tournaments.**
1. Click on the service account email in the list.
1. Go to the Keys tab.
1. Click Add Key and then Create new key.
1. Click Create and then save the downloaded file to the application code folder we opened earlier. Note the full name of the file, including the .json file extension, as we will include it in the command to run the bot later.
1. Visit https://discord.com/developers/applications and log into your Discord account if prompted.
1. Click New Application in the top-right corner.
1. Enter a name, e.g., TO Bot, accept the terms of service, and then click Create.
1. Under General Information, note the Application ID. This is the Discord bot’s user ID that will be used to invite the bot to your Discord server.
1. Go to Bot in the left-hand navigation list.
1. Enter a username, e.g., TO Bot, which will be used by the bot in your Discord server.
1. Click Reset Token and then note the long string that is presented. **Do not share this token with anyone,** as it grants full control to the Discord bot. It will be used to connect the application code to the Discord bot to provide tournament organizer functionality. You can reset the token as many times as you want, but you will need to restart the bot with the new token each time.
1. Add the Discord bot your server by replacing {id} in the following URL with the Application ID (Discord bot's user ID): `https://discord.com/api/oauth2/authorize?client_id={id}&permissions=0&scope=bot%20applications.commands`

    Visit https://discordjs.guide/preparations/adding-your-bot-to-servers.html if you wish to understand this URL better.
1. Set up access for the bot in your Discord server, including access to the bot usage and registration channels when running a tournament. Anyone whose highest role is named anything in the following list will be able to use the bot:
    - Boss
    - CT Admin
    - Higher Tier RT Arbitrator
    - Lower Tier RT Arbitrator
    - Higher Tier CT Arbitrator
    - Lower Tier CT Arbitrator
    - Admin
    - Moderators
    - Tournament Organizers
    - Event Organizer
    - Event Organiser
    - Event Admin

    Note that the bot administrator specified in the command to run the bot doesn't need any such role.
1. Go back to the WSL window (or open WSL and re-run `cd tournamentorganizer` if you don't have it open anymore) and run the following command to open a persistent terminal session: `tmux new -s tobot`
    In short, tmux is a terminal emulator used in this case to keep a terminal command running indefinitely. It allows you to keep the bot running without needing to keep a window open on your computer. Note that it will stop running if you sign out of Windows.
1. Run the following command to install the npm packages required by the application code: `npm install`
1. Run the following command to start the Discord bot, replacing {Discord User Id} with your Discord account's user ID (or whoever you wish to be the administrator of the bot), {Bot Token} with the bot token copied from the Discord Developer Portal, and {Credential File Name} with the file name of the Google Cloud JSON file: `ADMIN_DISCORD_ID="{Discord User ID}" DISCORD_TOKEN="{Bot Token}" CREDENTIAL_FILE_NAME="{Credential File Name}" npm start`
1. To stop the bot, either send `,stop` as the administrator in a channel that is visible to the bot (can also be in DM's with the bot), or press CTRL+C within tmux.
1. To restart the bot, simply re-run the command above.
1. To disconnect from tmux, hold CTRL and press B then release CTRL and press D.
1. To reconnect to the terminal session at any point, reopen WSL, `cd tournamentorganizer`, and then run `tmux a -t tobot` to reattach to the terminal session.

## Bot Commands

Commands are executed by providing the command and any parameters as needed.

`,open <#registrationChannelId> <registrationDocumentId> <teamSize> [hostRoleId[ playerRoleId]]`

Starts watching the identified channel for users registering, updating existing
registrations, and unregistering. Registrations are validated against the
provided team size and stored in the identified Google Doc. If the host role and
player role IDs are provided, those roles are managed as part of registration.

`,close`

Stops watching the channel identified on open.

`,initialize <documentId> <teamSize> <hostCount> <nonHostCount>
[blacklistedPlayer,...]`

Loads registrations from the identified Google Doc according to the parameters.
Issues a warning about registrations that contain any of the blacklisted
players, provided as a comma-separated list.

`,rooms [roomCount advancementCount]`

Randomly generates rooms for the current round, choosing the best number of
rounds corresponding to the number of players and team size that divides evenly
into a final room. If room count and advancement count are provided then it will
generate that many rooms and expect to advance that many *players* (not teams)
instead.

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

## Registration Commands

### FFA
`!c Your Mii Name`

### 2v2
`!c Your Mii Name [Your Lounge name] Teammate 1 Mii Name [Teammate 1 Lounge
Name]`

### 3v3
`!c Your Mii Name [Your Lounge name] Teammate 1 Mii Name [Teammate 1 Lounge
Name] Teammate 2 Mii Name [Teammate 2 Mii Name]`

Registers your team as a non-hosting team. If you are already registered in a
team, it will replace that registration.

`!ch Your Mii Name [Your Lounge name] Teammate 1 Mii Name [Teammate 1 Lounge
Name]`

Registers your team as a hosting team. If you are already registered in a team,
it will replace that registration.

`!d`

Unregisters your team.

## Version 1.0 Roadmap

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
- [x] The ability to register or unregister a team after initialization.

## Version 2.0 Roadmap

- [x] Update the list of permitted roles for tournament organization (Boss,
HTRTA, LTRTA, HTCTA, LTCTA).
- [x] Split up `act-on-message.js` and manage state per Discord channel.
- [x] Implement a command for players to manage their own registrations,
including the ability to update the content of their registration and the
ability to unregister.

## Version 3.0 Roadmap

- [x] Support a more readable format in the registration document.
- [x] Store friend codes with host registrations.
- [x] Manage Tournament Host role.
- [x] Prevent teammates with the Muted role.
- [x] Check registrations against a list of censored words.
- [x] Manage player role on registrations.
- [x] Log blacklist changes in a globally-dedicated channel.

## Version 4.0 Roadmap
- [ ] Support existing registrants to easily swap between hosting and
non-hosting without copying and pasting their existing registration.
- [ ] Facilitate the ability to create a category and channels for a new
tournament, automating role creation and setup of permissions.
- [ ] Restore bot state from files.
- [ ] Automatically advance everyone in a room if the room has no more players
than the advancement count.
- [ ] Check manual registrations for duplicates or banned players.
- [ ] Warn about the host registration of hostbanned players.
- [ ] Reject asterisks, underscores, and colons in registrations to avoid issues
with Discord emojis and formatting.
