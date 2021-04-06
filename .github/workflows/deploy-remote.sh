# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
git pull origin main
yarn setup
yarn clearDb
yarn loadFromLogs
yarn start