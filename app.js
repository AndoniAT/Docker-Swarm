var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var moment = require('moment');
const HASH = require('./models/hash');
const mongoURL = "mongodb://mongo:27017/swarm";
const mongoose = require('mongoose');

const MODES = {
  gentil: {
    name: 'gentil',
    time: 60
  }, 
  normal: {
    name: 'normal',
    time: 30
  }, 
  agressif: {
    name: 'agressif',
    time: 10
  }
};

(async () => {
  console.log(' == TRY TO CONNECT ==' );
  try {
    console.log(mongoURL)
    // Connexion à la base de données MongoDB
    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Si la connexion réussit
    console.log('\n\n ======= Connexion à MongoDB réussie ====================== \n\n');


    setTimeout(() => { 
      console.log('DECRYPTER =============> ');
      let word = Slave.generateHASH( 'chiem' );
      decryptMode( MODES.gentil.name, word );
      //Slave.decryptHASH( word ); 
    }, 10000
    );

  } catch (error) {
    // En cas d'échec de connexion
    console.error('Erreur de connexion à MongoDB :', error.message);
    //lever une exception

    throw new Error('Impossible de se connecter à la base de données MongoDB', error);
  }
})();



var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
const expressWs = require('express-ws')(app);
var searchActive = true;

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
/*

const messageClient = ( msg ) => {
  console.log( 'Message du client => ', msg );
  const mode = msg.split( ' ' )[0];
  
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
  const type = msg.split( ' ' )[ 0 ];
  switch(type) {
    case TYPEMESSAGESLAVE.slave : 
    console.log('== TYPE SLAVE ==');
    console.log( 'Message recu du slave => ', msg );
    createSlave( ws );
    break
    case TYPEMESSAGESLAVE.found :
      console.log('== TYPE FOUND ==');
      console.log( 'Message recu du slave => ', msg );
      let message = msg.split( ' ' );
      let hash = message[ 1 ];
      let solution = message[ 2 ];
      if(Slave.devryptModeState) {
        console.log(`HASH [ ${hash} ] ======= SOLUTION [${solution} ]`);
        
        // Sauvegarder dans la base de données.
        hashFound( hash, solution );
        break;
      } else {
        console.log( '\n == ALREADY FOUND STOP ALL == \n' );
        Slave.stopSearchHash( hash );
      }
  }

};

//app.ws( '/cli', ( ws, req ) => {  ws.on( 'message', msg => { messageClient( msg ); } ); } );


app.ws( '/slaves', ( ws, req ) => {  
  console.log('== GET SLAVES ==' );
  ws.on( 'message', msg => { messgaeSlave( ws, msg ); } ); 
} );

app.ws( '/echo', ( ws, req ) => {
  ws.on('message', (msg) => {
      console.log( '== ECHO ==' );
      console.log( msg );
      ws.send( msg );
  } );
} );


/**
 * Si le hash a été trouvé, sauvegarder le hash et la solution
 */
function hashFound( hash, solution ) {
  let date = moment().toISOString();
  let hashMongoose = new HASH( { hash: hash, solution: solution, date_found: date } );
  hashMongoose.save( ( err ) => { console.log( err ? err : `\n\n === Saved : Hash [ ${hash} ] ====== Solution [ ${solution} ] ======== Date [ ${date} ] ===== \n\n ` ); } );
  Slave.stopSearchHash( hash );
}

function createSlave( ws ) {
  let name = `slave_${Slave.slaves.length}`;
  let slave = new Slave( name, ws, false );
  console.log('Creation slave =>', slave.name);
  Slave.slaves.push(slave);
}

const CHECK_STATE_TIME = 10000;
function decryptMode( mode, hash ) {
  Slave.devryptModeState = true;

  let dectypMsg = () => {
    setTimeout( () => { 
      console.log(`\n\n == Decrype Mode ${mode} => time ${MODES[ mode ].time} == \n\n`)
      Slave.decryptHASH( hash );
    }, 
      MODES[ mode ].time
    );
  }

  let checkState = () => {
    console.log('== RUN CHECK STATE == ')
    if( Slave.devryptModeState ) {
      dectypMsg();

      setTimeout( () => {
        checkState();
      }, CHECK_STATE_TIME );

    }
  }

  checkState();

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