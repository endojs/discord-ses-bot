echo "$SSH_PRIVATE_KEY" > key.txt
ssh -i key.txt "$REMOTE_USER@$REMOTE_HOST" 'bash -s' < ./deploy.sh