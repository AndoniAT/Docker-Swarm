
const { exec } = require('child_process');
const hash = require('./hash');


class Slave {
    static number = 2;
    static slaves = [];
    static IP = '127.0.0.1';


    static hashLength = 8;
    static charHASH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

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
        Slave.leaveSwarm().then( e => {
            console.log(' == DOCKER  SWARM == ');
            exec( `docker swarm init --listen-addr ${Slave.IP}:2377 --advertise-addr 127.0.0.1`,
            ( err ) => {
                if (err) console.error(`error: ${err}`);
                else Slave.createService();
            } );
        })
    }

    /**
     * Leave swarm forcé avant d'initialiser
     */
    static leaveSwarm() {
        return new Promise( ( resolve, reject ) => {
            try {
                exec( 'docker swarm leave --force', ( err ) => {
                    console.error( err ? `error: ${err}` : 'LEAVED!' )  
                    resolve(err);
                });
            } catch( err ) {
                console.log(err);
                resolve(err);
            }
        })
    }

    /**
     * Créer le service avec replicas
     */
    static createService() {
        console.log( 'Creer services slaves' );
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

    /**
     * MD5
     */
    static generateHASH() {
        var result = '';
        for ( let i = 0; i < Slave.hashLength; i++) result += Slave.charHASH.charAt( Math.floor( Math.random() * Slave.charHASH.length ) );

        exec("echo -n " + result + " | md5sum", 
        ( err, stdout ) => {
            if (err) console.error(`error: ${err}`);
            else {
                result = stdout
            }
        } )
        return result;
    }

    /**
     * Decrypter le hash et l'envoyer aux clients
     * @param {} cli 
     * @param {*} hash_c 
     * @param {*} newHash 
     */
    static decryptHASH( cli, hash_c, newHash ) {
        newHash = newHash ?? Slave.generateHASH();
        
        hash.findOne( { hash: newHash }, function (err, obj) {
            if( err ) {
                console.log( err );
                return
            }

            if ( obj ) {
                /**
                 * ENVOYER HASH TROUVE
                 */
            } else {
                //
            }
        } );
    }

    /**
     * Arrete la recherche du hash
     */
    static stopSearchHash( hash_c, hash ) {
        if ( hash in hash_c ) {
            for ( let slave of hash_c[ hash ] ) {
                console.log( `Arret su slave => ${slave.name}` );
                slave.ws.send( 'stop' );
                slave.ws.send( 'exit' );
            }
            
            delete hashCurrent[ hash ];
        }
    }

}

module.exports = Slave;
