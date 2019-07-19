#!/usr/bin/env node

// Uncomment for test
// const argv = require("yargs").default("word", "th((is)|(ere))").argv;

const argv = require("yargs")
  .default("regexp", "mongo(db|)")
  .default("echo", false).argv;

const { IncomingWebhook } = require("@slack/client");

const stream = require("stream");

var request = require("request");
var ndjson = require("ndjson");
var through2 = require("through2");
var filter = require("through2-filter");
var spy = require("through2-spy");
var entities = require("entities");
var slackify = require("slackify-html");
var Sentiment = require("sentiment");
var sentiment = new Sentiment();

var webhookurl = process.env.SLACK_HNMONITOR_WEBHOOK_URL;
const webhook = new IncomingWebhook(webhookurl);

source = "http://api.hnstream.com/comments/stream/";

target = argv.regexp; // word is the raw expression we are looking for
echo = argv.echo; // Send or just echo result for testing
targetRegexp = new RegExp("\\b"+target+"\\b", "i");
subRegexp=new RegExp(target, "gi")

console.log(`Will look for regular expression ${targetRegexp}`);

var skipNoMatch = filter({ objectMode: true }, function(chunk) {
  if (targetRegexp == null) {
    return (
      chunk.body.toLowerCase().includes(target) ||
      chunk["article-title"].toLowerCase().includes(target)
    );
  } else {
    return (
      chunk.body.match(targetRegexp) ||
      chunk["article-title"].toLowerCase().match(targetRegexp)
    );
  }
});

var countskips = 0;

var heartbeat = spy({ objectMode: false }, function(chunk) {
  countskips++;
});

var heartbeatreset = spy({ objectMode: true }, function(chunk) {
  if (countskips != 0) {
    console.log(`Skipped ${countskips}`);
  }
  countskips = 0;
});

stream.pipeline(
  request(source),
  heartbeat,
  ndjson.parse({ strict: false }),
  skipNoMatch,
  through2.obj(sentimental),
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
  // console.log("Posting")
  emoji = ":neutral_face:";
  if (row.score < -1) {
    emoji = ":angry:";
  } else if (row.score > 1) {
    emoji = ":simple_smile:";
  }

  
  body = row.body.replace(subRegexp, "<b>$&</b>");
  
  msg = `${emoji} ${row.score} - *${idToItemLink(
    row["article-id"],
    row["article-title"]
  )}* _${idToUserLink(row.author)}_ ${idToItemLink(row.id, "said")}\n${slackify(
    body
  )}`;
  if (echo) {
    console.log(body);
    cb();
  } else {
    webhook.send(msg, (err, res) => {
      if (err) {
        console.log("Error:", err);
      } else {
        console.log("Sent:", row);
      }
      console.log("Posted");
      cb();
    });
  }
}

function sentimental(row, enc, cb) {
  result = sentiment.analyze(row.body);
  row.score = result.score;
  cb(null, row);
}

// var dumpchunk = spy({ objectMode: true },function(chunk) {
//   console.log("Dump");
//   console.log(JSON.stringify(chunk, null, " "));
// });
