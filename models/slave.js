
class Slave {
    static number = 2;
    static slaves = [];

    name = ws = active = null;
    
    constructor(name, ws) {
        this.name = name;
        this.ws = ws;
        this.active = false;
    }

    /**
     * Initialiser swarm
     */
    static initSwarm() {
        /**
         * TO DO
         */
    }

    
    /** 
     * Arreter inactives
     */
    static shutDownInactives() {
        /**
         * TO DO
         */
    }
}

module.exports = Slave;
