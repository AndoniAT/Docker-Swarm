
const { exec } = require('child_process');

class Slave {
    static number = 2;
    static slaves = [];
    static IP = '127.0.0.1';

    name = ws = active = null;
    
    static messages = {
        exit: 'exit'
    }

    constructor(name, ws) {
        this.name = name;
        this.ws = ws;
        this.active = false;
    }

    /**
     * Initialiser swarm et service avec replicas
     */
    static init() {
        Slave.leaveSwarm();
        
        exec( `docker swarm init --advertise-addr ${Slave.IP}`,
        ( err ) => {
            if (err) console.error(`error: ${err}`);
            else Slave.createService();
        } );    
    }

    /**
     * Leave swarm forcé avant d'initialiser
     */
    static leaveSwarm() {
        try {
            exec( 'docker swarm leave --force', ( err ) => console.error( err ? `error: ${err}` : '' )  );
        } catch( err ) {
            console.log(err);
        }
    }

    /**
     * Créer le service avec replicas
     */
    static createService() {
        exec( `docker service create --restart-condition='none' --network='host' --name slaves --replicas ${Slave.number} servuc/hash_extractor ./hash_extractor s ws://${Slave.IP}:3000/slaves`,
            ( err ) => {
                if (err) console.error(`error: ${err}`);
                else {
                    console.log(' == INIT == ')
                    setInterval( () => {
                        console.log( '== SHUT DOWN INACTIVES ==' )
                        Slave.shutDownInactives();
                    }, 6000);
                }
        });
    }

    
    /** 
     * Arreter inactives
     */
    static shutDownInactives() {
        let unactives =  Slave.slaves.filter( s => !s.active );
        
        if ( unactives.length < Slave.number ) {
            let scaleNum = Slave.number - unactives.length;
            Slave.scaleSlaves( scaleNum );
        } else {
            for ( let i = 0; i < unactives.length - Slave.number; i++ ) {
                console.log( `Shutdown slave : ${slave.name}` );
                let slave = unactives[i];
                slave.ws.send( Slave.messages.exit );
                
                // enlever l'esclave inactive dde la liste des esclaves
                slaves = slaves.filter( s => s !== slave );
            }
        }
    }

    static scaleSlaves( nb ) {
        exec( `docker service scale slaves=${Slave.slaves.length + nb}`, ( err ) => console.log( err ? `Error : ${err}` : `Total slaves => ${Slave.slaves.length + nb}` ) );
    }
}

module.exports = Slave;
