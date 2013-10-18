// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var bunyan = require('bunyan');
var helper = require('../helper.js');
var StateMachine = require('./statemachine');
var vasync = require('vasync');



///--- Globals

var test = helper.test;
var LOG = bunyan.createLogger({
    level: (process.env.LOG_LEVEL || 'fatal'),
    name: 'statemachine-test',
    stream: process.stdout
});



///--- Tests

test('statemachine init and execute one', function (t) {
    var sm;
    var funcs = [
        function (_, subcb) {
            sm = new StateMachine({ 'log': LOG });
            sm.on('ready', subcb);
        },
        function (_, subcb) {
            t.equal(undefined, sm.data);
            t.equal(0, sm.commitIndex);
            subcb();
        },
        function (_, subcb) {
            sm.execute([
                { 'index': 1, 'command': 'one' }
            ], function (err) {
                t.equal('one', sm.data);
                t.equal(1, sm.commitIndex);
                subcb(err);
            });
        }
    ];
    vasync.pipeline({
        funcs: funcs
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('statemachine execute many', function (t) {
    var sm;
    var funcs = [
        function (_, subcb) {
            sm = new StateMachine({ 'log': LOG });
            sm.on('ready', subcb);
        },
        function (_, subcb) {
            sm.execute([
                { 'index': 1, 'command': 'one' },
                { 'index': 2, 'command': 'two' },
                { 'index': 3, 'command': 'three' },
                { 'index': 4, 'command': 'four' },
                { 'index': 5, 'command': 'five' },
                { 'index': 6, 'command': 'six' }
            ], function (err) {
                t.equal('six', sm.data);
                t.equal(6, sm.commitIndex);
                subcb(err);
            });
        }
    ];
    vasync.pipeline({
        funcs: funcs
    }, function (err) {
        if (err) {
            t.fail(err);
        }
        t.done();
    });
});


test('statemachine first out of order', function (t) {
    var sm;
    var funcs = [
        function (_, subcb) {
            sm = new StateMachine({ 'log': LOG });
            sm.on('ready', subcb);
        },
        function (_, subcb) {
            sm.execute([
                { 'index': 2, 'command': 'two' }
            ], subcb);
        }
    ];
    vasync.pipeline({
        funcs: funcs
    }, function (err) {
        if (!err) {
            t.fail('should have failed with an error.');
        }
        t.equal('InternalError', err.name);
        t.done();
    });
});


test('statemachine middle out of order', function (t) {
    var sm;
    var funcs = [
        function (_, subcb) {
            sm = new StateMachine({ 'log': LOG });
            sm.on('ready', subcb);
        },
        function (_, subcb) {
            sm.execute([
                { 'index': 1, 'command': 'one' },
                { 'index': 2, 'command': 'two' },
                { 'index': 4, 'command': 'four' },
                { 'index': 3, 'command': 'three' }
            ], subcb);
        }
    ];
    vasync.pipeline({
        funcs: funcs
    }, function (err) {
        if (!err) {
            t.fail('should have failed with an error.');
        }
        t.equal('InternalError', err.name);
        t.done();
    });
});
