
const { exec } = require('child_process');
const HASH = require('./hash');
const crypto = require('crypto');


class Slave {
    static currentMode = null;
    static number = 2;
    static slaves = [];
    static IP = '127.0.0.1';
    static chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    static devryptModeState = true;
    static decryptState = false;

    static numberIncrement = false;
    static hashLength = 8;
    static HASH_SEARCHING = [];
    static shutDownInterval = null;

    static startTime = null;

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
        console.log('== INIT==');
        Slave.slaves.forEach( slave => {
        if( slave.ws.readyState ) {
            console.log( `Arret du slave => ${slave.name}` );
            slave.active = false;
            slave.ws.send( 'stop' );
            slave.ws.send( 'exit' );
            
        }  
        })
        Slave.slaves = [];
        Slave.HASH_SEARCHING = [];
        Slave.numberIncrement = false;
        Slave.number = 2;

        if( Slave.shutDownInterval ) {
            clearInterval(Slave.shutDownInterval);
        }

        console.log('clear interval');
        return new Promise( (resolve, reject) => {
            Slave.leaveSwarm().then( e => {
                console.log(' == DOCKER  SWARM == ');
                exec( `docker swarm init --advertise-addr ${Slave.IP}`,
                ( err ) => {
                    if (err) console.error(`error: ${err}`);
                    else Slave.createService( resolve );
                } );
            })
        });
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
    static createService( next ) {
        console.log( `== Creer services slaves ==> ${Slave.number}` );

        exec( `docker service create --restart-condition='none' --network='host' --name slaves --replicas ${Slave.number} servuc/hash_extractor ./hash_extractor s ws://${Slave.IP}:3000/slaves`,
            ( err ) => {
                if (err) console.error(`error: ${err}`);
                else {
                    next();
                    Slave.shutDownInterval = setInterval( () => {
                        Slave.shutDownInactives()
                    }, 6000);
                }
        } );
    }

    
    /** 
     * Arreter inactives
     */
    static shutDownInactives() {
        let unactivesOpen = Slave.getOpenInactives();
        console.log( '== SHUT DOWN INACTIVES ==' )
        let unactives =  Slave.getInactives();
        console.log('check actives => ', unactives.map( s => s.active ));
        console.log('check slaves => ', Slave.slaves.map(s => s.active));
        
        if ( unactivesOpen.length < Slave.number ) {
            console.log('Shut down - Scale ==> redimension');
            let scaleNum = Slave.number - unactivesOpen.length;
            Slave.scaleSlaves( scaleNum );
            
        } else {
            for ( let i = 0; i < unactivesOpen.length - Slave.number; i++ ) {
                let slave = unactivesOpen[i];
                console.log( `Shutdown slave : ${slave.name}` );
                slave.ws.send( Slave.messages.exit );
                
                // enlever l'esclave inactive dde la liste des esclaves
                Slave.slaves = Slave.getOpenActives();
            }
            console.log('SLAVES NEW => ' + Slave.slaves.map(s => s ? s.name : null ));
        }
    }

    static scaleSlaves( nb ) {
        let currentSlaves = Slave.slaves.length;
        if( currentSlaves < 60 ) {
            console.log( `== SCALE == => ${currentSlaves} + ${nb}` );
            exec( `docker service scale slaves=${currentSlaves + nb}`, ( err ) => console.log( err ? `Error : ${err}` : `Total : Slaves [ ${currentSlaves} ] + Scale slaves [ ${nb} ] ==> Total [ ${ currentSlaves + nb } ]` ) );
        } else {
            console.log('exedeed slaves');
        }
    }

    /**
     * MD5
     */
    static generateHASH( word ) {
        var result = crypto.createHash( 'md5' ).update( word ).digest( 'hex' );
        console.log(`Generate MD5 : WORD [ ${word} ] ====== HASH [ ${ result } ]`);
        return result;
    }

    /**
     * Decrypter le hash et l'envoyer aux clients
     * @param {} cli 
     * @param {*} hashedWord 
     */
    static decryptHASH( hashedWord ) {
        console.log('Current Slaves  => ', Slave.slaves.map(s => `${s.name} - ${s.ws.readyState}`) );
        //console.log('Current Hashes  => ', Slave.HASH_SEARCHING );
        console.log('Decript Hash => ', hashedWord);
        HASH.findOne( { 
            hash: hashedWord ,
            'details.mode' : Slave.currentMode
        }, function (err, obj) {
            if( err ) {
                console.log( "Error =>>>> ", err );
            }

            if ( obj ) {
                console.log( 'HASH déjà enregistré : ', obj );
                /**
                 * ENVOYER HASH TROUVE
                 */
                Slave.HASH_SEARCHING[hashedWord] = Slave.slaves;
                Slave.stopSearchHash( hashedWord );
            } else {
                console.log("Checking slaves => ", Slave.slaves.map( s => s ? s.name : null ));
                let openInactives = Slave.getOpenInactives();
                openInactives = openInactives.slice(0, Slave.number); // prendre juste deux inactives

                if(openInactives.length == 0 ) {
                    Slave.scaleSlaves( Slave.number );
                }

                // Chercher juste avec deux inactives
                let split = Slave.chars.split('');
                let length = Slave.numberIncrement ? Slave.slaves.length : 2;
                console.log('check Length => ', length);
                let div = Math.ceil(split.length/length);
                let sliceLength= split.slice(0, div).length;

                
                let newArr = {};
            
                for (let index = 0, charPos = 0, count = 0 ; index < split.length; index++, count++) {
                    const element = split[index];
                    if( !newArr[charPos] ) newArr[charPos] = [];
                    newArr[charPos].push(element);

                    if( count == sliceLength ) {
                        charPos++;
                        count=0;
                    }
                }

                console.log(' == Check arr distribution == ' , newArr);
                console.log(Slave.slaves.map(s => `${s.name} ${s.ws.readyState}` ));
                
                let calcRandom = ( r , try_att = 0 ) => {
                    let rnd = Math.floor(Math.random() * Object.keys(newArr).length);
                    if( r.includes(rnd.toString()) && try_att < 3 ) {
                        return calcRandom( r, ++try_att );
                    } else {
                        return rnd.toString();
                    }
                }

                if( openInactives.length > 0 && Slave.devryptModeState ) {
                    let randomNum = [];
                    console.log('=== DECRYPT PROCES === ');
                    if(Slave.HASH_SEARCHING[hashedWord]) {
                        let namesInHasCurrent = Slave.HASH_SEARCHING[hashedWord];
                        namesInHasCurrent = namesInHasCurrent.map( s => s.name );
                        openInactives = openInactives.filter( s => !namesInHasCurrent.includes( s.name ) );
                    }

                    openInactives.forEach( c_slave => {
                        c_slave.active = true; // activer slave
                        //let limit = [ `${split[ 0 ]}*`, "9*" ];
                        let rand = calcRandom( randomNum );
                        randomNum.push(rand);
                        let elementArr = newArr[rand];
                        console.log('rand => ', rand);
                        console.log('check element arr => ', elementArr);
                        let limit = [ `${elementArr[0]}*`, `${elementArr[elementArr.length-1]}*` ];
                        console.log(`Slave ${c_slave.name} => search this ws num in arr ${rand} ======> ${hashedWord} ${limit[0]} ${limit[1]}` );
                        
                        // SEARCH HASH
                        c_slave.ws.send(`search ${hashedWord} ${limit[0]} ${limit[1]}`, error => {
                        //current_slave.ws.send( `search ${hashedWord} a 99999`,  error => {
                            if (error) {
                                console.error('Erreur d\'envoi du message:', error);
                            } else {
                                Slave.decryptState = true;
                                Slave.updateSearchMessage();
                                console.log('Message envoyé avec succès');
                                console.log( `${hashedWord} pour slave => ${c_slave.name ?? c_slave}` );
                                
                                if( !Slave.HASH_SEARCHING[ hashedWord ] ) Slave.HASH_SEARCHING[ hashedWord ] = [];
                                Slave.HASH_SEARCHING[ hashedWord ].push( c_slave );
                            }
                        } );  

                    } );
                } else if( !Slave.devryptModeState ){
                    console.log('STOP!');
                    Slave.stopSearchHash( hashedWord );
                } else {
                    Slave.updateSearchMessage();
                }
            }
        } );
    }

    static updateSearchMessage() {
        if( Slave.decryptState ) {
            setTimeout( () => {
                //console.log( 'Search... => ', Slave.decryptState );
                Slave.updateSearchMessage()
            }, 2000 );
        }
    }

    /**
     * Obtenir slaves ouverts et inactives
     * @returns 
     */
    static getOpenInactives() {
        return Slave.getInactives().filter( s => s.ws.readyState === s.ws.OPEN );
    }

    /**
     * Obtention des slaves inactives
     * @returns 
     */
    static getInactives() {
        return Slave.slaves.filter( s => !s.active );
    }


    /**
     * Obtenir slaves actives et ouverts
     * @returns 
     */
    static getOpenActives() {
        return Slave.getActives().filter( s => s.ws.readyState === s.ws.OPEN );
    }

    /**
     * Obtention des slaves actives
     * @returns 
     */
    static getActives() {
        return Slave.slaves.filter( s => s.active );
    }

    /**
     * Arrete la recherche du hash
     */
    static stopSearchHash( hash ) {
        console.log(`== STOP SEARCH == ${Slave.HASH_SEARCHING[hash]}`);
        if ( Slave.HASH_SEARCHING[ hash ] ) {
            Slave.decryptState = false;
            Slave.devryptModeState = false;
            console.log( ` == STOP SLAVES SEARCHING FOR ${hash} ( ${Slave.HASH_SEARCHING[ hash ].length } Slaves )== ` );
            Slave.HASH_SEARCHING[ hash ].forEach( slave => {
                console.log( `Arret du slave => ${slave.name}` );
                slave.active = false;
                slave.ws.send( 'stop' );
                slave.ws.send( 'exit' );
            } );
            delete Slave.HASH_SEARCHING[ hash ];
            Slave.shutDownInactives();
            Slave.updateSearchMessage();
        }
    }
}

module.exports = Slave;
