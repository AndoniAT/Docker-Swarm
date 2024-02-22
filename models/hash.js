const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Modele du hash avec un hash et une solution
 */
const Hash = new Schema( { 
    hash: String, solution: String, 
    details : [ 
        {
            mode : String,
            time : String,
            date : String,    
        }
    ]
} );

module.exports = mongoose.model('Hash', Hash);
