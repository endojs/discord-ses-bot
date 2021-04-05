# SES Discord Bot

Welcome to SES-bot!
  
You can run JavaScript commands with the "/eval" prefix, and they are run in your own personal SES container!
You can't assign variables in these commands, but you have a "my" object you can hang variables on.
You can also add objects to your "share" object, to make them available to everyone.
You can find the objects others have shared in your "others" object, by their ID.
A member can have SES-bot print their ID by calling "/eval id".

## Running your own

[Create a Discord App](https://discord.com/developers/applications) and then use its settings to set up `config.json` to look like this:

```
{
  "appKey": "YOUR_APP_KEY",
  "appToken": "YOUR_APP_TOKEN",
  "publicKey": "YOUR_PUBLIC_KEY"
}
```
Then run `yarn`, `yarn build`, and `yarn start`.
To resume after a crash, maybe use `nodemon index.js`.

If the `yarn` step fails on an M1 mac, consider installing the `node-canvas` native deps from your own preferred way first. For example, if you use homebrew, you can run `brew install pkg-config cairo pango libpng jpeg giflib librsvg`, and then try again.

## Moving between machines

As long as you move your `config.json` and `social-repl/swingset-kernel-state/` files to a new version of this repository, you can resume your machine state on another machine, in another folder, or whatever.

## Some Notes on Swingset

Most of our SwingSet is copied directly from Agoric's libraries. The `swingset` folder is for files that are copied ver batim. The `swingset-*.js` files in the root directory are customized.

# learnings
- i expected some features like forking/comming to be at the xsnap level
- default swingset doesnt run in xsnap!
- a simple swingset showing off device integration is helpful because computers are more interesting when connected to the outside world
