const { appKey, appToken, publicKey } = require('./config.json');
const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, 'log.txt');

require('ses');
lockdown();

// This int isn't sensitive, it just describes the permissions we're requesting:
const PERMISSIONS_INT = 2147503168;

const link = `https://discord.com/oauth2/authorize?client_id=${appKey}&scope=bot`;
console.log(`Starting SES-bot! Add to your discord server with this link: \n${link}`);

const { Client, Intents } = require('discord.js');
const { error } = require('console');
const client = new Client({ 
  client_id: appKey,
  scope: 'bot',
  permissions: PERMISSIONS_INT,
});

function executeLoggable (loggable, msg) {
  console.log(loggable);
  const components = loggable.split(':')
  const authorId = components.shift();
  const command = components.join(':');
  const author = getAuthor(authorId);

  let result
  try {

    result = author.compartment.evaluate(command);
  } catch (error) {
    result = `Error: ${error.message}`
  }

  let stringReply = JSON.stringify(result, null, 2);
  if (!stringReply) {
    stringReply = 'No result.'
  }
  console.log(`> ${stringReply}`);
  if (!msg || !msg.reply) return;
  msg.reply(stringReply);
}

client.login(appToken);

const authorMap = new Map();
function getAuthor(id) {
  let author = authorMap.get(id);
  if (!author) {
    author = createUser(id);
    authorMap.set(id, author);
  } 
  return author;
}

const shareBoxes = {};
const inboxes = {};
function createUser (id) {
  const shareBox = {};
  shareBoxes[id] = shareBox;
  const inbox = {};
  inboxes[id] = {};
  const compartment = new Compartment({
    my: {},
    id: harden(id),
    share: shareBox,
    send: (to, label, object) => {
      let recipientBox = inboxes[to];
      if (!recipientBox) {
        recipientBox = {};
        inboxes[to] = recipientBox;
      }

      let myBox = recipientBox[id];
      if (!myBox) {
        myBox = {};
        recipientBox[id] = myBox;
      }

      myBox[label] = object;
    },
    inbox: {},
    others: createReadable(shareBoxes),
    print: harden(console.log),
    help,
  });
  return {
    compartment,
  }
}

function createReadable (obj) {
  return new Proxy(obj, {
    get: (target, prop, receiver) => {
      return harden(obj[prop]);
    }
  });
}

function help () {
  return `Welcome to SES-bot!
  
  You can run JavaScript commands with the "/eval" prefix, and they are run in your own personal SES container!
  You can't assign variables in these commands, but you have a "my" object you can hang variables on.
  You can also add objects to your "share" object, to make them available to everyone.
  You can find the objects others have shared in your "others" object, by their ID.
  You can send an object to a specific user by calling "send(otherId, label, object)".
  They can access objects sent from you at their "inbox[yourId][yourLabel]".
  A member can have SES-bot print their ID by calling "/eval id".
  You can read my source code here: https://github.com/danfinlay/discord-ses-bot
  `;
}

function replayPast () {
  try {
    const logFile = fs.readFileSync(logPath).toString();
    console.log('replaying logFile');
    const loggableCommands = logFile.split('\n');
    loggableCommands.forEach(executeLoggable);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No logfile found, starting new one.')
      fs.writeFileSync(logPath, '0:0\n');
    } else {
      console.error(err);
      throw err;
    }
  }
}

replayPast();
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  const authorId = msg.author.id;
  const message = msg.content;

  if (message.indexOf('/eval') === 0) {
    // This is a command for us!

    const command = message.substr(6); // Cut off the 'eval' prefix
    const loggable = `${authorId}: ${command}`;
    fs.appendFile(logPath, loggable + '\n', (err) => {
      if (err) {
        console.error(`Problem appending to file`, err);
        return;
      }
      executeLoggable(loggable, msg);
    });
  }
});
