var
  DB = 'worddb',
  VER = 1,
  g = {},
  init = function(db_url) {
    set_status('Creating database...');
    g.index = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    g.open = g.index.open(DB, VER);
    g.upgrading = false;

    g.open.onupgradeneeded = function() {
      g.upgrading = true;
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
      g.db = g.open.result;
      if (!g.upgrading) {
        set_status('Ready.');
      }
    }
    g.open.onerror = function(ev) {
      set_status('An error occurred opening the database: ' + ev);
    };

    // mouse events
    $('#ev_words').on('click', on_words);
    $('#ev_anagrams').on('click', on_anagram);
    $('#ev_definitions').on('click', on_definition);
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
    var
      word_count = 0, def_count = 0;

    // add data
    add_data(json, 0, 0);
  },

  add_data = function(json, word_pos, def_pos) {
    if (word_pos >= 0) {
      var tx = g.db.transaction("words", "readwrite"),
        store = tx.objectStore("words"),
        continuing = false;
      
      
      for (; word_pos<json['words'].length; word_pos++) {
        word = json['words'][word_pos];
        store.put(word);
        if ((word_pos + 1) % 10000 == 0) {
          set_status((word_pos + 1) + ' words added...');
          setTimeout(function () { add_data(json, word_pos + 1, 0) }, 1);
          continuing = true;
          break;
        }
      }
      if (!continuing) { // finished words
        set_status((word_pos + 1) + ' words added. Adding definitions...');
        setTimeout(function() { add_data(json, -word_pos, 0); }, 1);
      }
    }
    else {
      tx = g.db.transaction("definitions", "readwrite");
      store = tx.objectStore("definitions");
      continuing = false;
      for (; def_pos<json['definitions'].length; def_pos++) {
        def = json['definitions'][def_pos];
        store.put(def);
        if ((def_pos + 1) % 10000 == 0) {
          set_status((def_pos + 1) + ' definitions added...');
          setTimeout(function () { add_data(json, word_pos, def_pos + 1) }, 1);
          continuing = true;
          break;
        }
      }
      if (!continuing) { // finished all
        set_status((-word_pos + 1) + ' words. ' + (def_pos + 1) + ' definitions. Ready.');
      }
    }
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

  on_definition = function(ev) {
    var search = $('#search').val();
    set_status('Finding ' + search);
    var tx = g.db.transaction(["definitions", "words"]),
      defs = tx.objectStore("definitions"),
      words = tx.objectStore("words"),
      tested = 0;
    g.words = [];
    g.word_ids = {};
    defs.openCursor().onsuccess = function(ev) {
      var cursor = ev.target.result;
      if (cursor) {
        if (is_def(search, cursor.value.def.toLowerCase())) {
          words.get(cursor.value.word_id).onsuccess = function(ev) {
            g.words.push(ev.target.result.word);
            g.word_ids[ev.target.result.word] = cursor.value.word_id;
          }
        }
        tested += 1;
        if (tested % 10000 == 0) {
          set_status('Searched ' + tested);
        }
        cursor.continue();
      }
    };
    tx.oncomplete = function (event) {
      show_words();
    };
   },

  is_def = function(search, definition) {
    return definition.indexOf(search) != -1;
  }

  on_anagram = function(ev) {
    var search = $('#search').val();
    set_status('Finding ' + search);
    var tx = g.db.transaction("words"),
      words = tx.objectStore("words"),
      idx = words.index("len"),
      range = IDBKeyRange.only(search.length);
    g.words = [];
    g.word_ids = {};
    sorted_search = search.toLowerCase().split("").sort().join("");
    idx.openCursor(range).onsuccess = function(ev) {
      var cursor = ev.target.result;
      if (cursor) {
        if (is_anagram(sorted_search, cursor.value.word.toLowerCase())) {
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

  is_anagram = function(search, result) {
    candidate = result.split("").sort().join("");
    return search == candidate;
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
