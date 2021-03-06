/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var assert = require('assert-plus');
var bunyan = require('bunyan');
var lib = require('../lib');
var test = require('nodeunit-plus').test;
var vasync = require('vasync');



///--- Globals

var LOG = bunyan.createLogger({
    level: (process.env.LOG_LEVEL || 'fatal'),
    name: 'memstream-test',
    stream: process.stdout
});



///--- Tests

test('test mem flowing', function (t) {
    var one = lib.memstream([1, 2, 3]);
    var res = [];

    one.on('data', function (d) {
        res.push(d);
    });

    one.once('end', function () {
        t.deepEqual([1, 2, 3], res);
        t.done();
    });
});


test('test mem non-flowing', function (t) {
    var one = lib.memstream([1, 2, 3]);
    var res = [];

    one.on('readable', function () {
        var d;
        while (null !== (d = one.read())) {
            res.push(d);
        }
    });

    one.once('end', function () {
        t.deepEqual([1, 2, 3], res);
        t.done();
    });
});


test('test mem end immediately flowing', function (t) {
    var one = lib.memstream([]);
    var res = [];

    one.on('data', function (d) {
        res.push(d);
    });

    one.once('end', function () {
        t.deepEqual([], res);
        t.done();
    });
});


test('test mem end immediately non-flowing', function (t) {
    var one = lib.memstream([]);
    var res = [];

    one.on('readable', function () {
        var d;
        while (null !== (d = one.read())) {
            res.push(d);
        }
    });

    one.once('end', function () {
        t.deepEqual([], res);
        t.done();
    });
});


test('test mem stream after reading one, flowing', function (t) {
    var one = lib.memstream([1, 2, 3, 4, 5]);
    var res = [];
    var firstOne = null;

    function startReadAll() {
        one.on('data', function (d) {
            res.push(d);
        });
    }

    function oneOnReadable() {
        firstOne = one.read();
        if (firstOne === null) {
            one.once('readable', oneOnReadable);
        } else {
            startReadAll();
        }
    }

    one.once('readable', oneOnReadable);
    one.once('end', function () {
        t.equal(1, firstOne);
        t.deepEqual([2, 3, 4, 5], res);
        t.done();
    });
});


test('test mem stream after reading one, non-flowing', function (t) {
    var one = lib.memstream([1, 2, 3, 4, 5]);
    var res = [];
    var firstOne = null;

    function startReadAll() {
        function restReadable() {
            var d;
            while (null !== (d = one.read())) {
                res.push(d);
            }
        }
        one.on('readable', restReadable);
    }

    function oneOnReadable() {
        firstOne = one.read();
        if (firstOne === null) {
            one.once('readable', oneOnReadable);
        } else {
            startReadAll();
        }
    }

    one.once('readable', oneOnReadable);
    one.once('end', function () {
        t.equal(1, firstOne);
        t.deepEqual([2, 3, 4, 5], res);
        t.done();
    });
});
