# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
. ~/.nvm/nvm.sh

git pull origin main
docker-compose build && docker-compose stop && docker-compose up -d
# yarn setup
# yarn clearDb
# yarn loadFromLogs
# yarn start