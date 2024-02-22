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
    time: 15000,
    numberSlaves : 2
  }, 
  normal: {
    name: 'normal',
    time: 10000,
    numberSlaves : 3
  }, 
  agressif: {
    name: 'agressif',
    time: 5000,
    numberSlaves : 4
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


    /*setTimeout(() => { 
      console.log('DECRYPTER =============> ');
      let word = Slave.generateHASH( 'chiem' );
      decryptMode( MODES.gentil.name, word );
      //Slave.decryptHASH( word ); 
    }, 10000
    );*/

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
      console.log(`HASH [ ${hash} ] ======= SOLUTION [${solution} ]`);
      
      // Sauvegarder dans la base de données.
      hashFound( hash, solution );
    }

};

app.ws( '/slaves', ( ws, req ) => {  
  console.log('== GET SLAVES ==' );
  ws.on( 'message', msg => { messgaeSlave( ws, msg ); } ); 
} );

/**
 * Si le hash a été trouvé, sauvegarder le hash et la solution
 */
function hashFound( hash, solution ) {
  if( Slave.devryptModeState ) {
    let start = Slave.startTime;
    let end = moment();
    console.log(`StartTime => ${start}`);
    console.log(`EndTime => ${end}`);
    let date = end.toISOString();
    let duration = moment.duration(end.diff(start));
    console.log(`Duration => ${duration}`);
    
    const h = Math.floor(duration.asHours());
    const m = Math.floor(duration.asMinutes()) % 60;
    const s = Math.floor(duration.asSeconds()) % 60;
    const mil = Math.floor(duration.milliseconds());


    let det = {
      mode : Slave.currentMode,
      time : `${h}:${m}:${s}:${mil}`,
      date: date
    };

    HASH.findOne( { 
      hash: hash
    },
    ( err, obj ) => {
      if( obj ) {
        // Update
        let details = obj.details;
        details.push( det );

        HASH.updateOne( 
          {
            hash: hash
          },
          {
            $set : {
              details : details
            }
          },
          ( err, result ) => { 
          console.log( err ? err : `\n\n === Updated : Hash [ ${hash} ] ====== Solution [ ${solution} ] ========= Mode [ ${det.mode} ] ======== Time [ ${det.time} ] ======== Date [ ${det.date} ] ===== \n\n ` ); 
        } );
      } else {
        let hashMongoose = new HASH( { 
          hash: hash, solution: solution, 
          details : [ det ]
        } );

        // Save
        hashMongoose.save( ( err ) => { 
          console.log( err ? err : `\n\n === Saved : Hash [ ${hash} ] ====== Solution [ ${solution} ] ========= Mode [ ${det.mode} ] ======== Time [ ${det.time} ] ======== Date [ ${det.date} ] ===== \n\n ` ); 
        } );
      }
    }
    );
    Slave.stopSearchHash( hash );
  } else {
    Slave.stopSearchHash( hash );
  }
  Slave.leaveSwarm();


  /*console.log( `Regenerate slaves` );
  Slave.slaves.forEach( slave => {
    slave.active = false;
    slave.ws.send( 'stop' );
    slave.ws.send( 'exit' );
  } );
  let num = Slave.slaves.length;
  Slave.slaves = [];
   for (let index = 0; index < Object.keys(Slave.HASH_SEARCHING).length; index++) {
                const hash = Slave.HASH_SEARCHING[index];
                delete Slave.HASH_SEARCHING[hash];
  }*/
  //Slave.scaleSlaves( Slave.number + num );
}

function createSlave( ws ) {
  let name = `slave_${Slave.slaves.length}`;
  let slave = new Slave( name, ws, false );
  console.log('Creation slave =>', slave.name);
  Slave.slaves.push(slave);
}

const CHECK_STATE_TIME = 5000;
function decryptMode( mode, hash ) {
  Slave.numberIncrement = false;
  let interv = setInterval(() => {
    if(!Slave.devryptModeState) {
      MODES[mode].numberSlaves = 0;
      clearInterval(interv);
    } else {
      if(!Slave.numberIncrement) {
        Slave.numberIncrement = true;
        Slave.number=MODES[mode].numberSlaves;
      }
      console.log(`\n\n == Decrype Mode ${mode} => time ${MODES[ mode ].time} == \n\n`)
      Slave.decryptHASH( hash );
      /*setTimeout( () => { 
      }, 
        MODES[ mode ].time
      );*/
    }

  }, MODES[ mode ].time );
  /*let dectypMsg = () => {
    setTimeout( () => { 
      console.log(`\n\n == Decrype Mode ${mode} => time ${MODES[ mode ].time} == \n\n`)
      Slave.decryptHASH( hash );
    }, 
      MODES[ mode ].time
    );
  }

  let checkState = () => {
    console.log(`== RUN CHECK STATE ==> Decrypt mode = ${Slave.devryptModeState}`);
    if( Slave.devryptModeState ) {
      dectypMsg();

      setTimeout( () => {
        checkState();
      }, CHECK_STATE_TIME );

    }
  }

  checkState();*/

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


/**
 * HTTP : Message envoyé par le client
 */
app.post('/client', function(req, res, next) {
  console.log('init');
  let { mode, word } = req.body;
  word = Slave.generateHASH( word );

  Slave.init().then( () => {
    if( MODES[mode] ) {
      Slave.startTime = moment();
      Slave.currentMode = MODES[mode].name;
      Slave.devryptModeState = true;
      Slave.number=MODES[mode].numberSlaves;

      console.log('=== REQUEST CLIENT DECRYPT ======');
      decryptMode( Slave.currentMode, word );
    }
  });

  res.json(word);
});

app.get('/hashes', function(req, res, next) {
  HASH.find({}).then( r => {
    res.json(r);
  });
});

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

const server = app.listen(PORT, () => {
  console.log(`App listening at http://localhost:${PORT}`);
  console.log(`WebSocket listening at ws://localhost:${PORT}`);
});

module.exports = app;