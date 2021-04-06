# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
git pull origin main
/root/.nvm/versions/node/v14.16.0/bin/yarn setup
/root/.nvm/versions/node/v14.16.0/bin/yarn clearDb
/root/.nvm/versions/node/v14.16.0/bin/yarn loadFromLogs
/root/.nvm/versions/node/v14.16.0/bin/yarn start