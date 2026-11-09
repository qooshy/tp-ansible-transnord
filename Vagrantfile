# -*- mode: ruby -*-
# Laboratoire TransNord : toutes les VM sont décrites dans l'inventaire Ansible
# (ansible/inventories/lab/hosts.yml). Ce fichier ne fait que le lire :
# il n'y a qu'UNE source de vérité pour les noms, les IP et la taille des VM.
#
#   vagrant up            -> crée toutes les VM puis lance Ansible depuis ops01
#   vagrant up web01      -> crée/démarre une seule VM
#   vagrant provision ops01 -> relance le déploiement complet (idempotent)

require 'yaml'
require 'fileutils'

ROOT      = File.dirname(File.expand_path(__FILE__))
INVENTORY = File.join(ROOT, 'ansible', 'inventories', 'lab', 'hosts.yml')
CONTROL   = 'ops01'                        # la VM qui exécute Ansible
LAB_KEY   = File.join(ROOT, '.lab', 'id_ed25519')

LINUX_BOX   = ENV.fetch('LAB_LINUX_BOX', 'bento/debian-12')
WINDOWS_BOX = ENV.fetch('LAB_WINDOWS_BOX', 'gusztavvargadr/windows-server-2022-standard-core')

# --- Lecture de l'inventaire ------------------------------------------------
def walk(group, name, hosts, groups)
  group ||= {}
  (group['hosts'] || {}).each do |h, vars|
    hosts[h] ||= {}
    hosts[h].merge!(vars || {})
    (groups[h] ||= []) << name
  end
  (group['children'] || {}).each { |cname, child| walk(child, cname, hosts, groups) }
end

hosts  = {}
groups = {}
walk(YAML.load_file(INVENTORY)['all'], 'all', hosts, groups)

# ops01 en dernier : il déploie les autres une fois qu'elles sont démarrées
order = hosts.keys.partition { |h| h != CONTROL }.flatten

# --- Clé SSH du labo (générée une fois sur le PC hôte) ----------------------
unless File.exist?(LAB_KEY)
  FileUtils.mkdir_p(File.dirname(LAB_KEY))
  ok = system('ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'ansible@ops01', '-f', LAB_KEY)
  abort "ssh-keygen introuvable : installez OpenSSH client" unless ok
end
LAB_PUBKEY = File.read("#{LAB_KEY}.pub").strip

# Utilisateur technique "ansible" (clé uniquement, sudo sans mot de passe).
LINUX_BOOTSTRAP = <<~SHELL
  set -e
  id ansible >/dev/null 2>&1 || useradd -m -s /bin/bash -c "Compte technique Ansible" ansible
  install -d -m 700 -o ansible -g ansible /home/ansible/.ssh
  echo '#{LAB_PUBKEY}' > /home/ansible/.ssh/authorized_keys
  chown ansible:ansible /home/ansible/.ssh/authorized_keys && chmod 600 /home/ansible/.ssh/authorized_keys
  echo 'ansible ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/ansible && chmod 440 /etc/sudoers.d/ansible
SHELL

Vagrant.configure('2') do |config|
  config.vm.box_check_update = false
  config.vm.synced_folder '.', '/vagrant', disabled: true

  order.each do |name|
    vars    = hosts[name]
    windows = groups[name].include?('windows')
    # Ports d'accès fixes et uniques par machine (dérivés du dernier octet de l'IP),
    # pour éviter les collisions quand les VM sont démarrées séparément.
    octet = vars['ansible_host'].split('.').last.to_i

    config.vm.define name, autostart: true do |m|
      m.vm.box = windows ? WINDOWS_BOX : LINUX_BOX
      m.vm.network 'private_network', ip: vars['ansible_host']
      m.vm.network 'forwarded_port', id: 'ssh', guest: 22, host: 22000 + octet, host_ip: '127.0.0.1'
      if windows
        m.vm.network 'forwarded_port', id: 'winrm', guest: 5985, host: 25000 + octet, host_ip: '127.0.0.1'
        m.vm.network 'forwarded_port', id: 'winrm-ssl', guest: 5986, host: 26000 + octet, host_ip: '127.0.0.1'
        m.vm.network 'forwarded_port', id: 'tcp53389', guest: 3389, host: 23000 + octet, host_ip: '127.0.0.1'
      end

      m.vm.provider 'virtualbox' do |vb|
        vb.name         = "transnord-#{name}"
        vb.memory       = vars.fetch('vm_memory', 1024)
        vb.cpus         = vars.fetch('vm_cpus', 1)
        vb.linked_clone = true
        vb.gui          = false
        vb.customize ['modifyvm', :id, '--groups', '/TransNord']
      end

      if windows
        m.vm.guest          = :windows
        m.vm.communicator   = 'winrm'
        m.winrm.username    = 'vagrant'
        m.winrm.password    = 'vagrant'
        m.vm.boot_timeout   = 1800
        m.winrm.retry_limit = 60
      else
        m.vm.provision 'bootstrap', type: 'shell', inline: LINUX_BOOTSTRAP
      end

      next unless name == CONTROL

      # ops01 : le dépôt est monté dans /srv/infra, puis Ansible déploie tout.
      m.vm.synced_folder '.', '/srv/infra', mount_options: ['dmode=755', 'fmode=644']
      m.vm.provision 'control', type: 'shell', path: 'scripts/bootstrap-control.sh'
      m.vm.provision 'deploy', type: 'shell', privileged: false,
                     inline: 'bash /srv/infra/scripts/deploy playbooks/site.yml'
    end
  end
end
