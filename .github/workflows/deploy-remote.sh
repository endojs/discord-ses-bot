# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
. ~/.nvm/nvm.sh

git fetch origin && git switch $GITHUB_REF
docker-compose build && docker-compose stop && docker-compose up -d
