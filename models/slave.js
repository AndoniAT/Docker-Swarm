
const { exec } = require('child_process');
const HASH = require('./hash');
const crypto = require('crypto');


class Slave {
    static number = 2;
    static slaves = [];
    static IP = '127.0.0.1';

    static devryptModeState = true;
    static decryptState = false;

    static hashLength = 8;
    static HASH_SEARCHING = [];

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
        console.log('check actives => ', Slave.slaves.map( s => s.active ));
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
        let currentSlaves = Slave.slaves.length;
        exec( `docker service scale slaves=${currentSlaves + nb}`, ( err ) => console.log( err ? `Error : ${err}` : `Total : Slaves [ ${currentSlaves} ] + Scale slaves [ ${nb} ] ==> Total [ ${ currentSlaves + nb } ]` ) );
    }

    /**
     * MD5
     */
    static generateHASH( word ) {
        var result = crypto.createHash( 'md5' ).update( word ).digest( 'hex' );
        console.log(`Generate MD5 : WORD [ ${word} ] ====== HASH [ ${ result } ]`);

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
     * @param {*} hashedWord 
     */
    static decryptHASH( hashedWord ) {
        console.log('Current Hashes  => ', Slave.HASH_SEARCHING );
        console.log('Decript Hash => ', hashedWord);
        HASH.findOne( { hash: hashedWord }, function (err, obj) {
            if( err ) {
                console.log( "Error =>>>> ", err );
            }

            if ( obj ) {
                console.log( 'HASH déjà enregistré : ', obj );
                /**
                 * ENVOYER HASH TROUVE
                 */
                Slave.stopSearchHash( hashedWord );
            } else {
                console.log("Checking slaves => ", Slave.slaves.map( s => s ? s.name : null ));
                let inactives = Slave.slaves.filter( s => !s.active );
                inactives = inactives.slice(0, Slave.number); // prendre juste deux inactives

                // Chercher juste avec deux inactives
                if( inactives.length > 0 && Slave.devryptModeState ) {
                    inactives.forEach( current_slave => {
                        current_slave.active = true; // activer slave
                        let limit = [ "a*", "9*" ];
        
                        // SEARCH HASH
                        console.log(`Slave ${current_slave.name} => search this ws ======> ${hashedWord} ${limit[0]} ${limit[1]}` );
                        //console.log(`search this ws ======> ${hashedWord} a 99999` );
                        console.log(`Ready ? ${current_slave.ws.readyState}`);
                        current_slave.ws.send(`search ${hashedWord} ${limit[0]} ${limit[1]}`, error => {
                        //current_slave.ws.send( `search ${hashedWord} a 99999`,  error => {
                            if (error) {
                                console.error('Erreur d\'envoi du message:', error);
                            } else {
                                Slave.decryptState = true;
                                Slave.updateSearchMessage();
                                console.log('Message envoyé avec succès');
                            }
                        } );
                        console.log( `${hashedWord} pour slave => ${current_slave.name ?? current_slave}` );
                        if( Slave.HASH_SEARCHING[ hashedWord ] ) {
                            Slave.HASH_SEARCHING[ hashedWord ].push( current_slave );
                        } else {
                            Slave.HASH_SEARCHING[ hashedWord ] = [ current_slave ];
                        }
                    } );
                } else {
                    Slave.stopSearchHash( hashedWord );
                }
            }
        } );
    }

    static updateSearchMessage() {
        if( Slave.decryptState ) {
            setTimeout( () => {
                console.log( 'Search... => ', Slave.decryptState );
                Slave.updateSearchMessage()
            }, 2000 );
        }
    }

    /**
     * Arrete la recherche du hash
     */
    static stopSearchHash( hash ) {
        Slave.decryptState = false;
        Slave.devryptModeState = false;

        if ( Slave.HASH_SEARCHING[ hash ] ) {
            console.log( ` == STOP SLAVES SEARCHING FOR ${hash} ( ${Slave.HASH_SEARCHING[ hash ].length } Slaves )== ` );
            Slave.HASH_SEARCHING[ hash ].forEach( slave => {
                console.log( `Arret du slave => ${slave.name}` );
                slave.active = false;
                slave.ws.send( 'stop' );
                slave.ws.send( 'exit' );
            } );
            delete Slave.HASH_SEARCHING[ hash ];
            Slave.shutDownInactives();
        }
        Slave.updateSearchMessage();
    }
}

module.exports = Slave;
