#!/usr/bin/env node

const argv = require("yargs").default("word", "mongodb").argv;

const { IncomingWebhook } = require("@slack/client");

const stream = require("stream");

var request = require("request");
var ndjson = require("ndjson");
var through2 = require("through2");
var filter = require("through2-filter");
var spy = require("through2-spy");
var entities = require("entities");
var slackify = require("slackify-html");

var webhookurl = process.env.SLACK_HNMONITOR_WEBHOOK_URL;
const webhook = new IncomingWebhook(webhookurl);

source = "http://api.hnstream.com/comments/stream/";

target = argv.word;

console.log(`Will look for ${target}`);

var skipNoMatch = filter({ objectMode: true }, function(chunk) {
  return (
    chunk.body.toLowerCase().includes(target) ||
    chunk["article-title"].toLowerCase().includes(target)
  );
});

var countskips=0;

var heartbeat = spy({ objectMode: false }, function(chunk) {
  countskips++;
});

var heartbeatreset = spy({ objectMode: true }, function(chunk) {
  if(countskips!=0) {
    console.log(`Skipped ${countskips}`);
  }
  countskips=0;
});

stream.pipeline(
  request(source),
  heartbeat,
  ndjson.parse({ strict: false }),
  skipNoMatch,
  heartbeatreset,
  through2.obj(post),
  err => {
    if (err) {
      console.error("Pipeline failed.", err);
    } else {
      console.log("Pipeline succeeded.");
    }
  }
);

function idToItemLink(id, text) {
  return `<https://news.ycombinator.com/item?id=${id}|${entities.decodeHTML(
    text
  )}>`;
}

function idToUserLink(id) {
  return `<https://news.ycombinator.com/user?id=${id}|${entities.decodeHTML(
    id
  )}>`;
}

function post(row, enc, cb) {
  console.log("Posting")
  msg="In *"+idToItemLink(row["article-id"],row["article-title"])+"* _"+idToUserLink(row.author)+"_ "+idToItemLink(row.id,"said")+"\n"+slackify(row.body);
  webhook.send(msg, (err, res) => {
    if (err) {
      console.log("Error:", err);
    } else {
      console.log("Sent:", row);
    }
    console.log("Posted")
    cb();
  });
}


// var dumpchunk = spy({ objectMode: true },function(chunk) {
//   console.log("Dump");
//   console.log(JSON.stringify(chunk, null, " "));
// });
