# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
. ~/.nvm/nvm.sh

echo "switching to $GITHUB_SHA"

git fetch origin && git switch $GITHUB_SHA
docker-compose build && docker-compose stop && docker-compose up -d
