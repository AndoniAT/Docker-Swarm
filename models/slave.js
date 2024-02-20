
const { exec } = require('child_process');
const HASH = require('./hash');
const crypto = require('crypto');


class Slave {
    static number = 2;
    static slaves = [];
    static IP = '127.0.0.1';


    static hashLength = 8;
    static charHASH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    name = null;
    ws = null;
    active = null;
    
    static messages = {
        exit: 'exit'
    }

    constructor(name, ws, active ) {
        this.name = name;
        this.ws = ws;
        this.active = active;
    }

    /**
     * Initialiser swarm et service avec replicas
     */
    static init() {
        Slave.leaveSwarm().then( e => {
            console.log(' == DOCKER  SWARM == ');
            exec( `docker swarm init --advertise-addr ${Slave.IP}`,
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
        console.log( '== Creer services slaves ==' );

        exec( `docker service create --restart-condition='none' --network='host' --name slaves --replicas ${Slave.number} servuc/hash_extractor ./hash_extractor s ws://${Slave.IP}:3000/slaves`,
            ( err ) => {
                if (err) console.error(`error: ${err}`);
                else setInterval( () => Slave.shutDownInactives(), 6000);
        } );
    }

    
    /** 
     * Arreter inactives
     */
    static shutDownInactives() {
        console.log( '== SHUT DOWN INACTIVES ==' )
        let unactives =  Slave.slaves.filter( s => !s.active );
        
        if ( unactives.length < Slave.number ) {
            let scaleNum = Slave.number - unactives.length;
            Slave.scaleSlaves( scaleNum );
        } else {
            for ( let i = 0; i < unactives.length - Slave.number; i++ ) {
                let slave = unactives[i];
                console.log( `Shutdown slave : ${slave.name}` );
                slave.ws.send( Slave.messages.exit );
                
                // enlever l'esclave inactive dde la liste des esclaves
                Slave.slaves = Slave.slaves.filter( s => s !== slave );
            }
            console.log('SLAVES NEW => ' + Slave.slaves.map(s => s ? s.name : null ));
        }
    }

    static scaleSlaves( nb ) {
        console.log( ' == SCALE == ' );
        exec( `docker service scale slaves=${Slave.slaves.length + nb}`, ( err ) => console.log( err ? `Error : ${err}` : `Total slaves + slaves removed => ${Slave.slaves.length + nb}` ) );
    }

    /**
     * MD5
     */
    static generateHASH( word ) {
        var result = crypto.createHash( 'md5' ).update( word ).digest( 'hex' );
        console.log(`Generate MD5 : WORD [ ${word} ] ====== HASH [ ${ result } ]`);
        
        //for ( let i = 0; i < Slave.hashLength; i++) result += Slave.charHASH.charAt( Math.floor( Math.random() * Slave.charHASH.length ) );

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
    static decryptHASH( hash_c, newHash ) {
        console.log('Current Hash  => ', hash_c);
        console.log('Decript Hash => ', newHash);
        HASH.findOne( { hash: newHash }, function (err, obj) {
            if( err ) {
                console.log( "Error =>>>> ", err );
            }

            if ( obj ) {
                /**
                 * ENVOYER HASH TROUVE
                 */
            } else {
                //
                Slave.shutDownInactives();
                let unactives =  Slave.slaves.filter( s => !s.active );
                console.log("Checking slaves => ", Slave.slaves.map( s => s ? s.name : null ));
                hash_c[ newHash ] = [];
                for ( let i = 0; i < Slave.number && unactives.length > 0; i++ ) {
                    let current_slave = unactives[ i ];
                    console.log('Current slave => ', current_slave.name ?? current_slave );

                    let limit = ( i == 0 ) ? [ "a*", "E*" ] : ( i == 1 ) ? [ "F*", "9*" ] : [ "a*", "9*" ];

                    // SEARCH HASH
                    //console.log(`search this ws ======> ${newHash} ${limit[0]} ${limit[1]}` );
                    console.log(`search this ws ======> ${newHash} a 99999` );
                    console.log(`Ready ? ${current_slave.ws.readyState}`);
                    //current_slave.ws.send(`search ${newHash} ${limit[0]} ${limit[1]}` );
                    current_slave.ws.send( `search ${newHash} a 99999`,  error => {
                        if (error) {
                          console.error('Erreur d\'envoi du message:', error);
                        } else {
                          console.log('Message envoyé avec succès');
                        }
                      } );

                    current_slave.active = true; // activer slave
                    console.log( `${newHash} pour slave => ${current_slave.name ?? current_slave}` );

                    hash_c[ newHash ].push( current_slave );
                }
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
