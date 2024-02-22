const URL = 'http://localhost:3000';
var HASH_LIST = [];
var searchMode = '';
var searchWord = '';
$(window).on( 'load', ( ) => {
    $('#leftContainer').css({ 'margin-left': '0', 'opacity': '1' });
    findHashes();
});

function findHashes() {
    console.log('== Search hashes == ');
    fetch( `${URL}/hashes` ).then(response => response.json())
    .then(data => {
        console.log('Réponse:', data);
        //let mapHashes = HASHES_LIST.map( h => h.hash );

        //let newHashes = data.filter( h => !(mapHashes.includes( h.hash )) );
        HASH_LIST = [ ...data ];

        console.log('checksolutions list', HASH_LIST);

        let newHashes = [ ...data ];
        $('#listHashes').html('');

        newHashes.forEach( hashObj => {

            console.log('has obj', hashObj);
            console.log('has obj', hashObj.details);
            let gentil = hashObj.details.find( d => d.mode == 'gentil' )
            console.log('gentil => ', gentil);
            gentil = gentil ? $(`<div>Mode ${gentil.mode} : ${gentil.time}</div>`) : null;

            let normal = hashObj.details.find( d => d.mode == 'normal' );
            console.log('normal => ', normal);
            normal = normal ? $(`<div>Mode ${normal.mode} : ${normal.time}</div>`) : null;

            let agressif = hashObj.details.find( d => d.mode == 'agressif' );
            console.log('agressif => ', agressif);
            agressif = agressif ? $(`<div>Mode ${agressif.mode} : ${agressif.time}</div>`) : null;

            let divHash = $(`<div class="hashContainer"/>`);
            $(divHash).append(`<div class="hashObject">
                <p>hash : ${hashObj.hash}</p>
                <p>solution : ${hashObj.solution}</p>
                <div class="solutions"> 
                    <div class="gentil"></div>
                    <div class="normal"></div>
                    <div class="agressif"></div>
                </div>
            </div>
            `)
            if(gentil) $(divHash).find('.gentil').html(gentil);
            if(normal) $(divHash).find('.normal').html(normal);
            if(agressif) $(divHash).find('.agressif').html(agressif);
            
            $('#listHashes').prepend(divHash);
        });
        checkState();
    })
    .catch(error => {
    console.error('Erreur:', error);
    });
    setTimeout(findHashes, 2000 );
}
function sendRequest() {
    const mode = $('#mode').val();
    const word = $('#word').val();
    console.log(`Mode [ ${mode} ] === Word [ ${word} ]`);
    
    if(word.length > 0 ) {
        searchWord = word;
        searchMode = mode;
        fetch( `${URL}/client`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {
                mode: mode, 
                word: word
            } ),
        })
        .then(response => response.json())
        .then(data => {
            console.log('creiprer', data);
            $('html').css({cursor: 'progress'});
            $( '#loading' ).html( `<h2>
                Decryptage du hash ${ data } pour le mot ${word}
            </h2>` );
            console.log('Réponse:', data);
            checkState();
        })
        .catch(error => {
        console.error('Erreur:', error);
        });
    }
}

function checkState() {
    let hash = HASH_LIST.find( h => h.solution == searchWord );
    if(hash && hash.details.map( d => d.mode ).includes(searchMode)) {
        searchWord = '';
        searchMode = '';
        $('html').css( {cursor: 'auto'} );
        $( '#loading' ).html( '' );
    }
}