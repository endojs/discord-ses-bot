# docker stop
echo "updating server"
git pull origin main
yarn setup
yarn clearDb
yarn loadFromLogs
yarn start