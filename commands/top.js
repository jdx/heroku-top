'use strict';

let https   = require('https');
let cli     = require('heroku-cli-util');
let co      = require('co');
let blessed = require('blessed');
let _       = require('highland');

function* run (context, heroku) {

  let screen = blessed.screen({
    autoPadding: true,
    smartCSR:    true
  });

  function error (text) {
    try {
      let message = blessed.message({
        parent: screen,
        content: 'foo'
      });
      message.error(text);
    } catch (err) {
      console.error(err.stack);
    }
  }

  function* getLogs(callback) {
    let log = yield heroku.request({
      method:  'POST',
      path:    `/apps/${context.app}/log-sessions`,
      body: {
        dyno:  'router',
        tail:  true,
        lines: 1000,
      }
    });

    https.get(log.logplex_url, function (res) {
      res.setEncoding('utf8');
      res.on('data', function (data) {
        callback(data);
      });
    }).on('error', error);
  }

  function parseLogLine (line) {
    line = line.split(' ');
    let d = {};
    d.timestamp = line.shift();
    d.source = line.shift();
    for (let element of line) {
      element = element.split('=');
      d[element[0]] = element[1];
    }
    return d;
  }

  function* showRequests(box) {
    let paths = {};
    function updatePaths () {
      _(Object.keys(paths)).sortBy(function (a, b) {
        return paths[b] - paths[a];
      })
      .map(function (path) { return `${path}: ${paths[path]}`; })
      .toArray(function (text) {
        box.setContent(text.join('\n'));
        screen.render();
      });
    }
    yield getLogs(function (logs) {
      for (let line of logs.split('\n')) {
        if (line.length === 0) continue;
        line = parseLogLine(line);
        paths[line.path] = (paths[line.path] || 0) + 1;
      }
      updatePaths();
    });
  }

  try {
    screen.title = context.app;

    let top = blessed.box({
      top: '0',
      left: '0',
      width: '100%',
      height: '33%',
      content: 'foo!',
      tags: true,
      style: {
        fg: 'black',
        bg: 'magenta'
      }
    });
    screen.append(top);

    let left = blessed.box({
      top: '33%',
      left: '0',
      width: '50%',
      height: '67%',
      content: 'foo!',
      tags: true,
      style: {
        fg: 'black',
        bg: 'blue'
      }
    });
    screen.append(left);

    let right = blessed.box({
      top: '33%',
      left: '50%',
      width: '50%',
      height: '67%',
      content: 'foo!',
      tags: true,
      style: {
        fg: 'black',
        bg: 'green'
      }
    });
    screen.append(right);

    screen.key(['escape', 'q', 'C-c'], function () {
      process.exit(0);
    });

    screen.render();

    yield showRequests(left);
  } catch (err) {
    error(err);
  }
}

module.exports = {
  topic: 'top',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(run))
};
