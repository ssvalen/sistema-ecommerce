# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# Antes del primer `vagrant up` (Git Bash): bash deploy/init-secrets.sh
# Publicar una versión nueva: bash deploy/release.sh

def read_env_file(path)
  File.readlines(path, chomp: true).each_with_object({}) do |line, values|
    line = line.strip
    next if line.empty? || line.start_with?('#')

    key, value = line.split('=', 2)
    values[key.strip] = value.to_s.strip if key
  end
end

cluster = read_env_file(File.join(__dir__, 'deploy', 'cluster.env'))

if (ARGV & %w[up provision reload]).any? && !File.exist?(File.join(__dir__, 'deploy', 'secrets.env'))
  abort 'Falta deploy/secrets.env. Genéralo con: bash deploy/init-secrets.sh'
end

# El rol de cada nodo de base sale de CURRENT_PRIMARY (failover.sh lo cambia).
# El primario va primero: la réplica se inicializa desde él.
primary = cluster.fetch('CURRENT_PRIMARY')
db_role = ->(name) { name == primary ? 'primary' : 'standby' }
DB_NODES = [
  {
    name: 'data1', ip: cluster.fetch('DATA1_IP'), cpus: 1, memory: 1024,
    provision: [['deploy/db/install-db.sh', [db_role.call('data1')]]]
  },
  {
    name: 'data2', ip: cluster.fetch('DATA2_IP'), cpus: 1, memory: 1024,
    provision: [['deploy/db/install-db.sh', [db_role.call('data2')]], ['deploy/cache/install-cache.sh', []]]
  }
].sort_by { |node| node[:name] == primary ? 0 : 1 }

NODES = [
  *DB_NODES,
  {
    name: 'app1', ip: cluster.fetch('APP1_IP'), cpus: 1, memory: 1024,
    provision: [['deploy/app/install-app.sh', ['api-1', '--migrate', '--spa']]]
  },
  {
    name: 'app2', ip: cluster.fetch('APP2_IP'), cpus: 1, memory: 768,
    provision: [['deploy/app/install-app.sh', ['api-2']]]
  },
  {
    name: 'edge', ip: cluster.fetch('EDGE_IP'), cpus: 1, memory: 512,
    provision: [['deploy/edge/install-edge.sh', []]]
  }
].freeze

Vagrant.configure('2') do |config|
  config.vm.box = 'bento/ubuntu-24.04'
  config.vm.box_check_update = false
  config.vm.boot_timeout = 600
  config.vm.synced_folder '.', '/vagrant'

  NODES.each do |node|
    config.vm.define node[:name] do |machine|
      machine.vm.hostname = node[:name]
      machine.vm.network 'private_network', ip: node[:ip]

      machine.vm.provider 'virtualbox' do |vb|
        vb.name = "sistema-e-#{node[:name]}"
        vb.cpus = node[:cpus]
        vb.memory = node[:memory]
      end

      node[:provision].each do |script, args|
        machine.vm.provision 'shell', path: script, args: args
      end
    end
  end
end
