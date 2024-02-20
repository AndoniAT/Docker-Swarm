var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
//const mongoURL = "mongodb://mongo:27017";
//const mongoose = require('mongoose');
//mongoose.connect( `${mongoURL}/swarm` );

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
const expressWs = require('express-ws')(app);
var searchActive = true;

var TOTSLAVES = 0;
var SLAVESCOLLECTION = [];
var HASH_C = [];

const PORT = 3000;

/**
 * == MODELS ==
 */
const hash = require('./models/hash');
const Slave  = require('./models/slave');

/**
 * WEBSOCKET
 */

/**
 * Message envoyé par le client
 */
/*const MODES = {
  easy: 'easy', 
  medium: 'medium', 
  insane: 'insane'
} 

const messageClient = ( msg ) => {
  console.log( 'Message du client => ', msg );
  const mode = msg.split( ' ' )[0];
  
  const decryptWithTime = ( time ) => {
    setTimeout( () => { decryptMD5Hash(clients, hashCurrent) }, time );
    if(searchActive) decryptWithTime(time);
  }

  switch( mode ) {
    case MODES.easy :
      decryptWithTime( 60 );
      break
    
  }
};
*/

const TYPEMESSAGESLAVE = { slave : 'slave', found : 'found' };


const messgaeSlave = ( ws, msg ) => {
  console.log('=== SLAVE MESSAGE ====')
  console.log( 'Message recu du slave => ', msg );
  const type = msg.split( ' ' )[ 0 ];
  switch(type) {
    case TYPEMESSAGESLAVE.slave : 
      createSlave( ws );
    break
    case TYPEMESSAGESLAVE.found :
      let hash = msg.split( ' ' )[1];
      let solution = msg.split( ' ' )[2];
      hashFound( hash, solution );
    break
  }

};

//app.ws( '/cli', ( ws, req ) => {  ws.on( 'message', msg => { messageClient( msg ); } ); } );

app.ws( '/slaves', ( ws, req ) => {  
  console.log('== GET SLAVES ==' );
  ws.on( 'message', msg => { messgaeSlave( ws, msg ); } ); 
} );


/**
 * Si le hash a été trouvé, sauvegarder le hash et la solution
 */
function hashFound( hash, solution ) {
  /*let hashMongoose = new hashModel( { hash: hash, solution: solution } );
  hashMongoose.save( ( err ) => { console.log( err ? err : `New hash : ${hash} => solution : ${solution}` ); } );
  Slave.stopSearchHash( HASH_C, solution );*/
}

function createSlave( ws ) {
  let name = `slave_${SLAVESCOLLECTION.length}`;
  let slave = new Slave( name, ws, false );
  console.log('Creation slave =>', slave.name);
  SLAVESCOLLECTION.push(slave);
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

Slave.init(); // Initialiser swarm

const server = app.listen(PORT, () => {
  console.log(`App listening at http://localhost:${PORT}`);
  console.log(`WebSocket listening at ws://localhost:${PORT}`);
});

module.exports = app;