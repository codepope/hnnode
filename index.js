
var hyperquest = require('hyperquest');
var ndjson = require('ndjson');
var through2 = require('through2');
var filter = require("through2-filter");
var strm = require("stream");

source="http://api.hnstream.com/comments/stream/";

target="mongodb";

var skipping= filter({objectMode: true},function(chunk) {
    return chunk.body.toLowerCase().includes(target) || chunk["article-title"].toLowerCase().includes(target);
} );

strm.pipeline(
    hyperquest(source),
    ndjson.parse({ strict: false}),
    skipping,
    through2.obj(write),
    process.stdout,
    (err) => {
        if (err) {
          console.error('Pipeline failed.', err);
        } else {
          console.log('Pipeline succeeded.');
        }
      }
    );


function write(row, enc, next) {
    next(null, JSON.stringify(row,null,' ')+"\n");
}



