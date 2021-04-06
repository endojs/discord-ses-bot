echo "$SSH_PRIVATE_KEY" > key.txt
chmod 600 key.txt

echo 'PermitUserEnvironment yes' >> /etc/ssh/sshd_config
/etc/init.d/ssh restart

ssh -i key.txt \
  -o PermitUserEnvironment=yes \
  -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" 'bash --login -s' \
  < .github/workflows/deploy-remote.sh