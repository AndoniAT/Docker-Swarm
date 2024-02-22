const URL = 'http://localhost:3000';
var HASHES_LIST = [];
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
        let mapHashes = HASHES_LIST.map( h => h.hash );
        let newHashes = data.filter( h => !(mapHashes.includes( h.hash )) );
        HASHES_LIST = [ ...HASHES_LIST, ...newHashes ];

        newHashes.forEach( hashObj => {
            let divHash = $(`<div class="hashContainer"/>`);
            $(divHash).append(`<div class="hashObject">
                <p>hash : ${hashObj.hash}</p>
                <p>solution : ${hashObj.solution}</p>
            </div>
            `)
            
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
    let mapHashes = HASHES_LIST.map( h => h.solution );
    if( mapHashes.includes(searchWord) ) {
        searchWord = '';
        $('html').css( {cursor: 'auto'} );
        $( '#loading' ).html( '' );
    }
}