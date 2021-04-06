# docker stop
echo "updating server"
cd /root/project/discord-ses-bot
. ~/.nvm/nvm.sh

echo "switching to $GITHUB_REF"

git fetch origin && git switch $GITHUB_REF
docker-compose build && docker-compose stop && docker-compose up -d
