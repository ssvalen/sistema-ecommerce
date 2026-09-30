# Generado por deploy/db/install-db.sh. Idéntico en data1 y data2.
#
# TYPE   DATABASE     USER                            ADDRESS             METHOD
local    all          postgres                                            peer
local    all          all                                                 peer
host     all          all                             127.0.0.1/32        scram-sha-256
host     all          all                             ::1/128             scram-sha-256

hostssl  ecommerce    ecommerce_app,ecommerce_owner   __APP1_IP__/32      scram-sha-256
hostssl  ecommerce    ecommerce_app,ecommerce_owner   __APP2_IP__/32      scram-sha-256

hostssl  replication  replicator                      __DATA1_IP__/32     scram-sha-256
hostssl  replication  replicator                      __DATA2_IP__/32     scram-sha-256
