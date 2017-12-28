import json
import sys
# builds a sqlite db with words, writes to data.db
result = dict()
jsondata = {'words': [], 'definitions': []}
word_id = 0

def process( index_filename, data_filename ):
  global result
  global word_id
  global jsondata
  data = dict()
    
  idx_file = open('wordnet/dict/%s' % index_filename )
  data_file = open('wordnet/dict/%s' % data_filename )

  print("%s: reading data..." % data_filename)
  data_lines = data_file.readlines()
  print("%s: processing data..." % data_filename)
  count_def = 0
  for line in data_lines:
    if line.startswith( '  ' ):
      continue
    line = line.strip()
    gloss_fields = line.split( ' | ' )
    gloss = gloss_fields[1]
    fields = gloss_fields[0].split( ' ' )
    data[ fields[0] ] = dict()
    data[ fields[0] ][ 'gloss' ] = gloss
    count_def += 1

  print("%s: %i definitions" % ( data_filename, count_def ))
  idx_lines = idx_file.readlines()
  print("%s: processing index..." % index_filename)
  count_word = 0
  count_link = 0
  for line in idx_lines:
    if line.startswith( '  ' ):
      continue
    line = line.strip()
    fields = line.split( ' ' )
    word = fields[0].replace( '_', ' ' )
    type = fields[1]
    if word not in result:
      #cursor.execute( 'insert into words values ( null, ?, 1 )', (word,) )
      result[word] = word_id #cursor.lastrowid
      jsondata['words'].append({'word': word, 'id': word_id, 'len': len(word)})
      word_id += 1

    #result[word]['type'] = type
    count_word += 1
    pointers = int( fields[3] )
    synsets = fields[ 6+pointers: ]
    # find synsets
    for synset in synsets:
      if synset in data:
        #cursor.execute( 'insert into defs values ( ?, ? )', (result[word], "%s. %s" % ( type, data[synset]['gloss'] ),) )
        jsondata['definitions'].append({ 'word_id': result[word], 'def': "%s. %s" % ( type, data[synset]['gloss'] )})
        count_link += 1
      else:
        print("failed to find synset %s for word %s" % ( synset, word ))
  print("%s: %i words with %i links" % ( index_filename, count_word, count_link ))
    
def synonyms( f ):
  print("skipping synonyms")

process( 'index.adj', 'data.adj' )  
process( 'index.adv', 'data.adv' )  
process( 'index.noun', 'data.noun' )  
process( 'index.verb', 'data.verb' )

# write json
print("writing...")
with open('data.json', 'w') as fh:
  json.dump(jsondata, fh)
print("done")
    
