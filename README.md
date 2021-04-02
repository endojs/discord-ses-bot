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
Then run `yarn` and `yarn start`.
To resume after a crash, maybe use `nodemon index.js`.