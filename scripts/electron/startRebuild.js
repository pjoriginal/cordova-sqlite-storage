const path = require('path');
const exec = require('child_process').exec;
const packageName = require('../../package.json').name;

module.exports = function () {
    return new Promise(function (resolve, reject) {
        console.log('Rebuilding better-sql for current electron version');
        exec('npm run rebuild', { cwd: path.join('plugins', packageName, 'src', 'electron') },
            function (error, stdout, stderr) {
                if (error !== null) {
                    console.log('rebuild failed with message: ' + error.message);
                    reject();
                } else {
                    console.log('rebuild ok');
                    resolve();
                }
            }
        );
    });
}