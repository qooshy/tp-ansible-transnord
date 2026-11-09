#!/bin/bash
# Labo : lance un playbook en tâche de fond sur ops01 (journal : ~/deploy.log)
cd /srv/infra/ansible
nohup bash ../scripts/deploy "${@:-playbooks/site.yml}" > ~/deploy.log 2>&1 &
echo "lancé"
