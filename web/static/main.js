var
  DB = 'worddb',
  VER = 1,
  g = {},
  init = function(db_url) {
    set_status('Creating database...');
    g.index = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    g.open = g.index.open(DB, VER);

    g.open.onupgradeneeded = function() {
      g.db = g.open.result;
      word_store = g.db.createObjectStore("words", {keyPath: "id"}),
      word_store.createIndex("len", "len", {unique: false});
      def_store = g.db.createObjectStore("definitions", {autoIncrement : true});
      def_store.createIndex("word_id", "word_id", {unique: false});

      set_status('Downloading database...');
      $.ajax({
        url: db_url,
        error: on_download_error,
        dataType: 'json',
        success: on_downloaded
      });
    }
    g.open.onsuccess = function() {
      set_status('Opening database: done');
      g.db = g.open.result;
    }
    g.open.onerror = function(ev) {
      set_status('An error occurred opening the database: ' + ev);
    };

    // mouse events
    $('#ev_words').on('click', on_words);
    $('#ev_anagrams').on('click', function() { alert('not implemented') } );
    $('#ev_definitions').on('click', function() { alert('not implemented') } );
  },

  set_status = function(msg) {
    // console.log(msg);
    $('#status').html(msg);
  },

  on_download_error = function(ev) {
    set_status('The database failed to download');
  },

  on_downloaded = function(json) {
    set_status('Database downloaded. Populating words...');
      word_count = 0, def_count = 0;

    // add data
    var tx = g.db.transaction("words", "readwrite"),
      store = tx.objectStore("words");
      
    json['words'].forEach(function(word) {
      word_count += 1
      store.put(word);
    });

    set_status(word_count + ' words added. Adding definitions...');

    tx = g.db.transaction("definitions", "readwrite");
    store = tx.objectStore("definitions");

    json['definitions'].forEach(function(def) {
      def_count += 1
      store.put(def);
    });
    set_status(word_count + ' words added. ' + def_count + ' definitions added.');
  },

  on_words = function(ev) {
    var search = $('#search').val();
    set_status('Finding ' + search);
    var tx = g.db.transaction("words"),
      words = tx.objectStore("words"),
      idx = words.index("len"),
      range = IDBKeyRange.only(search.length);
    g.words = [];
    g.word_ids = {};
    idx.openCursor(range).onsuccess = function(ev) {
      var cursor = ev.target.result;
      if (cursor) {
        // Do something with the entries.
        if (is_match(search.toLowerCase(), cursor.value.word.toLowerCase())) {
          g.words.push(cursor.value.word);
          g.word_ids[cursor.value.word] = cursor.value.id;
        }
        cursor.continue();
      }
    };
    tx.oncomplete = function (event) {
      show_words();
    };
  },

  is_match = function(search, result) {
    for (i=0; i<search.length; i++) {
      if (search[i] != '.' && search[i] != '?' && search[i] != result[i]) {
        return false;
      }
    }
    return true;
  },

  on_word = function(ev) {
    var word = $('#words_table').DataTable().row(this).data()[0],
    // find the word id
      word_id = g.word_ids[word];

    // pull back definitions
    var tx = g.db.transaction("definitions"),
      defs = tx.objectStore("definitions"),
      idx = defs.index("word_id"),
      range = IDBKeyRange.only(word_id);
    g.defs = {};
    idx.openCursor(range).onsuccess = function(ev) {
      var cursor = ev.target.result;
      if (cursor) {
        // Do something with the entries.
        g.defs[cursor.value.def] = true;
        cursor.continue();
      }
    };
    tx.oncomplete = function (event) {
      show_defs();
    };
  },

  show_words = function() {
    set_status(g.words.length + ' results');
    var converted = [];
    for (var i in g.words) {
        converted.push([g.words[i]]);
    }
    $('#words_table').DataTable({
        "destroy": true,
        "paging": true,
        "iDisplayLength": 25,
        "searching": true,
        "bInfo" : false,
        "data": converted,
        "select": {
            style: 'os',
            selector: 'td:first-child'
        }
      });
      $('#words_table tbody').on('click', 'tr', on_word);
      // $('.main').height(($('.sidebar').height()));
      //$('#definitions').val('Select an item');
  },

  show_defs = function() {
    var d = Object.keys(g.defs).join('<hr/>');
    // console.log(d);
    $('#definitions').html(d);
  };
