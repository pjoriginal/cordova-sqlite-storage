const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');

const dataDirectory = app.getPath('userData') + path.sep;

const dbmap = {};
const closed_dbmap = {};
module.exports = {
    echoStringValue: function ([options]) {
        return options[0].value;
    },

    open: ([options]) => {
        return new Promise((resolve, reject) => {

            var name = options[0].name;

            if (!!dbmap[name]) return setTimeout(function () {
                reject('INTERNAL OPEN ERROR: db already open for ' + name);
            }, 0);

            // Support close-and-reopen tests
            if (!!closed_dbmap[name]) {
                var db = dbmap[name] = closed_dbmap[name];
                delete closed_dbmap[name];
                try {
                    var rollback = db.prepare('ROLLBACK');
                    rollback.run();
                } catch (e) { }
                setTimeout(resolve, 0);
                return;
            }

            try {
                dbmap[name] = new Database(`${dataDirectory}${name}.db`, { verbose: () => false });
            } catch (e) {
                // INTERNAL OPEN ERROR
                return reject(e);
            }

            setTimeout(resolve, 0);
        })
    },

    backgroundExecuteSqlBatch: ([options]) => {
        return new Promise(async (resolve, reject) => {
            var dbName = options[0].dbargs.dbname;

            if (!dbmap[dbName]) return reject('INTERNAL ERROR: database not open');

            var e = options[0].executes;

            var resultList = [];

            for (var i = 0; i < e.length; ++i) {
                var sql = e[i].sql;
                var params = e[i].params;

                resultList.push(await _sqlite3ExecuteSql(dbmap[dbName], sql, params));
            }
            setTimeout(function () {
                resolve(resultList);
            }, 0);
        })
    },

    close: ([options]) => {
        var dbname = options[0].path;

        var db = dbmap[dbname];

        if (!db) {
            return Error('INTERNAL CLOSE ERROR: database not open');
        };

        // Keep in memory to support close-and-reopen tests
        closed_dbmap[dbname] = dbmap[dbname];

        delete dbmap[dbname];

        return true;
    },

    delete: ([options]) => {
        return new Promise((resolve, reject) => {

            var dbname = options[0].path;
    
            if (!!closed_dbmap[dbname]) {
                // XXX TBD causes test timeouts:
                // closed_dbmap[name].close();
                delete closed_dbmap[dbname];
                return setTimeout(resolve, 0);
            }
    
            var db = dbmap[dbname];
    
            if (!db) return setTimeout(function () {
                reject('INTERNAL DELETE ERROR');
            }, 0);
    
            db.close();
    
            delete dbmap[dbname];
    
            window.resolveLocalFileSystemURL(dataDirectory, function (dir) {
                dir.getFile(`${dbname}.db`, { create: false }, function (fileEntry) {
                    fileEntry.remove(function () {
                        setTimeout(resolve, 0);
                    }, function (error) {
                        setTimeout(resolve, 0);
                    }, function () {
                        setTimeout(resolve, 0);
                    });
                });
            });
        })
    }


}

function _sqlite3ExecuteSql(db, sql, params) {
    return new Promise(function (resolve) {
        const stmt = db.prepare(sql);
        let result = null;
        if (sql.indexOf('SELECT') === 0) {
            result = { results: stmt.all(params), success: true };
        } else {
            result = stmt.run(params);
            result.success = true;
        }
        if (!result.success) {
            // FUTURE TODO: report correct error code according to SQLite3
            resolve({
                type: 'error',
                result: {
                    code: 0,
                    message: result.code,
                },
            });
        } else {
            resolve({
                type: 'success',
                result:
                    result.changes && result.changes !== 0
                        ? {
                            rows: [],
                            insertId: result.lastInsertRowid,
                            rowsAffected: result.changes,
                        }
                        : {
                            rows: result.results,
                            rowsAffected: 0,
                        }
            });
        }
    });
}