// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var assert = require('assert-plus');
var bunyan = require('bunyan');
var fs = require('fs');
var helper = require('../helper.js');
var leveldbraft = require('../leveldbraft');
var nodeunitPlus = require('nodeunit-plus');
var vasync = require('vasync');



// All the actual tests are here...
var raftInstallSnapshotTests =
    require('../share/raft_install_snapshot_tests.js');



///--- Globals

var after = nodeunitPlus.after;
var before = nodeunitPlus.before;
var LOG = bunyan.createLogger({
    level: (process.env.LOG_LEVEL || 'fatal'),
    name: 'raft-test',
    stream: process.stdout
});
var LOW_LEADER_TIMEOUT = 2;



///--- Setup/Teardown

before(function (cb) {
    assert.func(cb, 'cb');
    var self = this;

    var peers = [ 'raft-0', 'raft-1' ];
    vasync.forEachParallel({
        'inputs': peers.map(function (p) {
            return ({
                'log': LOG,
                'id': p,
                'peers': [ p ],
                'dbName': 'raft_install_snapshot_tests_db_' + p
            });
        }),
        'func': leveldbraft.raft
    }, function (err, res) {
        if (err) {
            return (cb(err));
        }
        self.oldRaft = res.operations[0].result;
        self.newRaft = res.operations[1].result;
        //Manually set the old raft to leader so that we can make client
        // requests.
        self.oldRaft.on('stateChange', function (state) {
            cb();
        });
        self.oldRaft.transitionToLeader();
    });
});


after(function (cb) {
    var self = this;
    vasync.pipeline({
        'funcs': [
            function closeOldLevelDb(_, subcb) {
                self.oldRaft.clog.close(subcb);
            },
            function closeNewLevelDb(_, subcb) {
                self.newRaft.clog.close(subcb);
            }

        ]
    }, function (err) {
        cb(err);
    });
});
